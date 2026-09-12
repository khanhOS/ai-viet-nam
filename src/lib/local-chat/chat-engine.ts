// KhanhOS AI — ChatEngine registry
// getChatEngine() trả về singleton (cache trong globalThis — an toàn HMR).
// Muốn đổi engine (ví dụ cắm Ollama local): tạo class triển khai ChatEngine
// rồi đổi ở đây — UI + /api/chat + data không đổi.

import type { ChatEngine } from "./types";
import { LocalRuleEngine } from "./local-rule-engine";

const g = globalThis as unknown as { __khanhosChatEngine?: ChatEngine };

export function getChatEngine(): ChatEngine {
  if (!g.__khanhosChatEngine) {
    g.__khanhosChatEngine = new LocalRuleEngine();
  }
  return g.__khanhosChatEngine;
}
