// KhanhOS AI — Nạp dữ liệu chatbot từ data/chatbot/*.json
// - Cache trong globalThis (an toàn HMR), tự nạp lại khi file đổi (mtime)
// - Chuẩn hoá pattern/keyword/alias/knowledge bằng đúng pipeline normalize
// - readDataFile/writeDataFile: whitelist + atomic write cho API admin CRUD

import fs from "node:fs";
import path from "node:path";

import type {
  AliasesConfig,
  ChatbotData,
  CommandDef,
  ConversationScript,
  FaqEntry,
  IntentDef,
  KnowledgeEntry,
  ResponseVariants,
  ScoringConfig,
  SystemConfig,
  TopicDef,
} from "./types";
import { normalizeText } from "./normalize";

const DATA_DIR = path.join(process.cwd(), "data", "chatbot");
const ROOT_FILES = [
  "system.json",
  "aliases.json",
  "commands.json",
  "conversations.json",
  "topics.json",
  "faq.json",
] as const;
const SCAN_DIRS = ["intents", "knowledge", "responses"] as const;

const DEFAULT_SYSTEM: SystemConfig = {
  engine: {
    name: "khanhos-local-rule",
    version: "1.0.0",
    default_threshold: 0.6,
    max_message_chars: 8000,
    match_max_chars: 1200,
  },
  scoring: {
    exact_pattern: 100,
    pattern_contain: 90,
    pattern_contain_partial: 70,
    short_pattern: 55,
    faq_pattern: 85,
    keyword_single: 10,
    keyword_phrase: 20,
    keyword_fuzzy: 8,
    keyword_cap: 60,
    alias: 15,
    alias_cap: 30,
    topic_match: 15,
    related_intent: 10,
    followup: 25,
  },
  context: { window: 8, max_entries: 500, ttl_ms: 6 * 3600 * 1000 },
  fallback: {
    responses: [
      "Câu này nằm ngoài tri thức cục bộ của mình — nhưng mình không đoán bừa để tránh nói sai bạn.",
    ],
    responses_en: ["This one is beyond my local knowledge — I would rather not guess and mislead you."],
    suggestion_header: "Một số chủ đề mình trả lời được:",
    max_suggestions: 3,
  },
  about: "KhanhOS AI — web chat AI chạy hoàn toàn cục bộ.",
  model_info: {
    id: "khanhos-core",
    name: "KhanhOS Core",
    description: "Bộ máy tri thức cục bộ",
    badge: "Cục bộ",
  },
};

interface CacheEntry {
  fingerprint: string;
  data: ChatbotData;
}

const g = globalThis as unknown as {
  __khanhosChatbotData?: CacheEntry;
};

// ─────────────────────────────────────────────
// Đọc file an toàn
// ─────────────────────────────────────────────

