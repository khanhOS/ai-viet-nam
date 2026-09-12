// KhanhOS AI — ReasoningEngine: pipeline suy luận đa giai đoạn (thật).
// understand → classify → context (memory + knowledge + tools) → generate
// (stream thật) → verify → revise (giới hạn vòng) → finalize.
// Mỗi giai đoạn phát status cho UI — KHÔNG lộ chain-of-thought riêng tư,
// chỉ status hành động ("Đang phân tích…", "Đang chạy công cụ…").

import type {
  ChatCompletionMessage,
  ChatRole,
  InferenceUsage,
  ModelAdapter,
  ToolCallRequest,
  ToolResult,
  Complexity,
  TaskType,
} from "@/ai/core/types";
import type { PipelineStage } from "@/ai/core/types";
import { InferenceEngine } from "@/ai/inference/engine";
import { ModelRouter, type RouterDecision } from "@/ai/models/router";
import { getProfile, type ProfileId } from "@/ai/models/profiles";
import { ContextManager, type HistoryMessage } from "@/ai/context/manager";
import { MemoryManager, detectMemoryCommand, rememberLongTerm, forgetLongTerm } from "@/ai/memory/manager";
import { ToolExecutor } from "@/ai/tools/executor";
import { BUILTIN_TOOLS, listToolDefs, safeEvaluate } from "@/ai/tools/registry";
import { verifyOutput, type VerificationResult } from "@/ai/reasoning/verifier";
import {
  composeSystemPrompt,
  knowledgeContextPrompt,
  toolResultsPrompt,
  revisionPrompt,
} from "@/ai/prompts";
import { sanitizeInput, sanitizeOutput } from "@/ai/safety/guardrails";
import { estimateTokens } from "@/ai/core/token-manager";
import { getAIRuntimeConfig } from "@/ai/core/config";

export interface PipelineCallbacks {
  onStatus: (stage: PipelineStage, label: string) => void;
  onDelta: (text: string) => void;
  onToolStart?: (call: ToolCallRequest) => void;
  onToolEnd?: (result: ToolResult) => void;
  onVerification?: (v: VerificationResult) => void;
  onRoute?: (d: RouterDecision) => void;
}

export interface ReasoningInput {
  message: string;
  conversationId: string;
  userId: string;
  history: HistoryMessage[];
  language: "vi" | "en";
  overrideProfile?: ProfileId | null;
  /** Model runtime name (vd "qwen2.5:0.5b") */
  model: string;
  /** ngữ cảnh tri thức local (RAG-lite từ data/chatbot) */
  localKnowledge?: string;
  signal?: AbortSignal;
}

export interface ReasoningOutput {
  text: string;
  usage: InferenceUsage;
  router: RouterDecision;
  profile: ProfileId;
  verification: VerificationResult | null;
  retries: number;
  toolCalls: number;
  timeToFirstTokenMs: number | null;
  totalMs: number;
  tokensPerSecond: number | null;
  interrupted: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  understanding: "Đang phân tích câu hỏi…",
  collecting_context: "Đang thu thập ngữ cảnh…",
  planning: "Đang lập kế hoạch…",
  tool_call: "Đang chạy công cụ…",
  verifying: "Đang kiểm tra kết quả…",
  revising: "Đang hoàn thiện lại…",
  generating: "Đang sinh phản hồi…",
  finalizing: "Hoàn tất",
};

/**
 * Tìm biểu thức số học có thể tính được trong câu nói tự nhiên.
 * - Match run liên tiếp ký tự số học (bao gồm ngoặc) → safeEvaluate kiểm chứng
 * - Chống false-positive: số điện thoại (0xxx), ngày tháng, chuỗi 3+ số ngắn
 *   chỉ có +/- thì phải kèm từ ý định tính toán ("tính", "=", "bao nhiêu"...)
 */
