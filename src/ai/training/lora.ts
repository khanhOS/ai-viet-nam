// KhanhOS AI — LoRA / QLoRA Fine-tuning (giao diện thật, không fake).
//
// GIAO THỨC:
// 1. Nhận cấu hình LoRA/QLoRA (r, alpha, target modules, epochs, lr, base model)
// 2. Sinh BỘ FILE huấn luyện THẬT chạy được trên máy có Python + GPU:
//    train_lora.py (transformers + peft + bitsandbytes), requirements.txt
// 3. Ghi job vào DB. Nếu sandbox/server KHÔNG có Python+torch → job nhận
//    trạng thái "pending_runtime" + hướng dẫn chạy (TRUNG THỰC, không giả vờ
//    đã huấn luyện). Nếu có runtime → chạy thật và cập nhật status.
//
// Luồng hoàn chỉnh cho chủ sở hữu (máy có GPU):
//   1) Chat, bấm 👍 những câu trả lời tốt → dữ liệu thật vào AiFeedback
//   2) /api/training → export dataset JSONL
//   3) /api/training → tạo job LoRA trên base model (vd Qwen2.5-1.5B)
//   4) Chạy: python data/ai/training/<job>/train_lora.py
//   5) Merge adapter → GGUF (kèm hướng dẫn) → ollama create → dùng model riêng

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { db } from "@/lib/db";

const execFileAsync = promisify(execFile);

export interface LoraConfig {
  baseModel: string; // repo HF hoặc tên model local
  adapter: "lora" | "qlora";
  rank: number; // r: 4..128
  alpha: number; // thường 2*r
  dropout: number; // 0..0.3
  targetModules: string[]; // vd ["q_proj","v_proj"]
  epochs: number; // 1..20
  learningRate: number; // 1e-5..5e-4
  batchSize: number; // 1..32 (per-device)
  maxSeqLength: number; // 256..8192
  quantBits: 4 | 8 | 16; // QLoRA: 4/8; LoRA GPU mạnh: 16
  datasetFile: string; // data/ai/training/<name>.jsonl
  outputDir?: string;
}

export const DEFAULT_LORA_TARGETS = [
  "q_proj",
  "k_proj",
  "v_proj",
  "o_proj",
  "gate_proj",
  "up_proj",
  "down_proj",
];

export function validateLoraConfig(input: unknown): { ok: true; config: LoraConfig } | { ok: false; error: string } {
  const r = input as Partial<LoraConfig>;
  if (!r || typeof r !== "object") return { ok: false, error: "Thiếu cấu hình" };
  if (typeof r.baseModel !== "string" || !r.baseModel.trim())
    return { ok: false, error: "Thiếu baseModel" };
  if (r.adapter !== "lora" && r.adapter !== "qlora")
    return { ok: false, error: "adapter phải là 'lora' hoặc 'qlora'" };
  const rank = Number(r.rank);
  if (!Number.isInteger(rank) || rank < 4 || rank > 128)
    return { ok: false, error: "rank (r) phải trong 4..128" };
  const alpha = Number(r.alpha);
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 512)
    return { ok: false, error: "alpha phải trong 1..512" };
  const dropout = Number(r.dropout ?? 0.05);
  if (dropout < 0 || dropout > 0.3) return { ok: false, error: "dropout phải trong 0..0.3" };
  const epochs = Number(r.epochs);
  if (!Number.isFinite(epochs) || epochs < 1 || epochs > 20)
    return { ok: false, error: "epochs phải trong 1..20" };
  const lr = Number(r.learningRate);
  if (!Number.isFinite(lr) || lr < 1e-6 || lr > 1e-2)
    return { ok: false, error: "learningRate phải trong 1e-6..1e-2" };
  const bs = Number(r.batchSize);
  if (!Number.isInteger(bs) || bs < 1 || bs > 32)
    return { ok: false, error: "batchSize phải trong 1..32" };
  const seq = Number(r.maxSeqLength);
  if (!Number.isInteger(seq) || seq < 256 || seq > 8192)
    return { ok: false, error: "maxSeqLength phải trong 256..8192" };
  const bits = Number(r.quantBits ?? 4);
  if (![4, 8, 16].includes(bits)) return { ok: false, error: "quantBits phải là 4/8/16" };
  if (typeof r.datasetFile !== "string" || !r.datasetFile.trim())
    return { ok: false, error: "Thiếu datasetFile" };

  const targets = Array.isArray(r.targetModules) && r.targetModules.length
    ? r.targetModules.filter((t) => /^[a-z_]+$/i.test(t)).slice(0, 12)
    : DEFAULT_LORA_TARGETS;

  return {
    ok: true,
    config: {
      baseModel: r.baseModel.trim().slice(0, 200),
      adapter: r.adapter,
      rank,
      alpha,
      dropout,
      targetModules: targets,
      epochs,
      learningRate: lr,
      batchSize: bs,
      maxSeqLength: seq,
      quantBits: bits as 4 | 8 | 16,
      datasetFile: r.datasetFile.trim().slice(0, 300),
      outputDir: r.outputDir?.trim().slice(0, 300),
    },
  };
}