function readJson(rel: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    const full = path.join(DATA_DIR, rel);
    if (!fs.existsSync(full)) return { ok: false, error: "missing" };
    return { ok: true, value: JSON.parse(fs.readFileSync(full, "utf8")) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function listJsonFiles(dirRel: string): string[] {
  try {
    const full = path.join(DATA_DIR, dirRel);
    if (!fs.statSync(full).isDirectory()) return [];
    return fs
      .readdirSync(full)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => path.posix.join(dirRel, f));
  } catch {
    return [];
  }
}

/** Dấu vân tập tin (path:mtimeMs:size) để phát hiện thay đổi. */
function fingerprint(): string {
  const parts: string[] = [];
  const files = [...ROOT_FILES.map((f) => String(f)), ...allScanFiles()];
  for (const rel of files) {
    try {
      const st = fs.statSync(path.join(DATA_DIR, rel));
      parts.push(`${rel}:${st.mtimeMs}:${st.size}`);
    } catch {
      parts.push(`${rel}:-`);
    }
  }
  return parts.join("|");
}

function allScanFiles(): string[] {
  const out: string[] = [];
  for (const d of SCAN_DIRS) out.push(...listJsonFiles(d));
  return out;
}

// ─────────────────────────────────────────────
// Nạp + chuẩn hoá
// ─────────────────────────────────────────────

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

/** Ép object về Record<string,string> — bỏ cặp giá trị không phải chuỗi. */
function asStringRecord(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(asRecord(v))) {
    if (typeof val === "string" && val) out[k] = val;
  }
  return out;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function toWords(s: string): string[] {
  return s ? s.split(" ").filter(Boolean) : [];
}

export function getChatbotData(): ChatbotData {
  const fp = fingerprint();
  const cached = g.__khanhosChatbotData;
  if (cached && cached.fingerprint === fp) return cached.data;

  const data = build();
  g.__khanhosChatbotData = { fingerprint: fingerprint(), data };
  return data;
}

function build(): ChatbotData {
  const warnings: string[] = [];

  // system.json
  const systemRaw = readJson("system.json");
  const sysRec = systemRaw.ok ? asRecord(systemRaw.value) : {};
  const system: SystemConfig = systemRaw.ok
    ? {
        ...DEFAULT_SYSTEM,
        ...asRecord(systemRaw.value),
        engine: { ...DEFAULT_SYSTEM.engine, ...asStringRecord(sysRec.engine) } as SystemConfig["engine"],
        scoring: { ...DEFAULT_SYSTEM.scoring, ...asStringRecord(sysRec.scoring) } as ScoringConfig,
        context: { ...DEFAULT_SYSTEM.context, ...asStringRecord(sysRec.context) } as SystemConfig["context"],
        fallback: { ...DEFAULT_SYSTEM.fallback, ...asRecord(sysRec.fallback) } as SystemConfig["fallback"],
      }
    : (() => {
        warnings.push("system.json thiếu/hỏng — dùng cấu hình mặc định");
        return DEFAULT_SYSTEM;
      })();

  // aliases.json
  const aliasesRaw = readJson("aliases.json");
  const aliases: AliasesConfig = aliasesRaw.ok
    ? {
        slang: asStringRecord(asRecord(aliasesRaw.value).slang),
        terms: asStringRecord(asRecord(aliasesRaw.value).terms),
      }
    : { slang: {}, terms: {} };
  if (!aliasesRaw.ok) warnings.push("aliases.json thiếu — bỏ slang/terms");

  // topics.json
  const topicsRaw = readJson("topics.json");
  const topics: TopicDef[] = topicsRaw.ok && Array.isArray(topicsRaw.value)
    ? (topicsRaw.value as TopicDef[])
        .filter((t) => t && typeof t.id === "string")
        .map((t) => ({ ...t, name: t.name ?? t.id }))
    : [];
  const topicIds = new Set(topics.map((t) => t.id));

  // commands.json
  const commandsRaw = readJson("commands.json");
  const commands: Record<string, CommandDef> = commandsRaw.ok
    ? asRecord(commandsRaw.value) as Record<string, CommandDef>
    : {};

  // faq.json
  const faqRaw = readJson("faq.json");
  const faq: FaqEntry[] = faqRaw.ok && Array.isArray(faqRaw.value)
    ? (faqRaw.value as FaqEntry[])
        .filter((q) => q && typeof q.intent === "string")
        .map((q) => ({
          ...q,
          aliases: asStringArray(q.aliases),
          aliasesNorm: asStringArray(q.aliases).map((a) => normalizeText(a, aliases)),
        }))
    : [];

  // conversations.json
  const convsRaw = readJson("conversations.json");
  const conversations: ConversationScript[] = convsRaw.ok && Array.isArray(convsRaw.value)
    ? (convsRaw.value as ConversationScript[]).filter((c) => c && Array.isArray(c.messages))
    : [];

  // responses/*.json — merge object
  const responses: Record<string, ResponseVariants> = {};
  for (const rel of listJsonFiles("responses")) {
    const r = readJson(rel);
    if (!r.ok) {
      warnings.push(`${rel} hỏng JSON — bỏ qua`);
      continue;
    }
    for (const [k, v] of Object.entries(asRecord(r.value))) {
      const variants = asRecord(v);
      responses[k] = {
        vi: asStringArray(variants.vi),
        en: asStringArray(variants.en),
      };
    }
  }

  // knowledge/*.json — concat mảng
  const knowledge: KnowledgeEntry[] = [];
  for (const rel of listJsonFiles("knowledge")) {
    const r = readJson(rel);
    if (!r.ok || !Array.isArray(r.value)) {
      warnings.push(`${rel} hỏng JSON — bỏ qua`);
      continue;
    }
    for (const k of r.value as KnowledgeEntry[]) {
      if (!k || typeof k.id !== "string" || typeof k.title !== "string") continue;
      knowledge.push({
        ...k,
        keywords: asStringArray(k.keywords),
        aliases: asStringArray(k.aliases),
        keywordsNorm: asStringArray(k.keywords).map((s) => toWords(normalizeText(s, aliases))),
        aliasesNorm: asStringArray(k.aliases).map((s) => normalizeText(s, aliases)),
        titleNorm: normalizeText(k.title, aliases),
      });
    }
  }

  // intents/*.json — concat + chuẩn hoá pattern
  const intents: IntentDef[] = [];
  const seen = new Set<string>();
  for (const rel of listJsonFiles("intents")) {
    const r = readJson(rel);
    if (!r.ok || !Array.isArray(r.value)) {
      warnings.push(`${rel} hỏng JSON — bỏ qua`);
      continue;
    }
    for (const it of r.value as Array<Record<string, unknown>>) {
      if (!it || typeof it.id !== "string" || typeof it.response_id !== "string") {
        warnings.push(`${rel}: intent thiếu id/response_id — bỏ qua`);
        continue;
      }
      if (seen.has(it.id)) {
        warnings.push(`intent trùng id "${it.id}" (${rel}) — giữ bản đầu`);
        continue;
      }
      seen.add(it.id);

      const patterns = asStringArray(it.patterns);
      const patternsText = patterns.map((p) => normalizeText(p, aliases));
      intents.push({
        id: it.id,
        description: typeof it.description === "string" ? it.description : undefined,
        topic: typeof it.topic === "string" ? it.topic : "general",
        patterns,
        patternsText,
        patternsWords: patternsText.map(toWords),
        keywords: asStringArray(it.keywords).map((s) => toWords(normalizeText(s, aliases))),
        aliases: asStringArray(it.aliases).map((s) => normalizeText(s, aliases)),
        examples: asStringArray(it.examples),
        relatedIntents: asStringArray(it.related_intents),
        responseId: it.response_id,
        knowledgeRef: typeof it.knowledge_ref === "string" ? it.knowledge_ref : undefined,
        confidenceThreshold:
          typeof it.confidence_threshold === "number"
            ? it.confidence_threshold
            : system.engine.default_threshold,
      });
    }
  }
  const intentIds = new Set(intents.map((i) => i.id));

  // Chuẩn hoá conversations → userTurns [text, intent]
  for (const c of conversations) {
    const turns: Array<{ text: string; intentId: string }> = [];
    const msgs = c.messages ?? [];
    // lượt user i được trả lời bởi intent của assistant ĐỨNG SAU nó
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m?.role !== "user" || typeof m.content !== "string") continue;
      // tìm assistant intent kế tiếp
      let intentId: string | null = null;
      for (let j = i + 1; j < msgs.length; j++) {
        if (msgs[j]?.role === "assistant") {
          intentId = typeof msgs[j].intent === "string" ? msgs[j].intent! : null;
          break;
        }
      }
      if (!intentId) continue;
      turns.push({ text: normalizeText(m.content, aliases), intentId });
    }
    c.userTurns = turns;
  }

  // Warnings chéo dữ liệu
  for (const it of intents) {
    if (!responses[it.responseId]?.vi?.length && !responses[it.responseId]?.en?.length) {
      warnings.push(`intent "${it.id}" trỏ response_id "${it.responseId}" không tồn tại`);
    }
    if (it.topic !== "general" && !topicIds.has(it.topic)) {
      warnings.push(`intent "${it.id}" dùng topic lạ "${it.topic}"`);
    }
  }
  for (const q of faq) {
    if (!intentIds.has(q.intent)) {
      warnings.push(`FAQ "${q.question}" trỏ intent không tồn tại "${q.intent}"`);
    }
  }
  for (const c of conversations) {
    for (const t of c.userTurns ?? []) {
      if (!intentIds.has(t.intentId)) {
        warnings.push(`kịch bản "${c.id}" trỏ intent không tồn tại "${t.intentId}"`);
      }
    }
  }
  const knowledgeIds = new Set(knowledge.map((k) => k.id));
  for (const it of intents) {
    if (it.knowledgeRef && !knowledgeIds.has(it.knowledgeRef)) {
      warnings.push(`intent "${it.id}" trỏ knowledge_ref không tồn tại "${it.knowledgeRef}"`);
    }
    if (!it.patterns.length) {
      warnings.push(`intent "${it.id}" không có pattern nào`);
    }
  }

  const stats = {
    intents: intents.length,
    patterns: intents.reduce((n, i) => n + i.patterns.length, 0),
    responses: Object.keys(responses).length,
    knowledge: knowledge.length,
    faq: faq.length,
    topics: topics.length,
    commands: Object.keys(commands).length,
    conversations: conversations.length,
    aliases: Object.keys(aliases.slang).length + Object.keys(aliases.terms).length,
  };

  return {
    system,
    aliases,
    topics,
    commands,
    faq,
    conversations,
    intents,
    responses,
    knowledge,
    stats,
    warnings,
  };
}

