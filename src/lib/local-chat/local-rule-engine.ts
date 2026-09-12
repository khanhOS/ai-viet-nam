// KhanhOS AI — LocalRuleEngine: bộ máy chat 100% cục bộ
// Pipeline: lệnh (commands.json) → normalize (slang/terms) → đoán ngôn ngữ
// → context (kịch bản follow-up) → intent match (scoring) → knowledge search
// → fallback trung thực (không bịa). KHÔNG gọi API AI ngoài, KHÔNG cần key.

import { getChatbotData } from "./data-loader";
import { detectIntents } from "./intent-engine";
import { searchKnowledge, renderKnowledge } from "./knowledge-engine";
import { normalizeMessage, detectLanguage } from "./normalize";
import {
  getState,
  rememberUserMessage,
  rememberAssistantIntent,
  clearContext,
  seedFromHistory as seedCtx,
} from "./context-engine";
import { pickResponse, fallbackResponse, topicSuggestions } from "./response-engine";
import { parseCommand, runCommand, unknownCommandText } from "./commands";
import { isDbCommand, runDbCommand } from "./admin-commands";
import type {
  ChatEngine,
  EngineInput,
  EngineResult,
  EngineLanguage,
  ChatbotData,
  NormalizedMessage,
} from "./types";

export class LocalRuleEngine implements ChatEngine {
  async process(input: EngineInput): Promise<EngineResult> {
    const data = getChatbotData();
    const raw = input.message.trim().slice(0, data.system.engine.max_message_chars);

    if (!raw) {
      return {
        text: "Bạn chưa nhập nội dung gì cả — thử hỏi mình một câu xem sao.",
        intent: null,
        confidence: 0,
        source: "local",
        language: "vi",
      };
    }

    // 1) Lệnh /xxx — xử lý TRƯỚC (không cần normalize)
    const cmd = parseCommand(raw);
    if (cmd) {
      const def = data.commands[cmd.name];
      if (!def) {
        return {
          text: unknownCommandText(cmd.name, data, input.user),
          intent: null,
          confidence: 0,
          source: "local",
          language: "vi",
        };
      }

      let text: string;
      if (isDbCommand(cmd.name)) {
        const out = await runDbCommand(cmd.name, cmd.args, input.user);
        text = out.text;
      } else {
        const out = runCommand(cmd.name, data, input.user);
        text = out?.text ?? def.response ?? def.description;
      }

      // /clear, /reset: xoá luôn trí nhớ hội thoại của engine
      if (def.action === "clear_chat" || def.action === "reset_chat") {
        clearContext(input.conversationId);
      }

      return {
        text,
        intent: `command:${cmd.name.slice(1)}`,
        confidence: 1,
        source: "local",
        language: "vi",
        action: def.action,
      };
    }

    // 2) Chuẩn hoá + ngôn ngữ
    const norm = normalizeMessage(raw, data.aliases, data.system.engine.max_message_chars);
    const lang = detectLanguage(norm);

    if (!norm.words.length) {
      // chỉ toàn ký tự lạ — trả fallback trung thực
      return this.fallbackResult(data, lang, input.conversationId, norm);
    }

    // Giới hạn độ dài dùng cho matching (thân thiện token không cần — chỉ tốc độ)
    const matchText = norm.text.slice(0, data.system.engine.match_max_chars);
    const matchNorm: NormalizedMessage = { ...norm, text: matchText, words: matchText.split(" ") };

    // 3) Context hội thoại
    const state = getState(input.conversationId);
    const context = state
      ? { userMsgs: state.userMsgs, lastIntent: state.lastIntent }
      : null;

    // 4) Intent match
    const candidates = detectIntents(matchNorm, context, data);
    const winner = candidates.find((c) => c.confidence >= c.intent.confidenceThreshold);

    if (winner) {
      const text =
        pickResponse(data, winner.intent.responseId, lang) ??
        this.knowledgeOrFallbackText(data, winner.intent.knowledgeRef, lang);

      rememberUserMessage(input.conversationId, norm.text, data);
      rememberAssistantIntent(input.conversationId, winner.intent.id);

      return {
        text,
        intent: winner.intent.id,
        confidence: winner.confidence,
        source: "local",
        language: lang,
        suggestions: winner.intent.examples?.slice(0, 3),
        debug: candidates.slice(0, 5),
      };
    }

    // 5) Knowledge search (intent không khớp — tra tri thức)
    const k = searchKnowledge(matchNorm, data);
    if (k) {
      rememberUserMessage(input.conversationId, norm.text, data);
      rememberAssistantIntent(input.conversationId, null);
      return {
        text: renderKnowledge(k.entry),
        intent: null,
        confidence: k.confidence,
        source: "local",
        language: lang,
        suggestions: topicSuggestions(data),
        debug: candidates.slice(0, 5),
      };
    }

    // 6) Fallback trung thực — không bịa
    return this.fallbackResult(data, lang, input.conversationId, norm, candidates.slice(0, 5));
  }

  /** Mồi trí nhớ hội thoại từ lịch sử DB (chat route gọi mỗi request). */
  seedFromHistory(
    conversationId: string,
    history: Array<{ role: string; content: string }>
  ): void {
    const data = getChatbotData();
    seedCtx(conversationId, history, data);
  }

  // ─────────────────────────────────────────────

  private fallbackResult(
    data: ChatbotData,
    lang: EngineLanguage,
    conversationId: string,
    norm: NormalizedMessage,
    debug?: EngineResult["debug"]
  ): EngineResult {
    rememberUserMessage(conversationId, norm.text, data);
    rememberAssistantIntent(conversationId, null);
    return {
      text: fallbackResponse(data, lang),
      intent: null,
      confidence: 0,
      source: "local",
      language: lang,
      suggestions: topicSuggestions(data),
      debug,
    };
  }

  private knowledgeOrFallbackText(
    data: ChatbotData,
    knowledgeRef: string | undefined,
    lang: EngineLanguage
  ): string {
    if (knowledgeRef) {
      const entry = data.knowledge.find((k) => k.id === knowledgeRef);
      if (entry) return renderKnowledge(entry);
    }
    return fallbackResponse(data, lang);
  }
}
