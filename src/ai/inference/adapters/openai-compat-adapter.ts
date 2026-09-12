// KhanhOS AI — OpenAI-compatible LOCAL Adapter
// Dùng cho llama.cpp server, vLLM, LM Studio, Ollama /v1... — CHỈ chạy local
// (loopback). KHÔNG dùng cho API mây (bảo mật: chặn ở isLocalRuntimeUrl).

import type {
  ChatCompletionMessage,
  GenerationOptions,
  InferenceChunk,
  InferenceUsage,
  LocalModelInfo,
  ModelAdapter,
} from "@/ai/core/types";
import { getAIRuntimeConfig, isLocalRuntimeUrl } from "@/ai/core/config";

interface OAIGeneratedMessage {
  role: string;
  content?: string;
}

interface OAIChatResponse {
  choices?: Array<{
    message?: OAIGeneratedMessage;
    delta?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: { message?: string };
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  // Key chỉ dành cho local gateway nếu có (vd llama.cpp --api-key) — không bắt buộc.
  const key = process.env.OPENAI_COMPAT_API_KEY;
  if (key) h["Authorization"] = `Bearer ${key}`;
  return h;
}

export class OpenAICompatAdapter implements ModelAdapter {
  readonly name = "openai-compat";
  private base: string;
  private model: string;

  constructor(baseUrl?: string, model?: string) {
    const cfg = getAIRuntimeConfig();
    this.base = (baseUrl ?? cfg.openaiCompatBaseUrl).replace(/\/$/, "");
    this.model = model ?? cfg.defaultModel;
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
      // 8s (endpoint local có lúc bận nạp model; endpoint mây cũng cần thời gian)
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${this.base}/v1/models`, {
        headers: headers(),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<LocalModelInfo[]> {
    this.guard();
    const res = await fetch(`${this.base}/v1/models`, { headers: headers() });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    return (data.data ?? [])
      .filter((m) => m.id)
      .map((m) => ({
        id: `runtime:${m.id}`,
        runtimeName: m.id as string,
        provider: "openai-compat",
        capabilities: {
          chat: true,
          tools: true, // llama.cpp/vLLM hỗ trợ tool calling chuẩn OAI
          vision: false,
          streaming: true,
          contextLength: getAIRuntimeConfig().defaultContextLength,
        },
      }));
  }

  async getDefaultModel(): Promise<LocalModelInfo | null> {
    const models = await this.listModels();
    return models.find((m) => m.runtimeName === this.model) ?? models[0] ?? null;
  }

  async supportsTools(_model: string): Promise<boolean> {
    return true;
  }

  async supportsVision(_model: string): Promise<boolean> {
    return false;
  }

  async generate(
    messages: ChatCompletionMessage[],
    model: string,
    options: GenerationOptions = {}
  ): Promise<string> {
    this.guard();
    const res = await fetch(`${this.base}/v1/chat/completions`, {
      method: "POST",
      headers: headers(),
      signal: options.signal,
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false,
        temperature: options.temperature,
        top_p: options.topP,
        max_tokens: options.maxOutputTokens,
        stop: options.stopSequences,
        ...(options.format === "json" ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Runtime HTTP ${res.status}`);
    const data = (await res.json()) as OAIChatResponse;
    if (data.error) throw new Error(data.error.message);
    return data.choices?.[0]?.message?.content ?? "";
  }

  async stream(
    messages: ChatCompletionMessage[],
    model: string,
    options: GenerationOptions,
    onChunk: (chunk: InferenceChunk) => void
  ): Promise<InferenceUsage> {
    this.guard();
    const res = await fetch(`${this.base}/v1/chat/completions`, {
      method: "POST",
      headers: headers(),
      signal: options.signal,
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        stream_options: { include_usage: true },
        temperature: options.temperature,
        top_p: options.topP,
        max_tokens: options.maxOutputTokens,
        stop: options.stopSequences,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`Runtime HTTP ${res.status}`);

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
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as OAIChatResponse;
          const delta = evt.choices?.[0]?.delta?.content ?? "";
          if (delta) outputLen += delta.length;
          const finish = evt.choices?.[0]?.finish_reason;
          onChunk({
            delta,
            finishReason: finish === "length" ? "length" : finish === "stop" ? "stop" : null,
          });
          if (evt.usage) {
            usage = {
              promptTokens: evt.usage.prompt_tokens ?? 0,
              outputTokens: evt.usage.completion_tokens ?? 0,
              estimated: false,
            };
          }
        } catch {
          continue;
        }
      }
    }
    if (usage.estimated) {
      usage = { promptTokens: 0, outputTokens: Math.round(outputLen / 4), estimated: true };
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