// ─────────────────────────────────────────────
// Admin CRUD — whitelist + atomic write
// ─────────────────────────────────────────────

/** Toàn bộ file dữ liệu hợp lệ (whitelist), dạng path tương đối POSIX. */
export function listDataFiles(): Array<{ path: string; size: number }> {
  const out: Array<{ path: string; size: number }> = [];
  const push = (rel: string) => {
    try {
      const st = fs.statSync(path.join(DATA_DIR, rel));
      out.push({ path: rel, size: st.size });
    } catch {
      // bỏ qua
    }
  };
  for (const f of ROOT_FILES) push(f);
  for (const rel of allScanFiles()) push(rel);
  return out;
}

function isWhitelisted(rel: string): boolean {
  if (!rel.endsWith(".json")) return false;
  // chặn path traversal ở từng đoạn
  const parts = rel.split("/");
  if (parts.some((p) => !p || p === "." || p === "..")) return false;
  if (parts.length === 1) {
    return (ROOT_FILES as readonly string[]).includes(parts[0]);
  }
  if (parts.length === 2 && (SCAN_DIRS as readonly string[]).includes(parts[0])) {
    return /^[a-z0-9._-]+$/i.test(parts[1]);
  }
  return false;
}

/** Đọc 1 file dữ liệu (whitelist) — trả null nếu không hợp lệ. */
export function readDataFile(rel: string): string | null {
  if (!isWhitelisted(rel)) return null;
  try {
    return fs.readFileSync(path.join(DATA_DIR, rel), "utf8");
  } catch {
    return null;
  }
}

/** Ghi 1 file dữ liệu (whitelist + atomic) — trả false nếu không hợp lệ. */
export function writeDataFile(rel: string, content: string): boolean {
  if (!isWhitelisted(rel)) return false;
  const full = path.join(DATA_DIR, rel);
  try {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    const tmp = `${full}.tmp-${Date.now()}`;
    fs.writeFileSync(tmp, content, "utf8");
    fs.renameSync(tmp, full);
    return true;
  } catch (e) {
    console.error("[data-loader] writeDataFile lỗi:", e);
    return false;
  }
}
