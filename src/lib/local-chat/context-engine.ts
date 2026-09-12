// KhanhOS AI — Context Engine: trí nhớ hội thoại multi-turn
// - Lưu tin nhắn user (đã chuẩn hoá) + intent trả lời gần nhất theo conversationId
// - Dùng cho: follow-up theo kịch bản (conversations.json), topic đang nói
// - Cache trong globalThis (an toàn HMR), TTL + số entry giới hạn theo system.json

import type { ChatbotData } from "./types";
import { normalizeText } from "./normalize";

export interface ConversationState {
  userMsgs: string[]; // các tin nhắn user (đã chuẩn hoá), mới nhất ở cuối
  lastIntent: string | null; // intent trả lời gần nhất
  updatedAt: number;
}

const g = globalThis as unknown as {
  __khanhosChatContext?: Map<string, ConversationState>;
};

function store(): Map<string, ConversationState> {
  if (!g.__khanhosChatContext) {
    g.__khanhosChatContext = new Map();
  }
  return g.__khanhosChatContext;
}

function prune(data: ChatbotData) {
  const map = store();
  const now = Date.now();
  const ttl = data.system.context.ttl_ms ?? 6 * 3600 * 1000;
  const maxEntries = data.system.context.max_entries ?? 500;
  // xoá theo TTL
  for (const [k, v] of map) {
    if (now - v.updatedAt > ttl) map.delete(k);
  }
  // xoá cũ nhất nếu vượt số entry
  while (map.size > maxEntries) {
    let oldestKey: string | null = null;
    let oldestTs = Infinity;
    for (const [k, v] of map) {
      if (v.updatedAt < oldestTs) {
        oldestTs = v.updatedAt;
        oldestKey = k;
      }
    }
    if (!oldestKey) break;
    map.delete(oldestKey);
  }
}

export function getState(conversationId: string): ConversationState | null {
  return store().get(conversationId) ?? null;
}

/** Ghi nhận 1 tin nhắn user (sau khi đã match xong — tránh đụng history đang so). */
export function rememberUserMessage(
  conversationId: string,
  normalizedText: string,
  data: ChatbotData
) {
  const map = store();
  const state =
    map.get(conversationId) ?? { userMsgs: [], lastIntent: null, updatedAt: Date.now() };
  const window = data.system.context.window ?? 8;
  // tránh trùng lặp khi regenerate (cùng tin nhắn gửi lại)
  if (state.userMsgs[state.userMsgs.length - 1] !== normalizedText) {
    state.userMsgs.push(normalizedText);
    if (state.userMsgs.length > window) {
      state.userMsgs = state.userMsgs.slice(-window);
    }
  }
  state.updatedAt = Date.now();
  map.set(conversationId, state);
  prune(data);
}

/** Ghi nhận intent bot vừa trả lời (null = fallback). */
export function rememberAssistantIntent(conversationId: string, intentId: string | null) {
  const map = store();
  const state =
    map.get(conversationId) ?? { userMsgs: [], lastIntent: null, updatedAt: Date.now() };
  state.lastIntent = intentId;
  state.updatedAt = Date.now();
  map.set(conversationId, state);
}

/** Xoá trí nhớ hội thoại (/clear, /reset). */
export function clearContext(conversationId: string) {
  store().delete(conversationId);
}

/** Mồi trí nhớ từ lịch sử DB (route gọi trước khi process lượt mới). */
export function seedFromHistory(
  conversationId: string,
  history: Array<{ role: string; content: string }>,
  data: ChatbotData
) {
  const window = data.system.context.window ?? 8;
  const userMsgs = history
    .filter((m) => m.role === "user")
    .map((m) => normalizeText(m.content, data.aliases))
    .filter(Boolean)
    .slice(-window);
  const map = store();
  map.set(conversationId, {
    userMsgs,
    // intent từ text không suy ngược được — topic hint bỏ qua ở lượt mồi
    lastIntent: null,
    updatedAt: Date.now(),
  });
  prune(data);
}
