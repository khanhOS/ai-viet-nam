// KhanhOS AI — Intent Engine: chấm điểm intent khớp nhất với tin nhắn
// Thứ tự tính điểm (theo system.json scoring):
//   exact_pattern 100 → pattern_contain 90 → partial 70 → short 55
//   + FAQ 85, keyword (cap 60), alias (cap 30), topic 15, related 10, followup 25
// Tin nhắn và pattern đều đã đi qua cùng một pipeline normalize.

import type {
  ChatbotData,
  IntentDef,
  ScoredCandidate,
} from "./types";

export interface IntentContext {
  /** các tin nhắn user trước đó (đã chuẩn hoá) trong hội thoại */
  userMsgs: string[];
  /** intent trả lời gần nhất (để gợi ý topic) */
  lastIntent: string | null;
}

// ─────────────────────────────────────────────
// Helper so khớp từ (word-aligned — tránh "ai" lọt vào "kolinux")
// ─────────────────────────────────────────────

/** needle có nằm liền mạch trong haystack (theo từ)? */
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

/** mọi từ của needle đều xuất hiện trong haystack (bất kể thứ tự)? */
function containsAllWords(haystack: string[], needle: string[]): boolean {
  const set = new Set(haystack);
  return needle.every((w) => set.has(w));
}

interface PatternScore {
  score: number;
  reason: string;
  matchedLen: number;
}

function scorePatterns(words: string[], text: string, intent: IntentDef, scoring: ChatbotData["system"]["scoring"]): PatternScore | null {
  let best: PatternScore | null = null;
  for (let idx = 0; idx < intent.patternsWords.length; idx++) {
    const pw = intent.patternsWords[idx];
    const pt = intent.patternsText[idx];
    if (!pw.length) continue;

    let candidate: PatternScore | null = null;
    if (pt === text && words.length) {
      candidate = { score: scoring.exact_pattern, reason: "exact_pattern", matchedLen: pw.length };
    } else if (pw.length <= words.length && containsSubsequence(words, pw)) {
      // pattern 1 từ ngọt (cpu, gpu, vps…) chỉ được điểm thấp khi nằm trong câu dài
      const isShortSingle = pw.length === 1 && pw[0].length <= 3 && words.length > 1;
      candidate = {
        score: isShortSingle ? scoring.short_pattern : scoring.pattern_contain,
        reason: isShortSingle ? "short_pattern" : "pattern_contain",
        matchedLen: pw.length,
      };
    } else if (pw.length >= 2 && containsAllWords(words, pw)) {
      candidate = {
        score: scoring.pattern_contain_partial,
        reason: "pattern_contain_partial",
        matchedLen: pw.length,
      };
    }
    if (candidate && (!best || candidate.score > best.score || (candidate.score === best.score && candidate.matchedLen > best.matchedLen))) {
      best = candidate;
    }
  }
  return best;
}

// ─────────────────────────────────────────────
// Follow-up: khớp kịch bản hội thoại (conversations.json)
// ─────────────────────────────────────────────

function matchFollowup(text: string, userMsgs: string[], data: ChatbotData): { intentId: string; script: string } | null {
  if (!userMsgs.length) return null;
  for (const script of data.conversations) {
    const turns = script.userTurns ?? [];
    for (let i = 1; i < turns.length; i++) {
      const turn = turns[i];
      if (!turn.text || !samePhrase(turn.text, text)) continue;
      // cần ít nhất 1 lượt trước đó khớp liền mạch với cuối history
      for (let j = 0; j < i; j++) {
        const k = i - j; // số lượt lịch sử phải khớp turns[j..i-1]
        if (k > userMsgs.length) continue;
        const suffix = userMsgs.slice(userMsgs.length - k);
        let ok = true;
        for (let m = 0; m < k; m++) {
          if (!samePhrase(turns[j + m].text, suffix[m])) {
            ok = false;
            break;
          }
        }
        if (ok) return { intentId: turn.intentId, script: script.id };
      }
    }
  }
  return null;
}

/** So 2 câu đã chuẩn hoá — bằng nhau, hoặc 1 chứa câu kia (≥ 8 ký tự). */
function samePhrase(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length < b.length ? a : b;
  if (shorter.length >= 8) {
    return a.includes(b) || b.includes(a);
  }
  return false;
}

// ─────────────────────────────────────────────
// API chính
// ─────────────────────────────────────────────

/**
 * Chấm điểm mọi ứng viên intent cho một tin nhắn ĐÃ chuẩn hoá.
 * Trả về danh sách giảm dần theo điểm (chưa lọc threshold — engine sẽ lọc).
 */
