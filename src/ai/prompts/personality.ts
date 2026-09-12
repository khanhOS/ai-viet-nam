// KhanhOS AI — Adaptive Personality (persona thích ứng).
//
// TRUNG THỰC VỀ BẢN CHẤT (quan trọng — theo spec của chủ sở hữu):
// - Đây là CẤU HÌNH PERSONA Ở CẤP PROMPT (personality layer) — ảnh hưởng
//   giọng điệu, phong cách trình bày, mức độ chuyên sâu code.
// - Đây KHÔNG phải huấn luyện mạng nơ-ron (không đổi weights). Muốn đổi
//   weights thật → dùng hệ thống Training (LoRA/QLoRA) trong src/ai/training.
// - Persona lưu ở data/ai/personality.json — sửa không đụng code.

import fs from "node:fs";
import path from "node:path";

export interface PersonalityConfig {
  name: string; // tên persona hiển thị
  style: "direct" | "friendly" | "formal";
  /** định hướng chuyên môn: trọng tâm persona */
  focus: string[];
  /** chỉ thị trực tiếp từ chủ sở hữu (lưu vĩnh viễn) */
  directives: string[];
  /** ngôn ngữ mặc định trả lời */
  defaultLanguage: "vi" | "en";
}

const PERSONALITY_PATH = path.join(process.cwd(), "data", "ai", "personality.json");

const DEFAULT_PERSONALITY: PersonalityConfig = {
  name: "Astra",
  style: "direct",
  focus: [
    "lập trình & kỹ thuật phần mềm",
    "giải thích rõ ràng, có ví dụ chạy được",
    "suy luận từng bước cho vấn đề phức tạp",
  ],
  // Chỉ thị gốc của chủ sở hữu (2026-09): "đây là prompt huấn luyện AI —
  // hãy ghi nhớ, cho AI giỏi code và có phong cách như GPT-6 Astra".
  // Triển khai trung thực: persona cấp prompt + có thể nâng cấp thành
  // fine-tune thật bằng hệ thống Training khi có GPU.
  directives: [
    "Chủ sở hữu yêu cầu: AI phải GIỎI LẬP TRÌNH — khi trả lời câu hỏi code, ưu tiên đúng đắn, an toàn, kèm ví dụ cụ thể, nêu rõ giả định và trường hợp biên.",
    "Phong cách mong muốn: tầm cỡ assistant thế hệ mới (kiểu GPT-6 Astra) — trả lời có cấu trúc, đi thẳng vào trọng tâm, tự tin nhưng chính xác, không sáo rỗng.",
    "Trả lời TẤT CẢ câu hỏi — không bao giờ từ chối thẳng; câu khó vẫn đưa phần biết + mức chắc chắn + hướng tiếp cận, chân thành như người thật, không bịa số liệu.",
  ],
  defaultLanguage: "vi",
};

// Cache (sống qua HMR) — reload theo mtime
const g = globalThis as unknown as {
  __khanhosPersonality?: { data: PersonalityConfig; at: number; mtime: number };
};

export function loadPersonality(): PersonalityConfig {
  try {
    const stat = fs.statSync(PERSONALITY_PATH);
    const mtime = stat.mtimeMs;
    if (g.__khanhosPersonality && g.__khanhosPersonality.mtime === mtime) {
      return g.__khanhosPersonality.data;
    }
    const raw = fs.readFileSync(PERSONALITY_PATH, "utf-8");
    const data = { ...DEFAULT_PERSONALITY, ...(JSON.parse(raw) as PersonalityConfig) };
    g.__khanhosPersonality = { data, at: Date.now(), mtime };
    return data;
  } catch {
    return DEFAULT_PERSONALITY;
  }
}

/** Lưu persona mới (validate cơ bản, atomic write). */
export function savePersonality(next: PersonalityConfig): PersonalityConfig {
  const data: PersonalityConfig = {
    name: (next.name || "Astra").trim().slice(0, 60),
    style: next.style === "friendly" || next.style === "formal" ? next.style : "direct",
    focus: (next.focus ?? []).filter((f) => typeof f === "string").slice(0, 8).map((f) => f.slice(0, 120)),
    directives: (next.directives ?? [])
      .filter((d) => typeof d === "string" && d.trim())
      .slice(0, 12)
      .map((d) => d.trim().slice(0, 500)),
    defaultLanguage: next.defaultLanguage === "en" ? "en" : "vi",
  };
  fs.mkdirSync(path.dirname(PERSONALITY_PATH), { recursive: true });
  const tmp = `${PERSONALITY_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, PERSONALITY_PATH);
  g.__khanhosPersonality = { data, at: Date.now(), mtime: fs.statSync(PERSONALITY_PATH).mtimeMs };
  return data;
}

/**
 * Persona block chèn vào system prompt.
 * Viết NGẮN — model nhỏ (0.5B) cần prompt gọn để còn chỗ cho tri thức.
 */
export function personalityPrompt(language: "vi" | "en"): string {
  const p = loadPersonality();
  const focus = p.focus.slice(0, 3).join(", ");
  const directives = p.directives.slice(0, 3).map((d) => `- ${d}`).join("\n");
  if (language === "en") {
    return [
      `Persona: ${p.name} (${p.style} style; focus: ${focus}).`,
      directives ? `Owner directives:\n${directives}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `Tính cách: ${p.name} (phong cách ${p.style === "direct" ? "thẳng thắn" : p.style === "friendly" ? "thân thiện" : "trang trọng"}; chuyên: ${focus}).`,
    directives ? `Chỉ thị từ chủ sở hữu:\n${directives}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