function extractCalculableExpression(text: string, canEvaluate: (expr: string) => boolean): string | null {
  // Xoá khoảng trắng GIỮA các ký tự số học ("(128 * 46) + 99" → "(128*46)+99")
  // — chữ cái không thuộc class nên câu tiếng Việt không bị dính vào.
  const compactText = text.replace(
    /([\d+\-*/^%().])\s+(?=[\d+\-*/^%().])/g,
    "$1"
  );
  const runs = compactText.match(/[\d+\-*/^%().]{3,}/g) || [];
  let best: string | null = null;

  for (const run of runs) {
    // Chỉ cắt toán tử thừa hai đầu — GIỮ nguyên ngoặc để biểu thức cân bằng
    const compact = run.replace(/^[+\-*/^%.]+|[+\-*/^%.]+$/g, "");
    if (!/\d/.test(compact)) continue;
    if (!/[+\-*/^%]/.test(compact)) continue; // phải có toán tử
    const numbers = compact.match(/\d+(?:\.\d+)?/g) || [];
    if (numbers.length < 2) continue;

    const onlyAddSub = !/[*/^%]/.test(compact);
    if (onlyAddSub) {
      // số bắt đầu bằng 0 (SĐT 09xx) → bỏ
      if (numbers.some((n) => n.length > 1 && n.startsWith("0"))) continue;
      // dạng ngày/SĐT: 3+ nhóm số ngắn → bỏ trừ khi có từ ý định tính
      const phoneLike = numbers.length >= 3 && numbers.every((n) => n.length <= 4);
      const intentWord = /(tính|compute|calculate|bao nhiêu|by how much|=)/i.test(text);
      if (phoneLike && !intentWord) continue;
      if (!intentWord) continue; // chuỗi "128 + 99" trôi nổi không có ý định → bỏ
    }
    if (canEvaluate(compact)) best = compact;
  }
  return best;
}

export class ReasoningEngine {
  private router = new ModelRouter();
  private contextManager = new ContextManager();
  private memory = new MemoryManager();

  constructor(
    private inference: InferenceEngine,
    private adapter: ModelAdapter
  ) {}

