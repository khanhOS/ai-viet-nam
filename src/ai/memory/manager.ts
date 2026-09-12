// KhanhOS AI — MemorySystem: nhiều lớp trí nhớ.
// - conversation: lấy từ DB messages (nguồn thật)
// - session: in-memory TTL theo conversation
// - long_term: bảng AiMemory (Prisma) — sở thích, sự kiện user nói rõ
// - project: data/ai/project-memory.json — tri thức về dự án, sửa không đụng code
// KHÔNG bơ cả DB trí nhớ vào prompt — luôn rank & lấy top theo ngân sách.

import { db } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";
import type { MemoryEntry, MemoryKind, RetrievedMemory } from "@/ai/core/types";

// ─────────────────────────────────────────────
// Session memory (in-memory, TTL) — dùng globalThis sống qua HMR
// ─────────────────────────────────────────────

interface SessionState {
  entries: Map<string, MemoryEntry>;
  expiresAt: number;
}

const g = globalThis as unknown as {
  __khanhosSessionMemory?: Map<string, SessionState>;
};

const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6h — khớp context-engine cũ
const sessionMemory = (g.__khanhosSessionMemory ??= new Map<string, SessionState>());

function sessionKey(userId: string, conversationId: string): string {
  return `${userId}:${conversationId}`;
}

/** Ghi trí nhớ phiên (mềm — tạm thời theo hội thoại). */
export function rememberSession(
  userId: string,
  conversationId: string,
  key: string,
  value: string,
  importance = 2
): void {
  const k = sessionKey(userId, conversationId);
  const now = Date.now();
  let state = sessionMemory.get(k);
  if (!state || state.expiresAt < now) {
    state = { entries: new Map(), expiresAt: now + SESSION_TTL_MS };
    sessionMemory.set(k, state);
  }
  state.entries.set(key, {
    id: `session:${k}:${key}`,
    kind: "session",
    key,
    value: value.slice(0, 2000),
    importance,
    createdAt: now,
    updatedAt: now,
  });
  // Giới hạn 40 mục/phiên tránh phình to
  if (state.entries.size > 40) {
    const oldest = [...state.entries.values()].sort((a, b) => a.updatedAt - b.updatedAt)[0];
    if (oldest) state.entries.delete(oldest.key);
  }
}

export function getSessionMemories(userId: string, conversationId: string): MemoryEntry[] {
  const k = sessionKey(userId, conversationId);
  const state = sessionMemory.get(k);
  if (!state || state.expiresAt < Date.now()) return [];
  return [...state.entries.values()];
}

export function clearSessionMemory(userId: string, conversationId: string): void {
  sessionMemory.delete(sessionKey(userId, conversationId));
}

// ─────────────────────────────────────────────
// Long-term memory (Prisma) — chỉ ghi khi user nói rõ ràng (không tự bịa)
// ─────────────────────────────────────────────

const LONG_TERM_MAX = 200;

export async function rememberLongTerm(
  userId: string,
  key: string,
  value: string
): Promise<void> {
  const clean = value.trim().slice(0, 1000);
  if (!clean) return;
  const existing = await db.aiMemory.findFirst({
    where: { userId, kind: "long_term", key },
  });
  if (existing) {
    await db.aiMemory.update({
      where: { id: existing.id },
      data: { value: clean, updatedAt: new Date() },
    });
    return;
  }
  const count = await db.aiMemory.count({ where: { userId, kind: "long_term" } });
  if (count >= LONG_TERM_MAX) {
    // Xoá cái ít quan trọng & cũ nhất
    const oldest = await db.aiMemory.findFirst({
      where: { userId, kind: "long_term" },
      orderBy: [{ importance: "asc" }, { updatedAt: "asc" }],
    });
    if (oldest) await db.aiMemory.delete({ where: { id: oldest.id } });
  }
  await db.aiMemory.create({
    data: { userId, kind: "long_term", key, value: clean, importance: 3 },
  });
}

