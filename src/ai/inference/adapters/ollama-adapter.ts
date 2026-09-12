// KhanhOS AI — Ollama Adapter (inference THẬT qua HTTP local)
// Endpoint: POST /api/chat (native, NDJSON stream) + /api/tags + /api/show.
// Chỉ chấp nhận base URL loopback (xem core/config.ts).

import type {
  ChatCompletionMessage,
  GenerationOptions,
  InferenceChunk,
  InferenceUsage,
  LocalModelInfo,
  ModelAdapter,
  ModelCapabilities,
} from "@/ai/core/types";
import { getAIRuntimeConfig, isLocalRuntimeUrl } from "@/ai/core/config";

interface OllamaChatResponse {
  message?: { role: string; content: string };
  done: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
  error?: string;
}

function toOllamaOptions(o: GenerationOptions) {
  const opts: Record<string, unknown> = {};
  if (o.temperature !== undefined) opts.temperature = o.temperature;
  if (o.topP !== undefined) opts.top_p = o.topP;
  if (o.topK !== undefined) opts.top_k = o.topK;
  if (o.minP !== undefined) opts.min_p = o.minP;
  if (o.repeatPenalty !== undefined) opts.repeat_penalty = o.repeatPenalty;
  if (o.frequencyPenalty !== undefined) opts.frequency_penalty = o.frequencyPenalty;
  if (o.presencePenalty !== undefined) opts.presence_penalty = o.presencePenalty;
  if (o.seed !== undefined) opts.seed = o.seed;
  if (o.maxOutputTokens !== undefined) opts.num_predict = o.maxOutputTokens;
  if (o.contextLength !== undefined) opts.num_ctx = o.contextLength;
  if (o.stopSequences?.length) opts.stop = o.stopSequences;
  return opts;
}

export class OllamaAdapter implements ModelAdapter {
  readonly name = "ollama";
  private base: string;

  constructor(baseUrl?: string) {
    this.base = (baseUrl ?? getAIRuntimeConfig().ollamaBaseUrl).replace(/\/$/, "");
  }

