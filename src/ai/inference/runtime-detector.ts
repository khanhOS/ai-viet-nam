// KhanhOS AI — Runtime Detector: dò runtime inference local THẬT, cache kết quả.
// Nếu không có runtime nào → engine tự dùng chế độ tri thức cục bộ (rules).

import type { ModelAdapter, LocalModelInfo } from "@/ai/core/types";
import { getAIRuntimeConfig } from "@/ai/core/config";
import { OllamaAdapter } from "@/ai/inference/adapters/ollama-adapter";
import { OpenAICompatAdapter } from "@/ai/inference/adapters/openai-compat-adapter";

export interface RuntimeStatus {
  available: boolean;
  runtime: "ollama" | "openai-compat" | null;
  adapter: ModelAdapter | null;
  defaultModel: LocalModelInfo | null;
  models: LocalModelInfo[];
  checkedAt: number;
  error?: string;
}

// Cache global sống qua HMR (giống pattern engine cũ)
const g = globalThis as unknown as {
  __khanhosRuntimeStatus?: RuntimeStatus;
  __khanhosRuntimeProbeAt?: number;
  __khanhosRuntimeProbing?: Promise<RuntimeStatus> | null;
};

async function probe(
  adapter: ModelAdapter,
  runtime: RuntimeStatus["runtime"]
): Promise<RuntimeStatus> {
  let healthy = await adapter.isHealthy();
  if (!healthy) {
    // Máy 2 CPU có lúc /api/version chậm (đang nạp model) — thử lại 1 lần
    // trước khi kết luận runtime chết, tránh fallback nhầm cho user.
    await new Promise((r) => setTimeout(r, 600));
    healthy = await adapter.isHealthy();
  }
  if (!healthy) {
    return {
      available: false,
      runtime,
      adapter: null,
      defaultModel: null,
      models: [],
      checkedAt: Date.now(),
      error: `Không kết nối được ${runtime} (chạy scripts/setup-ollama.sh để bật)`,
    };
  }
  const models = await adapter.listModels().catch(() => []);
  if (!models.length) {
    return {
      available: false,
      runtime,
      adapter: null,
      defaultModel: null,
      models: [],
      checkedAt: Date.now(),
      error: `${runtime} đang chạy nhưng chưa có model nào (ollama pull qwen2.5:0.5b)`,
    };
  }
  const cfg = getAIRuntimeConfig();
  const defaultModel =
    models.find((m) => m.runtimeName === cfg.defaultModel) ?? models[0];
  return {
    available: true,
    runtime,
    adapter,
    defaultModel,
    models,
    checkedAt: Date.now(),
  };
}

/** Trạng thái runtime hiện tại (cache theo probeCacheMs). */
export async function getRuntimeStatus(force = false): Promise<RuntimeStatus> {
  const cfg = getAIRuntimeConfig();
  const now = Date.now();
  const cached = g.__khanhosRuntimeStatus;

  if (
    !force &&
    cached &&
    now - (g.__khanhosRuntimeProbeAt ?? 0) <
      // Trạng thái SỐNG cache lâu (probeCacheMs); trạng thái CHẾT chỉ cache 5s
      // để lần chat kế tiếp dò lại ngay — không kẹt fallback 15s chỉ vì 1 lần chậm.
      (cached.available ? cfg.probeCacheMs : Math.min(cfg.probeCacheMs, 5000))
  ) {
    return cached;
  }

  // Tránh dồn dập probe khi nhiều request đến cùng lúc
  if (g.__khanhosRuntimeProbing) return g.__khanhosRuntimeProbing;

  const p = (async (): Promise<RuntimeStatus> => {
    let status: RuntimeStatus = {
      available: false,
      runtime: null,
      adapter: null,
      defaultModel: null,
      models: [],
      checkedAt: now,
      error:
        cfg.mode === "none"
          ? "AI_RUNTIME=none — đã tắt model cục bộ theo cấu hình"
          : "Chưa có runtime model cục bộ nào",
    };

    if (cfg.mode === "none") {
      // chủ sở hữu chủ động tắt
    } else if (cfg.mode === "ollama") {
      status = await probe(new OllamaAdapter(), "ollama");
    } else if (cfg.mode === "openai-compat") {
      status = await probe(new OpenAICompatAdapter(), "openai-compat");
    } else {
      // auto: thử Ollama trước (chuẩn nhất), rồi openai-compat
      status = await probe(new OllamaAdapter(), "ollama");
      if (!status.available) {
        const alt = await probe(new OpenAICompatAdapter(), "openai-compat");
        if (alt.available) status = alt;
      }
    }

    g.__khanhosRuntimeStatus = status;
    g.__khanhosRuntimeProbeAt = Date.now();
    return status;
  })();

  g.__khanhosRuntimeProbing = p;
  const result = await p;
  g.__khanhosRuntimeProbing = null;
  return result;
}

/** Coi request vừa nhận dấu hiệu runtime up lại → probe lại ngay. */
export function invalidateRuntimeCache(): void {
  g.__khanhosRuntimeStatus = undefined;
  g.__khanhosRuntimeProbeAt = 0;
}
