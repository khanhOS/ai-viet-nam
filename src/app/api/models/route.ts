// GET /api/models — Danh sách model cho frontend
// KhanhOS Core (bộ máy tri thức cục bộ) + các model runtime THẬT đang chạy
// (Ollama/llama.cpp local — id dạng "runtime:<tên>"). available=false khi
// runtime không khoẻ — UI hiển thị đúng sự thật, không fake model ảo.

import { listModels, DEFAULT_MODEL_ID } from "@/lib/models";
import { ok } from "@/lib/api-helpers";
import { getRuntimeStatus, getEmbeddingStatus } from "@/ai";
import { getModelRegistry } from "@/ai/models/model-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = listModels(); // [{...khanhos-core, available: true}]
  const runtime = await getRuntimeStatus().catch(() => null);

  const runtimeModels = (runtime?.models ?? []).map((m) => {
    const paramLabel = [m.parameterSize, m.quantization].filter(Boolean).join(" ");
    // "494.03M" → "494M" (làm tròn parameter size cho gọn)
    const prettySize = m.parameterSize
      ? m.parameterSize.replace(/(\d+(?:\.\d+)?)\s*([MBK])/i, (_s, num, unit) =>
          `${Math.round(parseFloat(num))}${String(unit).toUpperCase()}`
        )
      : null;
    return {
      id: m.id, // "runtime:qwen2.5:0.5b"
      name: `KhanhOS ${m.runtimeName.split(":")[0]}${prettySize ? ` ${prettySize}` : ""}`,
      description: `Model AI cục bộ chạy thật trên máy chủ (${m.provider === "ollama" ? "Ollama" : "runtime tương thích"}${paramLabel ? ` — ${paramLabel}` : ""}). Suy luận tự do, trả lời được mọi câu hỏi.`,
      provider: m.provider,
      capabilities: {
        chat: true,
        code: true,
        webSearch: false,
        vision: m.capabilities.vision,
        streaming: true,
      },
      badge: "Model cục bộ",
      order: 2,
      available: !!runtime?.available,
    };
  });

  // Model được chọn làm mặc định của runtime đẩy lên đầu nhóm runtime
  const defaultRuntime = runtime?.defaultModel?.id;
  runtimeModels.sort((a, b) => (a.id === defaultRuntime ? -1 : b.id === defaultRuntime ? 1 : 0));

  const models = [...base, ...runtimeModels];

  // Model embedding + registry cấu hình (MODEL_PATH/TYPE/FORMAT/CONTEXT_LENGTH)
  const [embedding, registry] = await Promise.all([
    getEmbeddingStatus().catch(() => null),
    Promise.resolve(getModelRegistry()),
  ]);

  return ok({
    models,
    defaultModelId: DEFAULT_MODEL_ID,
    runtime: {
      available: !!runtime?.available,
      runtime: runtime?.runtime ?? null,
      defaultModel: runtime?.defaultModel?.runtimeName ?? null,
      error: runtime?.error ?? null,
      checkedAt: runtime?.checkedAt ?? null,
    },
    embedding: embedding
      ? { available: embedding.available, model: embedding.model, dim: embedding.dim }
      : null,
    registry,
  });
}
