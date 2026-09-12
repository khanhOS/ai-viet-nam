// KhanhOS AI — Embedding thật qua Ollama (model embedding local, vd nomic-embed-text).
// KHÔNG fake vector: nếu model embedding chưa pull / server không phản hồi →
// trả null và hệ thống tự rơi về chế độ "chưa có RAG" (trung thực).
// Vector cosine similarity tính bằng số học thường — không thư viện ngoài.

import { getAIRuntimeConfig } from "@/ai/core/config";

export interface EmbeddingStatus {
  available: boolean;
  model: string;
  dim: number | null;
  error?: string;
}

/** Tên model embedding (env AI_EMBEDDING_MODEL, mặc định nomic-embed-text). */
export function getEmbeddingModelName(): string {
  const v = process.env.AI_EMBEDDING_MODEL;
  return v && v.trim() ? v.trim() : "nomic-embed-text";
}

/**
 * Nhúng 1 đoạn text → vector thật.
 * Trả null khi: không có runtime / model chưa pull / lỗi. KHÔNG bịa vector.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 4000);
  if (!clean) return null;
  const cfg = getAIRuntimeConfig();
  if (!cfg.ollamaBaseUrl) return null;

  try {
    const res = await fetch(`${cfg.ollamaBaseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: getEmbeddingModelName(), prompt: clean }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { embedding?: number[] };
    if (!Array.isArray(data.embedding) || data.embedding.length === 0) return null;
    return data.embedding;
  } catch {
    return null;
  }
}

/** Nhúng nhiều đoạn (tuần tự — model embedding nhẹ, tránh quá tải CPU sandbox). */
export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  const out: (number[] | null)[] = [];
  for (const t of texts) {
    out.push(await embedText(t));
  }
  return out;
}

/** Cosine similarity — 2 vector phải cùng chiều. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Cache trạng thái embedding (sống qua HMR)
const g = globalThis as unknown as {
  __khanhosEmbedStatus?: { status: EmbeddingStatus; at: number };
};

/** Kiểm tra model embedding có sẵn thật không (nhúng 1 câu thăm dò). Cache 60s. */
export async function getEmbeddingStatus(force = false): Promise<EmbeddingStatus> {
  const model = getEmbeddingModelName();
  const now = Date.now();
  if (!force && g.__khanhosEmbedStatus && now - g.__khanhosEmbedStatus.at < 60_000) {
    return g.__khanhosEmbedStatus.status;
  }
  const probe = await embedText("kiểm tra kết nối model embedding local");
  const status: EmbeddingStatus = probe
    ? { available: true, model, dim: probe.length }
    : {
        available: false,
        model,
        dim: null,
        error: `Model embedding "${model}" chưa sẵn sàng — chạy: ollama pull ${model}`,
      };
  g.__khanhosEmbedStatus = { status, at: now };
  return status;
}
