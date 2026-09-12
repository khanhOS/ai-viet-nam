// KhanhOS AI — Kiến trúc AI cục bộ: types lõi
// ModelAdapter → InferenceEngine → ReasoningEngine → ToolExecutor → MemorySystem
// KHÔNG gọi API AI ngoài. Runtime thay thế được (Ollama, llama.cpp, vLLM local...).

// ─────────────────────────────────────────────
// Tin nhắn & stream
// ─────────────────────────────────────────────

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatCompletionMessage {
  role: ChatRole;
  content: string;
  /** tool-calling: tên tool khi role=tool */
  toolName?: string;
  images?: string[]; // base64 (vision)
}

/** Chunk streaming từ model — THẬT (không fake). */
export interface InferenceChunk {
  delta?: string;
  done?: boolean;
  /** Số liệu thật từ runtime (Ollama trả ở chunk cuối) */
  usage?: InferenceUsage;
  finishReason?: "stop" | "length" | "error" | null;
}

export interface InferenceUsage {
  promptTokens: number;
  outputTokens: number;
  /** true = runtime trả số liệu thật; false = ước lượng phía app */
  estimated: boolean;
}

// ─────────────────────────────────────────────
// Model adapter — lớp trừu tượng runtime
// ─────────────────────────────────────────────

export interface GenerationOptions {
  temperature?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  repeatPenalty?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  seed?: number;
  maxOutputTokens?: number;
  contextLength?: number; // num_ctx
  stopSequences?: string[];
  format?: "text" | "json";
  signal?: AbortSignal;
}

export interface ModelCapabilities {
  chat: boolean;
  tools: boolean;
  vision: boolean;
  streaming: boolean;
  contextLength: number;
}

export interface LocalModelInfo {
  /** id công khai: "runtime:<tên model>" */
  id: string;
  /** tên model runtime thật, vd "qwen2.5:0.5b" */
  runtimeName: string;
  provider: string; // "ollama" | "openai-compat"
  sizeBytes?: number;
  family?: string;
  parameterSize?: string;
  quantization?: string;
  capabilities: ModelCapabilities;
}

export interface ModelAdapter {
  readonly name: string; // "ollama" | "openai-compat" ...
  /** Model mặc định của runtime (theo AI_MODEL env) */
  getDefaultModel(): Promise<LocalModelInfo | null>;
  /** Liệt kê model có sẵn trong runtime */
  listModels(): Promise<LocalModelInfo[]>;
  /** Runtime có đang chạy thật không (probe sức khoẻ) */
  isHealthy(): Promise<boolean>;
  /** Sinh không stream */
  generate(
    messages: ChatCompletionMessage[],
    model: string,
    options?: GenerationOptions
  ): Promise<string>;
  /** Sinh stream — chunk THẬT từ runtime */
  stream(
    messages: ChatCompletionMessage[],
    model: string,
    options: GenerationOptions,
    onChunk: (chunk: InferenceChunk) => void
  ): Promise<InferenceUsage>;
  /** Cấu trúc hoá (JSON mode) */
  generateStructured<T = unknown>(
    messages: ChatCompletionMessage[],
    model: string,
    schemaHint: string,
    options?: GenerationOptions
  ): Promise<T | null>;
  supportsTools(model: string): Promise<boolean>;
  supportsVision(model: string): Promise<boolean>;
}

// ─────────────────────────────────────────────
// Pipeline reasoning
// ─────────────────────────────────────────────

export type Complexity = "TRIVIAL" | "SIMPLE" | "MODERATE" | "COMPLEX" | "EXPERT";
export type TaskType = "chat" | "reasoning" | "coding" | "long_context" | "agent" | "tool_use";

export type PipelineStage =
  | "understanding"
  | "classifying"
  | "collecting_context"
  | "planning"
  | "generating"
  | "tool_call"
  | "tool_result"
  | "verifying"
  | "revising"
  | "finalizing";

export interface PipelineStatusEvent {
  stage: PipelineStage | "runtime";
  label: string; // text hiển thị UI (không lộ chain-of-thought)
  at: number; // epoch ms
}

// ─────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────

export type PermissionLevel = "READ_ONLY" | "SAFE_WRITE" | "EXECUTE" | "DESTRUCTIVE";

export interface ToolCallRequest {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  name: string;
  ok: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

export interface ToolExecutionRecord {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: "ok" | "error" | "timeout" | "denied";
  output?: string;
  error?: string;
  startedAt: string; // ISO
  durationMs: number;
}

// ─────────────────────────────────────────────
// Diagnostics
// ─────────────────────────────────────────────

export interface DiagnosticsSummary {
  model: string | null;
  runtime: string | null; // "ollama" | "openai-compat" | "local-rules" | null
  profile: string | null;
  complexity: Complexity | null;
  timeToFirstTokenMs: number | null;
  totalMs: number | null;
  tokensPerSecond: number | null;
  outputTokens: number | null;
  promptTokens: number | null;
  tokensEstimated: boolean;
  verification: { passed: boolean; checks: Array<{ name: string; passed: boolean; note?: string }> } | null;
  toolCalls: number;
  retries: number;
}

// ─────────────────────────────────────────────
// Memory
// ─────────────────────────────────────────────

export type MemoryKind = "conversation" | "session" | "long_term" | "project" | "semantic";

export interface MemoryEntry {
  id: string;
  kind: MemoryKind;
  key: string; // khóa ngắn (vd "preference:language")
  value: string;
  importance: number; // 1..5
  createdAt: number;
  updatedAt: number;
}

export interface RetrievedMemory {
  entry: MemoryEntry;
  score: number; // điểm liên quan (relevance ranking)
}
