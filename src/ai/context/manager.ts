// KhanhOS AI — ContextManager: lắp ngữ cảnh theo ngân sách, chống tràn.
// Pipeline: system + memory + lịch sử hội thoại (gần nhất) + tin nhắn hiện tại.
// Ưu tiên giữ: system prompt > tin hiện tại > N lượt hội thoại gần nhất > memory.

import type { ChatCompletionMessage } from "@/ai/core/types";
import { TokenBudget, estimateTokens } from "@/ai/core/token-manager";

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssembleInput {
  systemPrompt: string;
  memoriesBlock?: string; // đã format thành system phụ
  history: HistoryMessage[];
  currentMessage: string;
  toolResultsBlock?: string;
  maxTokens: number;
}

export interface AssembleResult {
  messages: ChatCompletionMessage[];
  droppedHistory: number; // số lượt cũ bị cắt để vừa ngân sách
  estimatedTokens: number;
}

export class ContextManager {
  /**
   * Lắp danh sách message trong ngân sách:
   * system (bắt buộc) → memory (nếu còn chỗ) → lịch sử từ MỚI → CŨ → tin hiện tại.
   */
  assemble(input: AssembleInput): AssembleResult {
    const budget = new TokenBudget(input.maxTokens);

    // 1. System prompt — luôn giữ nguyên
    const systemTokens = estimateTokens(input.systemPrompt) + 4;
    budget.charge(systemTokens);
    const messages: ChatCompletionMessage[] = [{ role: "system", content: input.systemPrompt }];

    // 2. Memory block — cắt nếu thiếu chỗ
    if (input.memoriesBlock) {
      const memTokens = estimateTokens(input.memoriesBlock) + 4;
      if (budget.charge(memTokens)) {
        messages.push({ role: "system", content: input.memoriesBlock });
      }
    }

    // 3. Tin hiện tại — bắt buộc
    const currentTokens = estimateTokens(input.currentMessage) + 4;
    budget.charge(Math.min(currentTokens, budget.remaining));
    const currentMsg: ChatCompletionMessage = { role: "user", content: input.currentMessage };

    // 4. Tool results block (nếu có)
    if (input.toolResultsBlock) {
      const tTokens = estimateTokens(input.toolResultsBlock) + 4;
      if (budget.charge(tTokens)) {
        messages.push({ role: "system", content: input.toolResultsBlock });
      }
    }

    // 5. Lịch sử từ mới về cũ, vừa bao nhiêu lấy bấy nhiêu
    const picked: HistoryMessage[] = [];
    let dropped = 0;
    for (let i = input.history.length - 1; i >= 0; i--) {
      const m = input.history[i];
      const t = estimateTokens(m.content) + 4;
      if (budget.charge(t)) {
        picked.unshift(m);
      } else {
        dropped = i + 1;
        break;
      }
    }
    for (const m of picked) {
      messages.push({ role: m.role, content: m.content });
    }

    // 6. Cuối cùng: tin hiện tại
    messages.push(currentMsg);

    return {
      messages,
      droppedHistory: dropped,
      estimatedTokens: budget.spent,
    };
  }
}
