// KhanhOS AI — Truy vấn tri thức (RAG retrieval thật).
// Query → nhúng bằng model embedding local → so cosine với TẤT cả chunk
// của user → rank → top-k. Không dùng model → trả rỗng (trung thực).

import { db } from "@/lib/db";
import { embedText, cosineSimilarity } from "@/ai/knowledge/embeddings";

export interface RetrievedChunk {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  docIndex: number;
  content: string;
  score: number; // cosine similarity 0..1
}

// Cache vector user trong bộ nhớ (sống qua HMR) — parse JSON 1 lần
interface CachedChunk {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  docIndex: number;
  content: string;
  vector: number[];
}

const g = globalThis as unknown as {
  __khanhosVectorCache?: Map<string, { chunks: CachedChunk[]; loadedAt: number }>;
  __khanhosVectorDirty?: Set<string>;
};
const vectorCache = (g.__khanhosVectorCache ??= new Map());
const dirtyUsers = (g.__khanhosVectorDirty ??= new Set());
const CACHE_TTL_MS = 10 * 60 * 1000;

/** Đánh dấu cache vector của user cần nạp lại (gọi sau khi ingest/delete). */
export function invalidateUserVectorCache(userId: string): void {
  dirtyUsers.add(userId);
}

async function loadUserVectors(userId: string): Promise<CachedChunk[]> {
  const cached = vectorCache.get(userId);
  const fresh = cached && Date.now() - cached.loadedAt < CACHE_TTL_MS;
  const clean = fresh && !dirtyUsers.has(userId);
  if (cached && clean) return cached.chunks;

  const docs = await db.knowledgeDocument.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      chunks: {
        select: { id: true, docIndex: true, content: true, embedding: true, dim: true },
        orderBy: { docIndex: "asc" },
      },
    },
  });

  const chunks: CachedChunk[] = [];
  for (const doc of docs) {
    for (const c of doc.chunks) {
      if (c.dim === 0) continue; // chunk không nhúng được lúc ingest
      try {
        const vector = JSON.parse(c.embedding) as number[];
        if (Array.isArray(vector) && vector.length === c.dim) {
          chunks.push({
            documentId: doc.id,
            documentTitle: doc.title,
            chunkId: c.id,
            docIndex: c.docIndex,
            content: c.content,
            vector,
          });
        }
      } catch {
        // skip chunk hỏng dữ liệu
      }
    }
  }

  vectorCache.set(userId, { chunks, loadedAt: Date.now() });
  dirtyUsers.delete(userId);
  return chunks;
}

/**
 * Truy vấn top-k chunk liên quan nhất trong tri thức CỦA user.
 * Trả rỗng nếu: chưa có tài liệu / model embedding chưa sẵn sàng.
 */
export async function retrieveKnowledge(
  userId: string,
  query: string,
  topK = 4
): Promise<RetrievedChunk[]> {
  const q = query.trim();
  if (!q) return [];

  const qv = await embedText(q);
  if (!qv) return [];

  const chunks = await loadUserVectors(userId);
  if (!chunks.length) return [];

  const scored = chunks.map((c) => ({
    documentId: c.documentId,
    documentTitle: c.documentTitle,
    chunkId: c.chunkId,
    docIndex: c.docIndex,
    content: c.content,
    score: cosineSimilarity(qv, c.vector),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, topK));
}

/** Ráp kết quả retrieval thành block ngữ cảnh chèn vào system prompt. */
export function formatRetrievedKnowledge(
  results: RetrievedChunk[],
  minScore = 0.35
): string {
  const good = results.filter((r) => r.score >= minScore);
  if (!good.length) return "";
  const parts = good.map(
    (r, i) =>
      `[${i + 1}] (từ "${r.documentTitle}", đoạn ${r.docIndex + 1}, độ khớp ${(r.score * 100).toFixed(0)}%)\n${r.content}`
  );
  return `Tài liệu từ cơ sở tri thức người dùng đã nạp (thông tin này CÓ THẬT trong tài liệu — ưu tiên dùng):\n${parts.join("\n\n")}`;
}