export async function forgetLongTerm(userId: string, keyLike: string): Promise<number> {
  const res = await db.aiMemory.deleteMany({
    where: { userId, kind: "long_term", key: { contains: keyLike.toLowerCase() } },
  });
  return res.count;
}

// ─────────────────────────────────────────────
// Project memory (JSON file — data/ai/project-memory.json)
// ─────────────────────────────────────────────

interface ProjectMemoryFile {
  facts: Array<{ key: string; value: string; importance: number }>;
}

const PROJECT_MEMORY_PATH = path.join(process.cwd(), "data", "ai", "project-memory.json");

function loadProjectMemory(): MemoryEntry[] {
  try {
    const raw = fs.readFileSync(PROJECT_MEMORY_PATH, "utf-8");
    const data = JSON.parse(raw) as ProjectMemoryFile;
    const now = Date.now();
    return (data.facts ?? []).map((f, i) => ({
      id: `project:${i}`,
      kind: "project" as MemoryKind,
      key: f.key,
      value: f.value,
      importance: f.importance ?? 3,
      createdAt: now,
      updatedAt: now,
    }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// MemoryManager — retrieve + rank + budget
// ─────────────────────────────────────────────

export class MemoryManager {
  /** Lấy trí nhớ dài hạn + phiên + dự án, rank theo liên quan, trả tối đa budget mục. */
  async retrieve(
    userId: string,
    conversationId: string,
    query: string,
    maxEntries = 8
  ): Promise<RetrievedMemory[]> {
    const queryWords = query
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const score = (text: string, recencyDays: number): number => {
      const lower = text.toLowerCase();
      let overlap = 0;
      for (const w of queryWords) if (lower.includes(w)) overlap += 1;
      return overlap; // recency dùng ở tier riêng
    };

    const results: RetrievedMemory[] = [];

    // 1) Long-term (DB) — liên quan nhất
    try {
      const rows = await db.aiMemory.findMany({
        where: { userId, kind: "long_term" },
        orderBy: { updatedAt: "desc" },
        take: 40,
      });
      for (const r of rows) {
        const entry: MemoryEntry = {
          id: r.id,
          kind: "long_term",
          key: r.key,
          value: r.value,
          importance: r.importance,
          createdAt: r.createdAt.getTime(),
          updatedAt: r.updatedAt.getTime(),
        };
        const s = score(`${r.key} ${r.value}`, 0) + 2; // long-term được ưu tiên
        results.push({ entry, score: s + entry.importance * 0.5 });
      }
    } catch {
      // DB lỗi → bỏ qua, không fake
    }

    // 2) Session
    for (const entry of getSessionMemories(userId, conversationId)) {
      results.push({ entry, score: score(`${entry.key} ${entry.value}`, 1) + 1.5 });
    }

    // 3) Project facts
    for (const entry of loadProjectMemory()) {
      results.push({ entry, score: score(`${entry.key} ${entry.value}`, 2) + entry.importance * 0.4 });
    }

    // Rank: điểm liên quan > importance > mới nhất
    results.sort((a, b) => b.score - a.score || b.entry.importance - a.entry.importance);
    return results.slice(0, maxEntries);
  }
}

/** Phát hiện yêu cầu ghi nhớ rõ ràng của user → lưu long-term (không tự bịa). */
export function detectMemoryCommand(text: string): { key: string; value: string } | null {
  const m = text.match(
    /^(?:hãy\s+)?(?:ghi\s+nhớ|rnhớ|nhớ\s+hộ|remember)(?:\s+rằng)?[:\s]+(.{3,300})$/i
  );
  if (m) {
    const value = m[1].trim();
    const key = `note:${value.slice(0, 40).toLowerCase()}`;
    return { key, value };
  }
  const f = text.match(/^(?:quên|hãy\s+quên|forget)(?:\s+đi)?[:\s]+(.{1,100})$/i);
  if (f) return { key: "__forget__", value: f[1].trim() };
  return null;
}