  async run(input: ReasoningInput, cb: PipelineCallbacks): Promise<ReasoningOutput> {
    const t0 = performance.now();
    const cfg = getAIRuntimeConfig();

    // ── 1. UNDERSTAND: làm sạch input (che secret, chặn ký tự lạ) ──
    cb.onStatus("understanding", STATUS_LABELS.understanding);
    const guard = sanitizeInput(input.message);
    const cleanMessage = guard.clean.slice(0, 8000);

    // Ghi nhớ rõ ràng của user (long-term, DB)
    const memCmd = detectMemoryCommand(input.message);
    if (memCmd && memCmd.key === "__forget__") {
      await forgetLongTerm(input.userId, memCmd.value);
    } else if (memCmd) {
      await rememberLongTerm(input.userId, memCmd.key, memCmd.value);
    }

    // ── 2. CLASSIFY: phân loại nhiệm vụ + độ phức tạp ──
    cb.onStatus("classifying", "Đang phân loại nhiệm vụ…");
    const decision = this.router.classify({
      text: cleanMessage,
      historyLength: input.history.length,
      overrideProfile: input.overrideProfile ?? null,
    });
    cb.onRoute?.(decision);
    const profile = getProfile(decision.profileId);

    // ── 3. CONTEXT: memory + tri thức local + (tool deterministic) ──
    cb.onStatus("collecting_context", STATUS_LABELS.collecting_context);
    const memories = await this.memory.retrieve(
      input.userId,
      input.conversationId,
      cleanMessage,
      profile.id === "FAST" ? 4 : 8
    );

    const toolResults: ToolResult[] = [];
    const executor = new ToolExecutor({
      userId: input.userId,
      conversationId: input.conversationId,
    });

    // Phép tính rõ ràng → tool calculator thật (luôn đúng, không phụ thuộc model)
    const calcExpr = extractCalculableExpression(cleanMessage, (e) => safeEvaluate(e) !== null);
    if (calcExpr && decision.complexity !== "EXPERT") {
      const calc: ToolCallRequest = { id: `calc-${Date.now()}`, name: "calculator", args: { expr: calcExpr } };
      const r = await executor.execute(calc, {
        onToolStart: (c) => cb.onToolStart?.(c),
        onToolEnd: (res) => cb.onToolEnd?.(res),
      });
      toolResults.push(r);
      cb.onStatus("tool_call", STATUS_LABELS.tool_call);
    }

    // ── 4. Lắp prompt theo profile + ngân sách ngữ cảnh ──
    const systemPrompt = composeSystemPrompt({
      language: input.language,
      profile: profile.id,
      memories: memories.map((m) => m.entry),
      knowledge: input.localKnowledge,
      toolNames: profile.useTools ? BUILTIN_TOOLS.map((t) => t.name) : [],
    });
    const toolBlock = toolResults.length ? toolResultsPrompt(toolResults) : undefined;

    const assembled = this.contextManager.assemble({
      systemPrompt,
      memoriesBlock: undefined, // memory đã nằm trong systemPrompt (gọn hơn)
      history: input.history,
      currentMessage: cleanMessage,
      toolResultsBlock: toolBlock,
      maxTokens: Math.min(cfg.maxContextBudgetTokens, 3072),
    });

    // ── 5. GENERATE — stream THẬT + verify + revise theo vòng ──
    let attempt = 0;
    let verification: VerificationResult | null = null;
    let text = "";
    let usage: InferenceUsage = { promptTokens: 0, outputTokens: 0, estimated: true };
    let ttft: number | null = null;
    let genMs = 0;
    let tps: number | null = null;
    let interrupted = false;
    // Tối thiểu 1 vòng viết lại: ngay cả profile FAST cũng được sửa nếu bị
    // verdict fail (vd no_refusal — chủ sở hữu cấm bot từ chối câu hỏi)
    const maxAttempts = 1 + Math.max(1, profile.maxIterations);

    while (attempt < maxAttempts) {
      cb.onStatus(attempt === 0 ? "generating" : "revising", STATUS_LABELS[attempt === 0 ? "generating" : "revising"]);
      try {
        const messages: ChatCompletionMessage[] =
          attempt === 0
            ? assembled.messages
            : [
                ...assembled.messages,
                { role: "assistant", content: text },
                { role: "user", content: revisionPrompt(verification?.feedback ?? "câu trả lời chưa đạt") },
              ];
        const result = await this.inference.streamWithMetrics(
          messages,
          input.model,
          { ...profile.options, signal: input.signal },
          (chunk) => {
            if (chunk.delta) cb.onDelta(chunk.delta);
            if (chunk.finishReason === "length") {
              // đánh dấu để verifier bắt
              text += ""; // text gộp ở streamWithMetrics
            }
          }
        );
        text = result.text;
        usage = result.metrics.usage;
        ttft = result.metrics.timeToFirstTokenMs;
        genMs = result.metrics.totalMs;
        tps = result.metrics.tokensPerSecond;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          interrupted = true;
          break;
        }
        throw e;
      }

      // ── 6. VERIFY ──
      cb.onStatus("verifying", STATUS_LABELS.verifying);
      verification = verifyOutput({
        output: text,
        language: input.language,
        finishReason: null,
        userQuestion: cleanMessage,
        thorough: decision.complexity === "COMPLEX" || decision.complexity === "EXPERT",
      });
      cb.onVerification?.(verification);

      // Đạt hoặc không còn vòng sửa → dừng
      if (verification.severity !== "fail" || attempt + 1 >= maxAttempts) {
        break;
      }
      attempt += 1;
    }

    // ── 7. FINALIZE: làm sạch output ──
    cb.onStatus("finalizing", STATUS_LABELS.finalizing);
    const outGuard = sanitizeOutput(text);
    const finalText = outGuard.clean.trim() || "_[model không trả về nội dung]_";

    return {
      text: finalText,
      usage,
      router: decision,
      profile: profile.id,
      verification,
      retries: attempt,
      toolCalls: toolResults.length,
      timeToFirstTokenMs: ttft,
      totalMs: performance.now() - t0,
      tokensPerSecond: tps,
      interrupted,
    };
  }
}

export { listToolDefs };
