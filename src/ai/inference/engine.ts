// KhanhOS AI — InferenceEngine: bọc ModelAdapter với retry + abort + đo lường.
// Mọi số liệu (TTFT, tok/s) là số THẬT đo được, không fake.

import type {
  ChatCompletionMessage,
  GenerationOptions,
  InferenceChunk,
  InferenceUsage,
  ModelAdapter,
} from "@/ai/core/types";

export interface InferenceMetrics {
  timeToFirstTokenMs: number | null;
  totalMs: number;
  usage: InferenceUsage;
  tokensPerSecond: number | null; // tính từ usage THẬT nếu runtime trả
}

export interface InferenceResult {
  text: string;
  metrics: InferenceMetrics;
}

export class InferenceEngine {
  constructor(private adapter: ModelAdapter) {}

  get adapterName(): string {
    return this.adapter.name;
  }

  /** Stream + gom kết quả; hỗ trợ abort (signal) và retry khi lỗi mạng (tối đa 2 lần). */
  async streamWithMetrics(
    messages: ChatCompletionMessage[],
    model: string,
    options: GenerationOptions,
    onChunk: (chunk: InferenceChunk) => void
  ): Promise<InferenceResult> {
    const started = performance.now();
    let firstTokenAt: number | null = null;
    let text = "";

    const wrappedOnChunk = (chunk: InferenceChunk) => {
      if (chunk.delta) {
        if (firstTokenAt === null) firstTokenAt = performance.now();
        text += chunk.delta;
      }
      onChunk(chunk);
    };

    let usage: InferenceUsage = { promptTokens: 0, outputTokens: 0, estimated: true };
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          text = ""; // retry từ đầu — không để text hỏng lẫn vào kết quả
          firstTokenAt = null;
        }
        usage = await this.adapter.stream(messages, model, options, wrappedOnChunk);
        lastError = null;
        break;
      } catch (e) {
        // Abort bởi người dùng → không retry
        if (e instanceof Error && e.name === "AbortError") throw e;
        lastError = e;
        console.error(`[ai/inference] attempt ${attempt + 1} failed:`, e instanceof Error ? e.message : e);
      }
    }

    if (lastError) throw lastError;

    const totalMs = performance.now() - started;
    let tokensPerSecond: number | null = null;
    if (!usage.estimated && usage.outputTokens > 0 && totalMs > 0) {
      tokensPerSecond = (usage.outputTokens / totalMs) * 1000;
    }

    return {
      text,
      metrics: {
        timeToFirstTokenMs: firstTokenAt === null ? null : firstTokenAt - started,
        totalMs,
        usage,
        tokensPerSecond,
      },
    };
  }

  /** Sinh một phát (không stream) — dùng cho bước phân tích/verifier nội bộ. */
  async generate(
    messages: ChatCompletionMessage[],
    model: string,
    options: GenerationOptions = {}
  ): Promise<InferenceResult> {
    const started = performance.now();
    const text = await this.adapter.generate(messages, model, options);
    const totalMs = performance.now() - started;
    return {
      text,
      metrics: {
        timeToFirstTokenMs: null,
        totalMs,
        usage: { promptTokens: 0, outputTokens: 0, estimated: true },
        tokensPerSecond: null,
      },
    };
  }
}
