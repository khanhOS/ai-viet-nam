// KhanhOS AI — Local Chat Engine: types chung
// Kiến trúc abstraction: ChatEngine là interface chung; LocalRuleEngine là
// implementation 100% cục bộ (intent + tri thức từ data/chatbot/*.json).
// Sau này cắm engine local thật (Ollama/llama.cpp) — UI và API không đổi.

export type EngineLanguage = "vi" | "en";

/** Ngữ cảnh user truyền vào engine (để lệnh /usage, /give... dùng). */
export interface EngineUserContext {
  id: string;
  email: string;
  role: string; // "user" | "owner"
  plan: string; // "free" | "plus" | "vip" | "max"
}

/** Đầu vào engine.process — chat route gọi với user đầy đủ. */
export interface EngineInput {
  message: string;
  conversationId: string;
  userId: string;
  user?: EngineUserContext;
}

/** Kết quả trả về của engine — route chuyển thành SSE. */
export interface EngineResult {
  text: string;
  intent: string | null; // null = không nhận diện được (fallback)
  confidence: number; // 0..1
  source: "local"; // luôn là "local" — engine không gọi API ngoài
  language: EngineLanguage;
  suggestions?: string[];
  action?: string; // "clear_chat" | "reset_chat" | ...
  debug?: ScoredCandidate[]; // top ứng viên (dùng cho /api/admin/chatbot test)
}

/** Interface engine — mọi engine chat đều triển khai cái này. */
export interface ChatEngine {
  process(input: EngineInput): Promise<EngineResult>;
  /** Mồi trí nhớ hội thoại từ lịch sử DB (để follow-up hoạt động). */
  seedFromHistory(conversationId: string, history: Array<{ role: string; content: string }>): void;
}

// ─────────────────────────────────────────────
// Dữ liệu chatbot (data/chatbot/*.json)
// ─────────────────────────────────────────────

export interface SystemEngineConfig {
  name: string;
  version: string;
  default_threshold: number;
  max_message_chars: number;
  match_max_chars: number;
}

export interface ScoringConfig {
  exact_pattern: number;
  pattern_contain: number;
  pattern_contain_partial: number;
  short_pattern: number;
  faq_pattern: number;
  keyword_single: number;
  keyword_phrase: number;
  keyword_fuzzy: number;
  keyword_cap: number;
  alias: number;
  alias_cap: number;
  topic_match: number;
  related_intent: number;
  followup: number;
}

export interface SystemConfig {
  engine: SystemEngineConfig;
  scoring: ScoringConfig;
  context: { window: number; max_entries: number; ttl_ms: number };
  fallback: {
    responses: string[];
    responses_en: string[];
    suggestion_header: string;
    max_suggestions: number;
  };
  about: string;
  model_info: { id: string; name: string; description: string; badge: string };
}

export interface AliasesConfig {
  slang: Record<string, string>; // từ viết tắt → từ đủ (ko → khong)
  terms: Record<string, string>; // cụm từ → chuẩn hoá (triet tri nhan tao → ai)
}

export interface TopicDef {
  id: string;
  name: string;
  description?: string;
}

export interface CommandDef {
  description: string;
  response?: string;
  action?: string;
  usage?: string;
  owner_only?: boolean;
}

export interface FaqEntry {
  question: string;
  aliases: string[];
  intent: string;
  answer_id?: string;
  /** runtime: aliases đã chuẩn hoá */
  aliasesNorm?: string[];
}

export interface ConversationScript {
  id: string;
  messages: Array<{ role: string; content?: string; intent?: string }>;
  /** runtime: các lượt user [text chuẩn hoá, intent trả lời] */
  userTurns?: Array<{ text: string; intentId: string }>;
}

/** Intent đã nạp + chuẩn hoá sẵn cho matching nhanh. */
export interface IntentDef {
  id: string;
  description?: string;
  topic: string;
  patterns: string[]; // gốc (để hiển thị)
  patternsWords: string[][]; // chuẩn hoá, tách từ
  patternsText: string[]; // chuẩn hoá, join
  keywords: string[][];
  aliases: string[];
  examples?: string[];
  relatedIntents: string[];
  responseId: string;
  knowledgeRef?: string;
  confidenceThreshold: number;
}

export interface ResponseVariants {
  vi?: string[];
  en?: string[];
}

export interface KnowledgeContent {
  definition?: string;
  simple_explanation?: string;
  examples?: string[];
  related_topics?: string[];
  [key: string]: unknown;
}

export interface KnowledgeEntry {
  id: string;
  topic?: string;
  title: string;
  keywords?: string[];
  aliases?: string[];
  content: KnowledgeContent;
  related_intents?: string[];
  /** runtime */
  keywordsNorm?: string[][];
  aliasesNorm?: string[];
  titleNorm?: string;
}

export interface ChatbotData {
  system: SystemConfig;
  aliases: AliasesConfig;
  topics: TopicDef[];
  commands: Record<string, CommandDef>;
  faq: FaqEntry[];
  conversations: ConversationScript[];
  intents: IntentDef[];
  responses: Record<string, ResponseVariants>;
  knowledge: KnowledgeEntry[];
  stats: {
    intents: number;
    patterns: number;
    responses: number;
    knowledge: number;
    faq: number;
    topics: number;
    commands: number;
    conversations: number;
    aliases: number;
  };
  warnings: string[];
}

/** Kết quả chấm điểm một intent. */
export interface ScoredCandidate {
  intent: IntentDef;
  score: number; // 0..100 (có thể vượt 100 trước khi chặn)
  confidence: number; // min(1, score/100)
  reasons: string[];
  matchedLen: number; // số từ của pattern khớp nhất (tie-break)
}

/** Tin nhắn đã chuẩn hoá. */
export interface NormalizedMessage {
  raw: string; // bản gốc (đã cắt theo max_chars)
  text: string; // chuẩn hoá: thường, bỏ dấu, slang/terms áp dụng
  words: string[]; // tách từ của text
  hasVietnamese: boolean; // có dấu tiếng Việt ở bản gốc
  isQuestion: boolean;
}
