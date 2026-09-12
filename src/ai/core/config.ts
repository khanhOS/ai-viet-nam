// KhanhOS AI — Cấu hình runtime AI cục bộ + dò tìm runtime thật
// Runtime hỗ trợ: Ollama (native), llama.cpp/vLLM/LM Studio (OpenAI-compatible
// chạy LOCAL). KHÔNG chấp nhận endpoint ngoài (bảo mật: chỉ 127.0.0.1/localhost
// trừ khi chủ sở hữu tự tắt kiểm tra bằng AI_ALLOW_REMOTE=true).

export interface AIRuntimeConfig {
  /** auto | ollama | openai-compat | none */
  mode: string;
  ollamaBaseUrl: string;
  openaiCompatBaseUrl: string;
  /** model mặc định (tên runtime, vd qwen2.5:0.5b) */
  defaultModel: string;
  /** context window mặc định */
  defaultContextLength: number;
  /** thời gian cache kết quả probe (ms) */
  probeCacheMs: number;
  /** ước lượng ngữ cảnh tối đa gửi model */
  maxContextBudgetTokens: number;
}

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

export function getAIRuntimeConfig(): AIRuntimeConfig {
  return {
    mode: env("AI_RUNTIME", "auto"),
    ollamaBaseUrl: env("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
    openaiCompatBaseUrl: env("OPENAI_COMPAT_BASE_URL", "http://127.0.0.1:8080"),
    defaultModel: env("AI_MODEL", "qwen2.5:0.5b"),
    defaultContextLength: Number(env("AI_NUM_CTX", "4096")),
    probeCacheMs: Number(env("AI_PROBE_CACHE_MS", "15000")),
    maxContextBudgetTokens: Number(env("AI_MAX_CONTEXT_TOKENS", "3000")),
  };
}

/** Chống lộ API ngoài: endpoint phải là loopback local. */
export function isLocalRuntimeUrl(url: string): boolean {
  if (process.env.AI_ALLOW_REMOTE === "true") return true; // chủ sở hữu tự chịu trách nhiệm
  try {
    const u = new URL(url);
    return (
      u.hostname === "127.0.0.1" ||
      u.hostname === "localhost" ||
      u.hostname === "0.0.0.0" ||
      u.hostname === "[::1]" ||
      u.hostname === "::1"
    );
  } catch {
    return false;
  }
}