export function detectIntents(
  norm: { text: string; words: string[] },
  context: IntentContext | null,
  data: ChatbotData
): ScoredCandidate[] {
  const { text, words } = norm;
  if (!words.length) return [];

  const s = data.system.scoring;
  const scores = new Map<string, ScoredCandidate>();

  const get = (intent: IntentDef): ScoredCandidate => {
    let c = scores.get(intent.id);
    if (!c) {
      c = { intent, score: 0, confidence: 0, reasons: [], matchedLen: 0 };
      scores.set(intent.id, c);
    }
    return c;
  };
  const bump = (c: ScoredCandidate, score: number, reason: string, matchedLen = 0) => {
    c.score += score;
    if (matchedLen > c.matchedLen) c.matchedLen = matchedLen;
    if (!c.reasons.includes(reason)) c.reasons.push(reason);
  };

  // 1) Follow-up theo kịch bản (trước — để cộng điểm vào đúng intent)
  const followup = context ? matchFollowup(text, context.userMsgs, data) : null;

  // 2) Topic đang nói (dựa vào intent trả lời gần nhất)
  let currentTopic: string | null = null;
  if (context?.lastIntent) {
    currentTopic = data.intents.find((i) => i.id === context.lastIntent)?.topic ?? null;
  }

  for (const intent of data.intents) {
    const c = get(intent);

    // pattern
    const p = scorePatterns(words, text, intent, s);
    if (p) {
      bump(c, p.score, p.reason, p.matchedLen);
    }

    // FAQ boost
    for (const q of data.faq) {
      if (q.intent !== intent.id) continue;
      for (const alias of q.aliasesNorm ?? []) {
        if (alias && (alias === text || (alias.length >= 3 && containsSubsequence(words, alias.split(" "))))) {
          bump(c, s.faq_pattern, "faq_pattern", alias.split(" ").length);
          break;
        }
      }
    }

    // keywords — cộng dồn, chặn trên keyword_cap
    let kwScore = 0;
    const kwReasons: Array<[number, string]> = [];
    for (const kw of intent.keywords) {
      if (kw.length === 1) {
        const w = kw[0];
        if (words.includes(w)) {
          kwScore += s.keyword_single;
          kwReasons.push([s.keyword_single, "keyword_single"]);
        } else if (w.length >= 4) {
          // fuzzy: từ bắt đầu bằng keyword (mất vài ký tự cuối)
          if (words.some((msg) => msg.length >= 5 && msg.startsWith(w) && msg.length - w.length <= 3)) {
            kwScore += s.keyword_fuzzy;
            kwReasons.push([s.keyword_fuzzy, "keyword_fuzzy"]);
          }
        }
      } else if (containsSubsequence(words, kw)) {
        kwScore += s.keyword_phrase;
        kwReasons.push([s.keyword_phrase, "keyword_phrase"]);
      }
    }
    if (kwScore > 0) {
      // cộng dồn nhưng không vượt keyword_cap
      let remaining = Math.min(kwScore, s.keyword_cap);
      for (const [pts, reason] of kwReasons) {
        if (remaining <= 0) break;
        const give = Math.min(pts, remaining);
        bump(c, give, reason);
        remaining -= give;
      }
      if (kwScore > s.keyword_cap) c.reasons.push("keyword_cap");
    }

    // aliases
    let aliasScore = 0;
    for (const a of intent.aliases) {
      if (!a) continue;
      const aw = a.split(" ");
      if ((aw.length === 1 && words.includes(aw[0])) || (aw.length > 1 && containsSubsequence(words, aw))) {
        aliasScore += s.alias;
      }
    }
    if (aliasScore > 0) {
      bump(c, Math.min(aliasScore, s.alias_cap), "alias");
    }

    // topic đang nói
    if (currentTopic && intent.topic === currentTopic) {
      bump(c, s.topic_match, "topic_match");
    }
  }

  // 3) Related intent — intent khớp mạnh kéo theo intent liên quan
  for (const c of [...scores.values()]) {
    if (c.score >= s.faq_pattern && c.reasons.some((r) => r.startsWith("pattern") || r === "faq_pattern")) {
      for (const rid of c.intent.relatedIntents) {
        const related = data.intents.find((i) => i.id === rid);
        if (related) {
          const rc = get(related);
          if (rc.score < s.related_intent) {
            bump(rc, s.related_intent - rc.score, "related_intent");
          }
        }
      }
    }
  }

  // 4) Follow-up cộng điểm cho intent do kịch bản chỉ định
  if (followup) {
    const target = data.intents.find((i) => i.id === followup.intentId);
    if (target) {
      const c = get(target);
      const base = Math.max(c.score, s.faq_pattern); // 85
      const bonus = base + s.followup;
      c.score = Math.max(c.score, bonus);
      c.reasons.push(`followup:${followup.script}`);
    }
  }

  // tính confidence + sort
  const out = [...scores.values()];
  for (const c of out) {
    c.score = Math.min(100, Math.max(0, c.score));
    c.confidence = c.score / 100;
  }
  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.matchedLen !== a.matchedLen) return b.matchedLen - a.matchedLen;
    return a.intent.id.localeCompare(b.intent.id);
  });
  return out.filter((c) => c.score > 0);
}
