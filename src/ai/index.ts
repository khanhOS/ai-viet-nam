// KhanhOS AI — Facade: điểm vào duy nhất của hệ AI cục bộ.
// Route /api/chat gọi getAIOrchestrator() → nếu runtime model có sẵn →
// ReasoningEngine (inference thật); không → null (route dùng rules engine).
//
// Hệ thống con (điểm vào riêng cho các route chuyên biệt):
// - knowledge/ : RAG thật (embedding local + cosine)  → /api/knowledge
// - training/  : dataset + LoRA/QLoRA                  → /api/training
// - evaluation/: feedback 👍/👎 → dataset huấn luyện   → /api/feedback
// - memory/    : trí nhớ dài hạn                        → /api/memory
// - models/    : cấu hình model registry                → /api/models

import { getRuntimeStatus, invalidateRuntimeCache, type RuntimeStatus } from "@/ai/inference/runtime-detector";
import { InferenceEngine } from "@/ai/inference/engine";
import { ReasoningEngine } from "@/ai/reasoning/engine";
import { getEmbeddingStatus } from "@/ai/knowledge/embeddings";
import { retrieveKnowledge, formatRetrievedKnowledge } from "@/ai/knowledge/retrieval";
import { getModelRegistry } from "@/ai/models/model-config";
import { checkTrainingRuntime } from "@/ai/training/lora";

export interface AIOrchestrator {
  status: RuntimeStatus;
  reasoning: ReasoningEngine;
}

let cached: { key: string; orch: AIOrchestrator } | null = null;

/**
 * Lấy orchestrator nếu runtime inference local THẬT đang chạy.
 * Trả null khi: không có runtime / runtime không khoẻ / chưa pull model.
 */
export async function getAIOrchestrator(): Promise<AIOrchestrator | null> {
  const status = await getRuntimeStatus();
  if (!status.available || !status.adapter || !status.defaultModel) {
    if (cached) cached = null;
    return null;
  }

  const key = `${status.runtime}:${status.defaultModel.runtimeName}`;
  if (cached?.key === key) return cached.orch;

  const inference = new InferenceEngine(status.adapter);
  const orch: AIOrchestrator = {
    status,
    reasoning: new ReasoningEngine(inference, status.adapter),
  };
  cached = { key, orch };
  return orch;
}

/** Trạng thái đầy đủ của HỆ AI cục bộ (model + embedding + training). */
export async function getAISystemStatus() {
  const [runtime, embedding, training] = await Promise.all([
    getRuntimeStatus().catch(() => null),
    getEmbeddingStatus().catch(() => null),
    checkTrainingRuntime().catch(() => null),
  ]);
  return {
    inference: runtime
      ? {
          available: runtime.available,
          runtime: runtime.runtime,
          models: runtime.models.map((m) => ({
            id: m.id,
            runtimeName: m.runtimeName,
            family: m.family,
            parameterSize: m.parameterSize,
            quantization: m.quantization,
            contextLength: m.capabilities.contextLength,
            tools: m.capabilities.tools,
          })),
          defaultModel: runtime.defaultModel?.runtimeName ?? null,
          error: runtime.error ?? null,
        }
      : null,
    embedding,
    training,
    registry: getModelRegistry(),
  };
}

export {
  getRuntimeStatus,
  invalidateRuntimeCache,
  getEmbeddingStatus,
  retrieveKnowledge,
  formatRetrievedKnowledge,
  checkTrainingRuntime,
};
export type { RuntimeStatus };