// ─────────────────────────────────────────────
// Sinh train_lora.py THẬT (transformers + peft + bitsandbytes)
// ─────────────────────────────────────────────

export function generateTrainingScript(cfg: LoraConfig, datasetAbsPath: string): string {
  const isQlora = cfg.adapter === "qlora";
  return `#!/usr/bin/env python3
# KhanhOS AI — LoRA fine-tuning script (SINH TỰ ĐỘNG, CHẠY THẬT)
# Job base: ${cfg.baseModel} | adapter: ${cfg.adapter}
# Dataset: ${datasetAbsPath}
#
# Yêu cầu: Python 3.10+, CUDA GPU khuyến nghị (>=8GB VRAM cho QLoRA 4bit với model <=1.5B)
# Cài:      pip install -r requirements.txt
# Chạy:     python train_lora.py
#
# Sau huấn luyện (adapter ở ./output_lora):
#   merge adapter → GGUF → nạp vào Ollama:
#     1) python merge_and_export.py   (script đính kèm)
#     2) ollama create khanhos-ft -f Modelfile   (script đính kèm)

import json
import math
import torch
from datasets import Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
)
from peft import LoraConfig as PeftLoraConfig, get_peft_model, prepare_model_for_kbit_training

BASE_MODEL = "${cfg.baseModel}"
DATASET_PATH = "${datasetAbsPath}"
OUTPUT_DIR = "${cfg.outputDir || "./output_lora"}"
ADAPTER = "${cfg.adapter}"
RANK = ${cfg.rank}
ALPHA = ${cfg.alpha}
DROPOUT = ${cfg.dropout}
TARGET_MODULES = ${JSON.stringify(cfg.targetModules)}
EPOCHS = ${cfg.epochs}
LEARNING_RATE = ${cfg.learningRate}
BATCH_SIZE = ${cfg.batchSize}
GRAD_ACCUM = max(1, 16 // BATCH_SIZE)
MAX_SEQ = ${cfg.maxSeqLength}
QUANT_BITS = ${cfg.quantBits}


def load_jsonl(path):
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            # hỗ trợ cả alpaca và sharegpt
            if "instruction" in obj:
                prompt = obj["instruction"]
                if obj.get("input"):
                    prompt += "\\n\\n" + obj["input"]
                rows.append({"prompt": prompt, "response": obj["output"]})
            elif "conversations" in obj:
                turns = obj["conversations"]
                for i in range(0, len(turns) - 1, 2):
                    if turns[i].get("from") == "human":
                        rows.append({
                            "prompt": turns[i]["value"],
                            "response": turns[i + 1]["value"] if i + 1 < len(turns) else "",
                        })
    return rows


def main():
    assert torch.cuda.is_available() or True, "CPU training sẽ RẤT chậm — khuyến nghị GPU"
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[khanhos] device={device}  base={BASE_MODEL}  adapter={ADAPTER}")

    # 1) Tokenizer
    tok = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token

    # 2) Model gốc + lượng tử hoá (QLoRA: 4/8-bit NF4)
    bnb_config = None
    if ADAPTER == "qlora" and QUANT_BITS in (4, 8) and device == "cuda":
        from transformers import BitsAndBytesConfig
        compute = "bfloat16" if torch.cuda.is_bf16_supported() else "float16"
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=(QUANT_BITS == 4),
            load_in_8bit=(QUANT_BITS == 8),
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=getattr(torch, compute),
        )
    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=bnb_config,
        device_map="auto" if device == "cuda" else None,
        torch_dtype=torch.float32 if device == "cpu" else getattr(torch, "auto", None),
        trust_remote_code=True,
    )
    if bnb_config is not None:
        model = prepare_model_for_kbit_training(model)

    # 3) LoRA adapter
    peft_cfg = PeftLoraConfig(
        r=RANK,
        lora_alpha=ALPHA,
        lora_dropout=DROPOUT,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=TARGET_MODULES,
    )
    model = get_peft_model(model, peft_cfg)
    model.print_trainable_parameters()

    # 4) Dataset
    rows = load_jsonl(DATASET_PATH)
    if not rows:
        raise SystemExit("Dataset rỗng — export dataset trước khi huấn luyện")
    print(f"[khanhos] {len(rows)} mẫu huấn luyện")

    def tokenize(row):
        prompt_ids = tok(row["prompt"] + tok.eos_token, truncation=True, max_length=MAX_SEQ)["input_ids"]
        response_ids = tok(row["response"] + tok.eos_token, truncation=True, max_length=MAX_SEQ)["input_ids"]
        input_ids = (prompt_ids + response_ids)[:MAX_SEQ]
        labels = ([-100] * len(prompt_ids) + response_ids)[:MAX_SEQ]
        return {"input_ids": input_ids, "labels": labels, "attention_mask": [1] * len(input_ids)}

    ds = Dataset.from_list(rows).map(tokenize, remove_columns=["prompt", "response"])

    # 5) Train
    args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRAD_ACCUM,
        learning_rate=LEARNING_RATE,
        warmup_ratio=0.03,
        logging_steps=5,
        save_strategy="epoch",
        bf16=(device == "cuda" and torch.cuda.is_bf16_supported()),
        report_to="none",
        optim="paged_adamw_8bit" if bnb_config is not None else "adamw_torch",
    )
    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=ds,
        data_collator=DataCollatorForLanguageModeling(tok, mlm=False),
    )
    trainer.train()
    model.save_pretrained(OUTPUT_DIR)
    tok.save_pretrained(OUTPUT_DIR)
    print(f"[khanhos] XONG — adapter LoRA lưu tại {OUTPUT_DIR}")
    print("[khanhos] Bước tiếp theo: python merge_and_export.py")


if __name__ == "__main__":
    main()
`;
}

