// KhanhOS AI — Response Engine: chọn câu trả lời từ responses/*.json
// Xoay vòng (round-robin) theo response_id: regenerate sẽ ra BIẾN THỂ KHÁC,
// không lặp lại đúng câu vừa nói. Fallback cũng xoay vòng cho đỡ nhàm chán.

import type { ChatbotData, EngineLanguage } from "./types";

const g = globalThis as unknown as { __khanhosRespPicks?: Map<string, number> };

function counters(): Map<string, number> {
  if (!g.__khanhosRespPicks) g.__khanhosRespPicks = new Map();
  return g.__khanhosRespPicks;
}

function nextIndex(key: string): number {
  const map = counters();
  const n = map.get(key) ?? 0;
  map.set(key, n + 1);
  return n;
}

/** Chọn 1 biến thể trả lời cho response_id + ngôn ngữ (ưu tiên vi). */
export function pickResponse(
  data: ChatbotData,
  responseId: string,
  lang: EngineLanguage
): string | null {
  const entry = data.responses[responseId];
  if (!entry) return null;
  const variants =
    (lang === "en" ? entry.en ?? entry.vi : entry.vi ?? entry.en) ?? [];
  if (!variants.length) return null;
  if (variants.length === 1) return variants[0];
  const idx = nextIndex(`${lang}:${responseId}`);
  return variants[idx % variants.length];
}

/** Câu fallback khi không có kiến thức — xoay vòng, đúng ngôn ngữ. */
export function fallbackResponse(data: ChatbotData, lang: EngineLanguage): string {
  const list =
    (lang === "en"
      ? data.system.fallback.responses_en.length
        ? data.system.fallback.responses_en
        : data.system.fallback.responses
      : data.system.fallback.responses) ?? [];
  if (!list.length) return "Mình chưa có kiến thức local cho câu hỏi này.";
  if (list.length === 1) return list[0];
  const idx = nextIndex(`__fallback__:${lang}`);
  return list[idx % list.length];
}

/** Gợi ý chủ đề khi bot bó tay (hoặc kèm theo câu trả lời). */
export function topicSuggestions(data: ChatbotData): string[] {
  const max = data.system.fallback.max_suggestions ?? 3;
  return data.topics
    .slice(0, max)
    .map((t) => `${t.name} — ${(t.description ?? "").trim()}`.trim())
    .filter(Boolean);
}
