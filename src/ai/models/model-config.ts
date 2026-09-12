// KhanhOS AI — Model Registry cấu hình được (MODEL_PATH / MODEL_TYPE /
// MODEL_FORMAT / CONTEXT_LENGTH) theo spec: user đổi model không sửa code.
//
// Nguồn cấu hình (gộp theo thứ tự ưu tiên):
// 1. data/ai/models.json — danh sách model user tự khai báo (persist)
// 2. Biến môi trường: MODEL_PATH, MODEL_TYPE, MODEL_FORMAT, CONTEXT_LENGTH
//    (chỉ định 1 model trực tiếp theo spec)
// 3. Runtime thật (Ollama / llama.cpp) — dò tự động
//
// MỖI model khai báo type + format:
// - type: "causal_lm" (sinh văn bản) | "embedding" (nhúng vector)
// - format: "gguf" | "transformers" (safetensors) | "gptq" | "awq" | "bnb"
//   → gguf chạy qua Ollama/llama.cpp; transformers/gptq/awq/bnb chạy qua
//   Python (transformers + auto-gptq / autoawq / bitsandbytes) — xem Training.
// TRUNG THỰC: model khai báo nhưng runtime chưa chạy → trạng thái "unavailable".

import fs from "node:fs";
import path from "node:path";

export interface RegisteredModel {
  id: string;
  name: string;
  modelPath?: string; // đường dẫn file/thư mục model trên đĩa (gguf/safetensors)
  modelType: "causal_lm" | "embedding";
  format: "gguf" | "transformers" | "gptq" | "awq" | "bnb";
  contextLength: number;
  quantization?: string; // vd "Q4_K_M" (gguf) / "4bit" (bnb)
  runtime: "ollama" | "llama-cpp" | "transformers" | "openai-compat";
  notes?: string;
}

const REGISTRY_PATH = path.join(process.cwd(), "data", "ai", "models.json");

const g = globalThis as unknown as { __khanhosModelRegistry?: { at: number; mtime: number; data: RegisteredModel[] } };

function validateModel(m: unknown): RegisteredModel | null {
  if (!m || typeof m !== "object") return null;
  const r = m as Record<string, unknown>;
  const FORMATS: RegisteredModel["format"][] = ["gguf", "transformers", "gptq", "awq", "bnb"];
  const RUNTIMES: RegisteredModel["runtime"][] = ["ollama", "llama-cpp", "transformers", "openai-compat"];
  const TYPES: RegisteredModel["modelType"][] = ["causal_lm", "embedding"];
  if (typeof r.id !== "string" || !r.id.trim()) return null;
  if (typeof r.name !== "string" || !r.name.trim()) return null;
  if (r.modelPath !== undefined && typeof r.modelPath !== "string") return null;
  const modelType = r.modelType as RegisteredModel["modelType"];
  const format = r.format as RegisteredModel["format"];
  const runtime = r.runtime as RegisteredModel["runtime"];
  if (!TYPES.includes(modelType)) return null;
  if (!FORMATS.includes(format)) return null;
  if (!RUNTIMES.includes(runtime)) return null;
  const ctx = Number(r.contextLength);
  return {
    id: r.id.trim(),
    name: r.name.trim().slice(0, 120),
    modelPath: typeof r.modelPath === "string" ? r.modelPath.trim() : undefined,
    modelType,
    format,
    contextLength: Number.isFinite(ctx) && ctx >= 512 && ctx <= 1_048_576 ? Math.round(ctx) : 4096,
    quantization: typeof r.quantization === "string" ? r.quantization.slice(0, 20) : undefined,
    runtime,
    notes: typeof r.notes === "string" ? r.notes.slice(0, 300) : undefined,
  };
}

export function getModelRegistry(): RegisteredModel[] {
  // 1) Từ env (spec: MODEL_PATH / MODEL_TYPE / MODEL_FORMAT / CONTEXT_LENGTH)
  const fromEnv: RegisteredModel[] = [];
  const envPath = process.env.MODEL_PATH;
  if (envPath && envPath.trim()) {
    const format = (process.env.MODEL_FORMAT || "gguf") as RegisteredModel["format"];
    const type = (process.env.MODEL_TYPE || "causal_lm") as RegisteredModel["modelType"];
    const ctx = Number(process.env.CONTEXT_LENGTH || 4096);
    fromEnv.push({
      id: "env:model",
      name: path.basename(envPath) || "Model từ biến môi trường",
      modelPath: envPath,
      modelType: type,
      format,
      contextLength: Number.isFinite(ctx) && ctx > 0 ? ctx : 4096,
      runtime: format === "gguf" ? "llama-cpp" : "transformers",
      notes: "Khai báo qua MODEL_PATH/MODEL_TYPE/MODEL_FORMAT/CONTEXT_LENGTH",
    });
  }

  // 2) Từ file registry persist
  let fileModels: RegisteredModel[] = [];
  try {
    const stat = fs.statSync(REGISTRY_PATH);
    if (!g.__khanhosModelRegistry || g.__khanhosModelRegistry.mtime !== stat.mtimeMs) {
      const raw = fs.readFileSync(REGISTRY_PATH, "utf-8");
      const arr = JSON.parse(raw) as unknown[];
      fileModels = arr.map(validateModel).filter((m): m is RegisteredModel => !!m);
      g.__khanhosModelRegistry = { at: Date.now(), mtime: stat.mtimeMs, data: fileModels };
    } else {
      fileModels = g.__khanhosModelRegistry.data;
    }
  } catch {
    fileModels = [];
  }

  return [...fromEnv, ...fileModels];
}

export function upsertRegisteredModel(model: RegisteredModel): RegisteredModel {
  const valid = validateModel(model);
  if (!valid) throw new Error("Cấu hình model không hợp lệ");
  const all = getModelRegistry().filter((m) => m.id !== "env:model" && m.id !== valid.id);
  all.push(valid);
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  const tmp = `${REGISTRY_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(all, null, 2), "utf-8");
  fs.renameSync(tmp, REGISTRY_PATH);
  return valid;
}

export function removeRegisteredModel(id: string): boolean {
  const all = getModelRegistry().filter((m) => m.id !== "env:model");
  const idx = all.findIndex((m) => m.id === id);
  if (idx === -1) return false;
  all.splice(idx, 1);
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  const tmp = `${REGISTRY_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(all, null, 2), "utf-8");
  fs.renameSync(tmp, REGISTRY_PATH);
  return true;
}