  private guard(): void {
    if (!isLocalRuntimeUrl(this.base)) {
      throw new Error(`Bảo mật: từ chối endpoint ngoài (${this.base}) — runtime AI phải chạy local.`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      this.guard();
      const ctrl = new AbortController();
      // 8s: máy 2 CPU khi nạp model /api/version có thể chậm hơn 1.5s —
      // timeout ngắn khiến app kết luận SAI "không có model" khi model vẫn sống.
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${this.base}/api/version`, { signal: ctrl.signal });
      clearTimeout(t);
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<LocalModelInfo[]> {
    this.guard();
    const res = await fetch(`${this.base}/api/tags`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      models?: Array<{
        name: string;
        model: string;
        size?: number;
        details?: {
          family?: string;
          parameter_size?: string;
          quantization_level?: string;
        };
      }>;
    };
    return (data.models ?? []).map((m) => ({
      id: `runtime:${m.name}`,
      runtimeName: m.name,
      provider: "ollama",
      sizeBytes: m.size,
      family: m.details?.family,
      parameterSize: m.details?.parameter_size,
      quantization: m.details?.quantization_level,
      capabilities: {
        chat: true,
        tools: false, // xác định per-model qua supportsTools()
        vision: false,
        streaming: true,
        contextLength: 4096,
      },
    }));
  }

  async getDefaultModel(): Promise<LocalModelInfo | null> {
    const cfg = getAIRuntimeConfig();
    const models = await this.listModels();
    const wanted = models.find((m) => m.runtimeName === cfg.defaultModel);
    if (wanted) {
      // Làm giàu thông tin qua /api/show
      const caps = await this.getModelCapabilities(wanted.runtimeName);
      return { ...wanted, capabilities: caps };
    }
    return models[0] ?? null;
  }

  async getModelCapabilities(model: string): Promise<ModelCapabilities> {
    const caps: ModelCapabilities = {
      chat: true,
      tools: false,
      vision: false,
      streaming: true,
      contextLength: getAIRuntimeConfig().defaultContextLength,
    };
    try {
      this.guard();
      const res = await fetch(`${this.base}/api/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      if (!res.ok) return caps;
      const data = (await res.json()) as {
        capabilities?: string[];
        model_info?: Record<string, unknown>;
      };
      if (Array.isArray(data.capabilities)) {
        caps.tools = data.capabilities.includes("tools");
        caps.vision = data.capabilities.includes("vision");
      }
      const ctx = data.model_info?.["qwen2.context_length"] ?? data.model_info?.["general.context_length"];
      if (typeof ctx === "number" && ctx > 0) caps.contextLength = Math.min(ctx, 8192);
    } catch {
      // giữ mặc định
    }
    return caps;
  }

  async supportsTools(model: string): Promise<boolean> {
    const caps = await this.getModelCapabilities(model);
    return caps.tools;
  }

  async supportsVision(model: string): Promise<boolean> {
    const caps = await this.getModelCapabilities(model);
    return caps.vision;
  }

  /** Sinh không stream — trả về chuỗi rỗng nếu lỗi. */
  async generate(
    messages: ChatCompletionMessage[],
    model: string,
    options: GenerationOptions = {}
  ): Promise<string> {
    this.guard();
    const res = await fetch(`${this.base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: options.signal,
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false,
        options: toOllamaOptions(options),
        keep_alive: "2h", // giữ model trong RAM — tránh nạp lại 10-20s mỗi lần hết 30p
        ...(options.format === "json" ? { format: "json" } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = (await res.json()) as OllamaChatResponse;
    if (data.error) throw new Error(`Ollama: ${data.error}`);
    return data.message?.content ?? "";
  }

  /** Sinh stream — mỗi dòng NDJSON là một chunk THẬT từ model. */
  async stream(
    messages: ChatCompletionMessage[],
    model: string,
    options: GenerationOptions,
    onChunk: (chunk: InferenceChunk) => void
  ): Promise<InferenceUsage> {
    this.guard();
    const res = await fetch(`${this.base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: options.signal,
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        options: toOllamaOptions(options),
        keep_alive: "2h", // giữ model trong RAM — tránh nạp lại 10-20s mỗi lần hết 30p
      }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Ollama HTTP ${res.status}`);
    }

    let usage: InferenceUsage = { promptTokens: 0, outputTokens: 0, estimated: true };
    let outputLen = 0;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let evt: OllamaChatResponse;
        try {
          evt = JSON.parse(trimmed) as OllamaChatResponse;
        } catch {
          continue;
        }
        if (evt.error) throw new Error(`Ollama: ${evt.error}`);
        const delta = evt.message?.content ?? "";
        if (delta) outputLen += delta.length;
        onChunk({
          delta,
          done: evt.done,
          finishReason: evt.done
            ? evt.done_reason === "length"
              ? "length"
              : "stop"
            : null,
        });
        if (evt.done) {
          // Số liệu THẬT từ runtime
          usage = {
            promptTokens: evt.prompt_eval_count ?? 0,
            outputTokens: evt.eval_count ?? 0,
            estimated: false,
          };
        }
      }
    }
    // runtime không trả metrics (bất thường) → ước lượng trung thực
    if (usage.estimated) {
      usage = {
        promptTokens: 0,
        outputTokens: Math.round(outputLen / 4),
        estimated: true,
      };
    }
    return usage;
  }

  async generateStructured<T = unknown>(
    messages: ChatCompletionMessage[],
    model: string,
    _schemaHint: string,
    options: GenerationOptions = {}
  ): Promise<T | null> {
    const text = await this.generate(messages, model, { ...options, format: "json" });
    try {
      return JSON.parse(text) as T;
    } catch {
      // model trả JSON hỏng → thử cắt khối json đầu tiên
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]) as T;
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}
