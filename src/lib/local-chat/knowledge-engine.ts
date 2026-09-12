// KhanhOS AI — Knowledge Engine: tra tri thức khi KHÔNG có intent nào khớp
// Tìm entry knowledge (data/chatbot/knowledge/*.json) theo keyword/alias/title.
// Chỉ dùng khi intent match thất bại — để trả lời được cả câu hỏi "ngoài lề"
// mà vẫn trung thực (không bịa).

import type { ChatbotData, KnowledgeEntry } from "./types";

export interface KnowledgeMatch {
  entry: KnowledgeEntry;
  score: number; // 0..100
  confidence: number;
}

function wordsContain(haystack: string[], needle: string[]): boolean {
  const set = new Set(haystack);
  return needle.every((w) => set.has(w));
}

function containsSubsequence(haystack: string[], needle: string[]): boolean {
  if (!needle.length || needle.length > haystack.length) return false;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * Tìm entry knowledge khớp — trả về null nếu không đủ mạnh (< threshold).
 * Điểm: keyword phrase 30/keyword đơn 15, alias 20, title trùng từ 15 (cap 100).
 */
export function searchKnowledge(
  norm: { text: string; words: string[] },
  data: ChatbotData
): KnowledgeMatch | null {
  if (!norm.words.length) return null;
  const threshold = Math.round(data.system.engine.default_threshold * 100); // ~60

  let best: KnowledgeMatch | null = null;
  for (const entry of data.knowledge) {
    let score = 0;
    const w = norm.words;

    for (const kw of entry.keywordsNorm ?? []) {
      if (kw.length === 1) {
        if (w.includes(kw[0])) score += 15;
      } else if (containsSubsequence(w, kw)) {
        score += 30;
      }
    }
    for (const alias of entry.aliasesNorm ?? []) {
      const aw = alias.split(" ");
      if (alias === norm.text || containsSubsequence(w, aw)) score += 20;
    }
    const titleWords = (entry.titleNorm ?? "").split(" ").filter(Boolean);
    if (titleWords.length >= 2 && wordsContain(w, titleWords.slice(0, 3))) score += 15;

    score = Math.min(100, score);
    if (score >= threshold && (!best || score > best.score)) {
      best = { entry, score, confidence: score / 100 };
    }
  }
  return best;
}

/** Dựng câu trả lời từ entry knowledge (định dạng markdown gọn). */
export function renderKnowledge(entry: KnowledgeEntry): string {
  const parts: string[] = [];
  const c = entry.content ?? {};

  if (typeof c.definition === "string" && c.definition) parts.push(c.definition);
  if (typeof c.simple_explanation === "string" && c.simple_explanation) {
    parts.push(c.simple_explanation);
  }
  if (Array.isArray(c.examples) && c.examples.length) {
    parts.push("Ví dụ:\n" + c.examples.slice(0, 5).map((e) => `- ${e}`).join("\n"));
  }
  if (Array.isArray(c.related_topics) && c.related_topics.length) {
    parts.push(`Chủ đề liên quan: ${c.related_topics.slice(0, 6).join(", ")}`);
  }
  if (!parts.length) {
    // fallback: trả title nếu nội dung rỗng
    parts.push(entry.title);
  }
  return parts.join("\n\n");
}