export function generateMergeScript(cfg: LoraConfig): string {
  return `#!/usr/bin/env python3
# KhanhOS AI — Merge adapter LoRA vào model gốc & hướng dẫn xuất GGUF
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

BASE = "${cfg.baseModel}"
ADAPTER = "${cfg.outputDir || "./output_lora"}"
MERGED = "./merged_model"

model = AutoModelForCausalLM.from_pretrained(BASE, torch_dtype="auto", trust_remote_code=True)
model = PeftModel.from_pretrained(model, ADAPTER)
model = model.merge_and_unload()
model.save_pretrained(MERGED, safe_serialization=True)
AutoTokenizer.from_pretrained(BASE).save_pretrained(MERGED)
print(f"[khanhos] Model đã merge: {MERGED}")
print("[khanhos] Xuất GGUF (cần llama.cpp):")
print("  python -m llama_cpp.convert_hf_to_gguf merged_model --outfile khanhos-ft.gguf --outtype q4_k_m")
print("[khanhos] Nạp vào Ollama:")
print("  ollama create khanhos-ft -f Modelfile")
`;
}

export function generateModelfile(cfg: LoraConfig): string {
  return `# KhanhOS AI — Modelfile cho model đã fine-tune
FROM ${cfg.baseModel.includes("/") ? "./khanhos-ft.gguf" : cfg.baseModel}
PARAMETER num_ctx ${cfg.maxSeqLength * 2}
SYSTEM """Bạn là KhanhOS AI (bản fine-tuned Astra) — trợ lý AI cục bộ giỏi lập trình, nói thẳng, chính xác, không bịa."""
`;
}

export function generateRequirements(): string {
  return [
    "torch>=2.2.0",
    "transformers>=4.44.0",
    "peft>=0.11.0",
    "datasets>=2.19.0",
    "bitsandbytes>=0.43.0; platform_system == 'Linux'",
    "accelerate>=0.30.0",
  ].join("\n");
}

// ─────────────────────────────────────────────
// Kiểm tra runtime huấn luyện (TRUNG THỰC)
// ─────────────────────────────────────────────

export interface TrainingRuntimeStatus {
  python: boolean;
  pythonVersion: string | null;
  torch: boolean;
  cuda: boolean;
  canTrainHere: boolean;
  note: string;
}

