// KhanhOS AI — Dataset Manager (quản lý tập dữ liệu huấn luyện THẬT).
//
// Nguồn dữ liệu: AiFeedback 👍 (cặp hỏi–đáp user đánh giá TỐT) + cặp hội thoại
// mẫu do chủ sở hữu thêm tay. Mọi mẫu đều có nguồn gốc rõ ràng — không bịa.
//
// Xuất JSONL 2 định dạng chuẩn (chạy được với tools thật: axolotl, llama-factory,
// unsloth, peft):
// - "alpaca": {"instruction", "input", "output"}
// - "sharegpt": {"conversations": [{"from": "human"|"gpt", "value"}]}
//
// TRUNG THỰC: dataset là ĐẦU VÀO huấn luyện. Việc huấn luyện thật cần
// runtime Python + torch (xem src/ai/training/lora.ts) — không fake kết quả.

import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";

export interface TrainingPair {
  instruction: string; // câu hỏi user
  output: string; // câu trả lời AI đã được user 👍
  source: string; // "feedback:<id>" | "manual"
  createdAt: string;
}

export interface DatasetStats {
  name: string;
  file: string;
  pairs: number;
  sizeBytes: number;
  createdAt: string;
}

const DATASET_DIR = path.join(process.cwd(), "data", "ai", "training");
const MAX_PAIRS_PER_DATASET = 20_000;
const MAX_TEXT_CHARS = 6000;

/** Thu thập cặp hỏi–đáp từ feedback 👍 của MỌI user (chủ sở hữu gọi). */
export async function collectFeedbackPairs(): Promise<TrainingPair[]> {
  const feedbacks = await db.aiFeedback.findMany({
    where: { rating: "up" },
    orderBy: { createdAt: "asc" },
    take: MAX_PAIRS_PER_DATASET,
    select: { id: true, question: true, answer: true, createdAt: true },
  });
  return feedbacks
    .filter((f) => f.question.trim().length >= 3 && f.answer.trim().length >= 3)
    .map((f) => ({
      instruction: f.question.trim().slice(0, MAX_TEXT_CHARS),
      output: f.answer.trim().slice(0, MAX_TEXT_CHARS),
      source: `feedback:${f.id}`,
      createdAt: f.createdAt.toISOString(),
    }));
}

export function toAlpacaJsonl(pairs: TrainingPair[]): string {
  return pairs
    .map((p) =>
      JSON.stringify({
        instruction: p.instruction,
        input: "",
        output: p.output,
      })
    )
    .join("\n");
}

export function toSharegptJsonl(pairs: TrainingPair[]): string {
  return pairs
    .map((p) =>
      JSON.stringify({
        conversations: [
          { from: "human", value: p.instruction },
          { from: "gpt", value: p.output },
        ],
      })
    )
    .join("\n");
}

/** Xuất dataset ra file JSONL. Trả đường dẫn file THẬT + số mẫu. */
export function exportDataset(
  pairs: TrainingPair[],
  format: "alpaca" | "sharegpt",
  name: string
): { file: string; pairs: number; sizeBytes: number } {
  if (!pairs.length) throw new Error("Không có mẫu nào để xuất dataset");
  const safeName = (name || "dataset")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "dataset";
  const jsonl = format === "alpaca" ? toAlpacaJsonl(pairs) : toSharegptJsonl(pairs);
  fs.mkdirSync(DATASET_DIR, { recursive: true });
  const file = path.join(DATASET_DIR, `${safeName}.jsonl`);
  fs.writeFileSync(file, jsonl, "utf-8");
  return { file, pairs: pairs.length, sizeBytes: Buffer.byteLength(jsonl) };
}

/** Liệt kê dataset đã xuất (file thật trong data/ai/training). */
export function listDatasets(): DatasetStats[] {
  try {
    const files = fs.readdirSync(DATASET_DIR).filter((f) => f.endsWith(".jsonl"));
    return files.map((f) => {
      const full = path.join(DATASET_DIR, f);
      const stat = fs.statSync(full);
      const content = fs.readFileSync(full, "utf-8");
      const pairs = content.split("\n").filter((l) => l.trim()).length;
      return {
        name: f.replace(/\.jsonl$/, ""),
        file: `data/ai/training/${f}`,
        pairs,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    });
  } catch {
    return [];
  }
}

/** Xoá dataset theo tên. */
export function deleteDataset(name: string): boolean {
  const safe = path.basename(name);
  const file = path.join(DATASET_DIR, `${safe}.jsonl`);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}
