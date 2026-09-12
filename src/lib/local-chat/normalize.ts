// KhanhOS AI — Chuẩn hoá tin nhắn cho matching
// Pipeline: thường hoá → bỏ dấu tiếng Việt → bỏ ký tự lạ → slang (ko→khong,
// dc→duoc, j→gi, vs→voi…) → terms (triet tri nhan tao→ai, may tinh→computer…)
// → gộp khoảng trắng. Pattern trong data cũng đi qua ĐÚNG pipeline này khi
// nạp (data-loader) nên hai bên luôn so apples-to-apples.

import type { AliasesConfig, EngineLanguage, NormalizedMessage } from "./types";

/** Bỏ dấu tiếng Việt (đ→d, ắ→a…) — giữ chữ thường. */
export function stripDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .normalize("NFC");
}

/** Làm sạch thô: thường hoá, bỏ dấu, chỉ giữ [a-z0-9 ]. */
function cleanBase(input: string): string {
  const stripped = stripDiacritics(input.toLowerCase());
  return stripped.replace(/[^a-z0-9]+/g, " ").trim();
}

const VIETNAMESE_MARKERS = new Set([
  "la", "gi", "khong", "chua", "the", "nao", "sao", "voi", "cho", "minh",
  "ban", "cua", "tai", "khi", "dung", "lam", "giup", "nua", "roi", "day",
  "day", "do", "em", "anh", "chi", "nhe", "nha", "cau", "hoi", "tu", "may",
  "cach", "co", "can", "duoc", "bi", "di", "lam", "biet", "ke", "noi", "them",
]);

const ENGLISH_MARKERS = new Set([
  "what", "how", "why", "who", "when", "where", "which", "is", "are", "can",
  "do", "does", "did", "tell", "explain", "please", "thanks", "thank", "hello",
  "hey", "hi", "bye", "the", "a", "an", "of", "to", "in", "on", "for", "and",
  "or", "with", "about", "you", "your", "my", "me", "and", "it", "that", "this",
]);

const VIETNAMESE_DIACRITIC_RE =
  /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

/**
 * Chuẩn hoá một chuỗi (tin nhắn user HOẶC pattern trong data) về dạng so khớp.
 * Áp slang theo TỪ, terms theo CỤM (dài nhất trước).
 */
export function normalizeText(input: string, aliases: AliasesConfig): string {
  let text = cleanBase(input);
  if (!text) return "";

  // 1) Slang — thay theo từ (an toàn cho từ chứa nó)
  const slang = aliases.slang ?? {};
  if (slang && Object.keys(slang).length) {
    text = text
      .split(" ")
      .map((w) => slang[w] ?? w)
      .join(" ");
  }

  // 2) Terms — thay theo cụm, dài nhất trước, lặp tối đa 3 vòng
  const terms = aliases.terms ?? {};
  const entries = Object.entries(terms).sort(
    (a, b) => b[0].length - a[0].length
  );
  if (entries.length) {
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (const [from, to] of entries) {
        if (!from || !text.includes(from)) continue;
        const re = new RegExp(`(^| )${escapeRegExp(from)}( |$)`, "g");
        const next = text.replace(re, (_m, p1, p2) => `${p1}${to}${p2}`);
        if (next !== text) {
          text = next.replace(/ {2,}/g, " ").trim();
          changed = true;
        }
      }
      if (!changed) break;
    }
  }

  return text.replace(/ {2,}/g, " ").trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Chuẩn hoá toàn bộ tin nhắn — trả về đủ thông tin cho engine.
 * Dùng chung cho: tin nhắn user + pattern/knowledge khi nạp data.
 */
export function normalizeMessage(
  message: string,
  aliases: AliasesConfig,
  maxChars: number
): NormalizedMessage {
  const raw = message.trim().slice(0, Math.max(1, maxChars));
  const text = normalizeText(raw, aliases);
  return {
    raw,
    text,
    words: text ? text.split(" ") : [],
    hasVietnamese: VIETNAMESE_DIACRITIC_RE.test(raw),
    isQuestion: /\?|？/.test(raw) || /^(co|khong)\b/.test(text),
  };
}

/** Đoán ngôn ngữ: ưu tiên dấu tiếng Việt, rồi từ vựng đặc trưng. */
export function detectLanguage(norm: NormalizedMessage): EngineLanguage {
  if (norm.hasVietnamese) return "vi";
  if (!norm.words.length) return "vi";

  let en = 0;
  let vi = 0;
  for (const w of norm.words) {
    if (ENGLISH_MARKERS.has(w)) en++;
    if (VIETNAMESE_MARKERS.has(w)) vi++;
  }
  // "what is ai" → 2 từ EN, 0 từ VN; "ai la gi" → 3 từ VN
  if (en > 0 && en >= vi) return "en";
  return "vi";
}