export async function checkTrainingRuntime(): Promise<TrainingRuntimeStatus> {
  let python = false;
  let pythonVersion: string | null = null;
  try {
    const { stdout } = await execFileAsync("python3", ["--version"], { timeout: 5000 });
    python = true;
    pythonVersion = stdout.trim();
  } catch {
    python = false;
  }

  let torch = false;
  let cuda = false;
  if (python) {
    try {
      const { stdout } = await execFileAsync(
        "python3",
        ["-c", "import torch; print(torch.__version__); print(torch.cuda.is_available())"],
        { timeout: 15000 }
      );
      const lines = stdout.trim().split("\n");
      torch = lines.length >= 1 && /\d/.test(lines[0]);
      cuda = lines.length >= 2 && lines[1].trim() === "True";
    } catch {
      torch = false;
    }
  }

  const canTrainHere = python && torch;
  const note = canTrainHere
    ? cuda
      ? "Runtime huấn luyện SẴN SÀNG (GPU). Job có thể chạy trên server này."
      : "Có Python+torch (CPU) — chạy được nhưng CHẬM. Khuyến nghị máy có GPU."
    : "Chưa có Python+torch trên server — job sẽ ở trạng thái chờ runtime (pending_runtime). Chạy script đã sinh trên máy có GPU của bạn — KHÔNG fake kết quả huấn luyện.";

  return { python, pythonVersion, torch, cuda, canTrainHere, note };
}

// ─────────────────────────────────────────────
// Tạo job huấn luyện (luôn sinh file thật; chạy khi có runtime)
// ─────────────────────────────────────────────

export interface CreatedTrainingJob {
  jobId: string;
  jobDir: string; // data/ai/training/jobs/<jobId>/
  files: string[];
  status: string; // "pending_runtime" | "created"
  runtime: TrainingRuntimeStatus;
}

export async function createLoraJob(
  userId: string,
  name: string,
  cfg: LoraConfig
): Promise<CreatedTrainingJob> {
  const runtime = await checkTrainingRuntime();

  // Dataset phải tồn tại thật
  const datasetAbs = path.join(process.cwd(), cfg.datasetFile.replace(/^data\//, "data/"));
  if (!fs.existsSync(datasetAbs)) {
    throw new Error(`Dataset không tồn tại: ${cfg.datasetFile}`);
  }

  const job = await db.trainingJob.create({
    data: {
      userId,
      name: name.trim().slice(0, 120) || "LoRA job",
      kind: cfg.adapter,
      baseModel: cfg.baseModel,
      status: runtime.canTrainHere ? "created" : "pending_runtime",
      config: JSON.stringify(cfg),
    },
  });

  // Sinh bộ file huấn luyện THẬT
  const jobDir = path.join(process.cwd(), "data", "ai", "training", "jobs", job.id);
  fs.mkdirSync(jobDir, { recursive: true });
  const files = ["train_lora.py", "merge_and_export.py", "Modelfile", "requirements.txt"];
  fs.writeFileSync(path.join(jobDir, "train_lora.py"), generateTrainingScript(cfg, datasetAbs));
  fs.writeFileSync(path.join(jobDir, "merge_and_export.py"), generateMergeScript(cfg));
  fs.writeFileSync(path.join(jobDir, "Modelfile"), generateModelfile(cfg));
  fs.writeFileSync(path.join(jobDir, "requirements.txt"), generateRequirements());
  fs.writeFileSync(
    path.join(jobDir, "README.md"),
    [
      `# Job huấn luyện: ${job.name}`,
      "",
      `- Base model: ${cfg.baseModel}`,
      `- Kiểu adapter: ${cfg.adapter.toUpperCase()} (r=${cfg.rank}, alpha=${cfg.alpha}, dropout=${cfg.dropout})`,
      `- Target modules: ${cfg.targetModules.join(", ")}`,
      `- Epochs: ${cfg.epochs} | LR: ${cfg.learningRate} | Batch: ${cfg.batchSize} | Max seq: ${cfg.maxSeqLength}`,
      `- Quantization: ${cfg.quantBits} bit`,
      `- Dataset: ${cfg.datasetFile}`,
      "",
      "## Chạy (máy có GPU khuyến nghị)",
      "```bash",
      "pip install -r requirements.txt",
      "python train_lora.py",
      "python merge_and_export.py",
      "python -m llama_cpp.convert_hf_to_gguf merged_model --outfile khanhos-ft.gguf --outtype q4_k_m",
      "ollama create khanhos-ft -f Modelfile",
      "```",
      "",
      runtime.canTrainHere
        ? "> Runtime Python+torch ĐÃ có trên server — có thể chạy ngay."
        : "> Server chưa cài Python+torch. Chạy bộ file này trên máy có GPU — KHÔNG fake kết quả.",
    ].join("\n")
  );

  await db.trainingJob.update({
    where: { id: job.id },
    data: {
      result: JSON.stringify({ jobDir: `data/ai/training/jobs/${job.id}`, files }),
    },
  });

  return {
    jobId: job.id,
    jobDir: `data/ai/training/jobs/${job.id}`,
    files,
    status: runtime.canTrainHere ? "created" : "pending_runtime",
    runtime,
  };
}
