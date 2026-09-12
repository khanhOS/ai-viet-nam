// POST /api/chat — KhanhOS AI: Local Chat Engine + Model AI cục bộ (SSE streaming)
//
// Kiến trúc 2 lớp (KHÔNG gọi API AI bên ngoài, KHÔNG cần API key):
//   1. Bộ máy tri thức cục bộ (data/chatbot) — lệnh, intents, FAQ → trả lời tức thì
//   2. Model AI cục bộ (Ollama/llama.cpp local qua src/ai/) — suy luận tự do
//      khi tri thức không khớp, hoặc khi user chọn model runtime:*
// SSE: meta → status* → delta* → (tool_call|tool_result)* → verification? → done
// done: source "local-rules" | "local-model", intent, confidence, metrics THẬT.

import { db } from "@/lib/db";
import { fail } from "@/lib/api-helpers";
import { getSessionUser } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rate-limit";
import { chatRequestSchema, firstZodError } from "@/lib/security/validation";
import { isOverQuota, getMonthlyUsage, quotaErrorMessage } from "@/lib/plan-usage";
import { monthlyTokenLimit, estimateTokens } from "@/lib/plans";
import { getChatEngine } from "@/lib/local-chat/chat-engine";
import { LocalRuleEngine } from "@/lib/local-chat/local-rule-engine";
import { getChatbotData } from "@/lib/local-chat/data-loader";
import { normalizeMessage } from "@/lib/local-chat/normalize";
import { searchKnowledge, renderKnowledge } from "@/lib/local-chat/knowledge-engine";
import { DEFAULT_MODEL_ID } from "@/lib/models";
import { getAIOrchestrator, getRuntimeStatus } from "@/ai";
import { recordRequest } from "@/ai/observability/diagnostics";
import { retrieveKnowledge, formatRetrievedKnowledge } from "@/ai/knowledge/retrieval";
import type { HistoryMessage } from "@/ai/context/manager";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function sseEvent(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function titleFromContent(content: string): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (clean.length <= 50) return clean || "Cuộc trò chuyện mới";
  return clean.slice(0, 50) + "…";
}

/** Ngôn ngữ để chọn prompt + verify. */
function detectLangVi(text: string): "vi" | "en" {
  const vietChars = (text.match(/[àáảãạăằắẳẵâậđèéêẻếìíòóôồốỗộưừứửữộỹý]/gi) || []).length;
  return vietChars >= 1 ? "vi" : "en";
}

/**
 * Phát hiện yêu cầu kiểu TẠO TÁC (viết hàm/code/script, fix bug, refactor…).
 * Những yêu cầu này cần MODEL sinh nội dung mới — tri thức local chỉ giải thích
 * NGÔN NGỮ ("javascript là gì") chứ không viết code giúp user được. Nếu cho
 * tri thức chặn nhanh sẽ trả về câu giải thích chung chung thay vì làm nhiệm vụ.
 */
/**
 * Intent "meta follow-up" của rules engine — response chỉ là TEMPLATE xin chủ đề
 * ("chỉ tên chủ đề là mình giải thích…"). Lời thoại này vô nghĩa khi user vừa hỏi
 * một câu đầy đủ (vd: "vì sao bầu trời xanh? giải thích ngắn gọn") — intent khớp
 * chỉ vì câu chứa từ khoá như "ngắn gọn"/"đơn giản". Khi model đang chạy thì giao
 * các việc này cho model: model có lịch sử hội thoại, làm được THẬT
 * (giải thích lại / tóm tắt / lấy ví dụ theo ngữ cảnh).
 */
const META_FOLLOWUP_INTENTS = new Set([
  "simplify",
  "summarize",
  "explain_more",
  "example_please",
]);

/**
 * Kiểm tra "độ phủ" của câu trả lời tri thức so với câu hỏi.
 * Fast path tri thức chỉ tốt khi entry KHẮP nội dung câu hỏi; nếu câu hỏi nhắc
 * từ khoá nội dung (≥3 ký tự, bỏ stopwords) mà câu trả lời không hề nhắc tới
 * ≥50% số từ đó → entry chỉ liên quan GIÁN TIẾP (vd: hỏi "javascript promise"
 * nhưng entry chỉ nói javascript chung) → nhường cho model suy luận.
 */
function isKnowledgeOffTopic(question: string, answer: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
  const STOP = new Set(
    [
      "cho", "minh", "hoi", "vay", "thi", "la", "gi", "the", "nao", "sao", "tai",
      "vi", "va", "cua", "khong", "co", "nhu", "mot", "nhung", "dung", "van",
      "danh", "tu", "ban", "nay", "do", "duoc", "bi", "hay", "di", "ra", "vao",
      "nghe", "kia", "cai", "may", "toi", "em", "anh", "chi", "gium", "giup",
      "what", "why", "how", "is", "are", "the", "and", "for", "you", "me",
      "tell", "about", "please", "can", "does", "did",
    ].filter((w) => w.length >= 3)
  );
  const words = [
    ...new Set(
      (norm(question).match(/[a-z0-9_]{3,}/g) || []).filter((w) => !STOP.has(w))
    ),
  ];
  if (words.length < 2) return false; // câu ngắn/chung chung → giữ fast path
  const ans = norm(answer);
  const missing = words.filter((w) => !ans.includes(w));
  return missing.length > 0 && missing.length / words.length >= 0.5;
}

function isTaskStyleRequest(text: string): boolean {
  const t = " " + text.toLowerCase().replace(/\s+/g, " ") + " ";
  // Câu hỏi hướng dẫn (how/why) — KHÔNG phải yêu cầu tạo tác
  if (
    /(làm sao|lam sao|làm thế nào|lam the nao|tại sao|tai sao|vì sao|vi sao|thế nào|the nao|như thế nào|nhu the nao|how (do|to|can)|why)/.test(
      t
    )
  ) {
    return false;
  }
  // Động từ tạo tác + ngữ cảnh lập trình
  if (
    /\b(viết|viet|code|lập trình|lap trinh|implement|build|generate|refactor|tối ưu hoá|toi uu hoa|optimize|debug)\b/i.test(
      text
    )
  ) {
    return true;
  }
  if (/(viết|viet|tạo|tao|làm|lam|thiết kế|thiet ke)\s+(hàm|ham|function|code|class|component|api|script|chương trình|chuong trinh|web|app|game|bot|tool|tiện ích|tien ich)/i.test(text)) {
    return true;
  }
  if (/\b(write|create|implement|build|generate|fix|refactor)\b\s+(a\s+|an\s+|the\s+)?(function|code|class|script|program|component|api|app|regex|sql)/i.test(text)) {
    return true;
  }
  if (/\b(fix|sửa|sua)\s+(lỗi|loi|bug|error)/i.test(text)) {
    return true;
  }
  return false;
}

export async function POST(req: Request) {
  // 1. Origin + auth + rate limit
  if (!isSameOrigin(req)) return fail(403, "Yêu cầu không hợp lệ (origin)");

  const user = await getSessionUser();
  if (!user) return fail(401, "Chưa đăng nhập");

  const rl = rateLimit(`chat:${user.id}`, 20, 60 * 1000);
  if (!rl.allowed) {
    return fail(429, `Bạn nhắn quá nhanh. Thử lại sau ${rl.retryAfterSec}s.`, {
      retryAfter: rl.retryAfterSec,
    });
  }

  // 1.5. Quota gói dịch vụ — chặn khi đã dùng hết tín dụng của tháng
  // (lệnh /help /usage /clear... không tốn tín dụng → cho qua để user vẫn tự xem được)
  if (await isOverQuota(user.plan, user.role, user.id)) {
    const bodyPeek = await req.clone().json().catch(() => null);
    const text = typeof bodyPeek?.content === "string" ? bodyPeek.content.trim() : "";
    const isExemptCmd = /^\/[a-z0-9_-]+(\s|$)/i.test(text);
    if (!isExemptCmd) {
      const usage = await getMonthlyUsage(user.id);
      const limit = monthlyTokenLimit(user.plan, user.role);
      return fail(402, quotaErrorMessage(user.plan, user.role, usage, limit), {
        quota: { plan: user.plan, usage, limit },
      });
    }
  }

  // 2. Validate
  const body = await req.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return fail(400, firstZodError(parsed.error));
  const input = parsed.data;
  const regenerate = input.regenerate ?? false;

  // 3. Conversation: lấy của CHÍNH user này (authorization) hoặc tạo mới
  let conversationId: string | null = null;
  let conversationTitle = "Cuộc trò chuyện mới";

  if (input.conversationId) {
    const conversation = await db.conversation.findFirst({
      where: { id: input.conversationId, userId: user.id },
    });
    if (!conversation) return fail(404, "Không tìm thấy cuộc trò chuyện");
    conversationId = conversation.id;
    conversationTitle = conversation.title;

    if (regenerate) {
      // Xoá tin nhắn assistant cuối để sinh lại
      const lastMsg = await db.message.findFirst({
        where: { conversationId, role: "assistant" },
        orderBy: { createdAt: "desc" },
      });
      if (!lastMsg) return fail(400, "Không có tin nhắn nào để tạo lại");
      await db.message.delete({ where: { id: lastMsg.id } });
    }
  } else {
    if (regenerate) return fail(400, "Thiếu cuộc trò chuyện để tạo lại");
    if (!input.content) return fail(400, "Thiếu nội dung tin nhắn");

    const conversation = await db.conversation.create({
      data: {
        userId: user.id,
        title: titleFromContent(input.content),
        modelId: input.modelId,
      },
    });
    conversationId = conversation.id;
    conversationTitle = conversation.title;
  }

  const convId = conversationId!;

  // 4. Lịch sử (mồi context) + lưu tin nhắn user
  const dbHistory = await db.message.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: "asc" },
    take: 24,
    select: { role: true, content: true },
  });

  const engine = getChatEngine();
  if (engine instanceof LocalRuleEngine && dbHistory.length > 0 && !regenerate) {
    engine.seedFromHistory(
      convId,
      dbHistory.map((m) => ({ role: m.role, content: m.content }))
    );
  }

  let userText = input.content ?? "";
  const isClearCmd = /^\/(clear|reset)\b/i.test(userText.trim());
  if (!regenerate) {
    if (!input.content) return fail(400, "Thiếu nội dung tin nhắn");
    userText = input.content;
    await db.message.create({
      data: {
        conversationId: convId,
        role: "user",
        content: userText,
        attachments: input.attachments?.length
          ? JSON.stringify(input.attachments)
          : null,
      },
    });
  } else {
    // Regenerate: lấy lại tin nhắn user cuối làm input
    const lastUser = await db.message.findFirst({
      where: { conversationId: convId, role: "user" },
      orderBy: { createdAt: "desc" },
    });
    if (!lastUser) return fail(400, "Không có tin nhắn để tạo lại");
    userText = lastUser.content;
  }

  // 5. Lệnh /clear, /reset — dọn hội thoại trong DB (cả tin nhắn user vừa lưu)
  if (isClearCmd) {
    await db.message.deleteMany({ where: { conversationId: convId } });
  }

  // ═══════════════════════════════════════════
  // 6. ĐỊNH TUYẾN: lệnh → rules; chọn model → model; ngược lại hybrid
  // ═══════════════════════════════════════════
  const isCommand = userText.trim().startsWith("/");
  const wantRuntimeModel = input.modelId.startsWith("runtime:");
  const orch = await getAIOrchestrator(); // null nếu không có runtime model

  // 6a. LÀNH LỆNH /xxx → luôn dùng rules engine (deterministic, không tốn model)
  if (isCommand || !orch || !orch.status.defaultModel) {
    // → nhánh rules (giữ hành vi cũ)
    return runRulesPath({ req, convId, conversationTitle, userText, input, engine, user, isClearCmd });
  }

  // 6b. KHÔNG phải lệnh + có runtime model
  const modelInfo = orch.status.defaultModel;

  if (wantRuntimeModel) {
    // User chọn model cụ thể → luôn dùng model đó (nếu có thật)
    const chosen = orch.status.models.find((m) => m.id === input.modelId) ?? modelInfo;
    return runModelPath({
      req,
      convId,
      conversationTitle,
      userText,
      input,
      user,
      dbHistory,
      orch,
      model: chosen.runtimeName,
      modelIdLabel: input.modelId,
      // dbHistory KHÔNG chứa tin user hiện tại (fetch trước khi save) → giữ nguyên;
      // riêng regenerate thì tin user cuối trong DB chính là currentMessage → bỏ đi
      history: (input.regenerate ? dbHistory.slice(0, -1) : dbHistory)
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
        .slice(-6),
    });
  }

  // 6c. HYBRID (modelId = khanhos-core): tri thức khớp cao → rules (nhanh);
  // không khớp → model suy luận. Tri thức tìm được → làm ngữ cảnh cho model.
  const ruleResult = await engine
    .process({
      message: userText,
      conversationId: convId,
      userId: user.id,
      user: { id: user.id, email: user.email, role: user.role, plan: user.plan },
    })
    .catch(() => null);

  const rulesMatched =
    !!ruleResult &&
    (ruleResult.intent !== null ? ruleResult.confidence >= 0.6 : ruleResult.confidence > 0.35);

  // Yêu cầu TẠO TÁC (viết code/hàm, fix bug…) → luôn model suy luận,
  // kể cả khi tri thức khớp (tri thức chỉ giải thích ngôn ngữ, không sinh code)
  const taskStyle = isTaskStyleRequest(userText);

  // Intent meta follow-up (simplify/summarize/…) → model làm thật theo ngữ cảnh,
  // KHÔNG dùng template "xin chủ đề" của rules engine
  const metaFollowupIntent =
    typeof ruleResult?.intent === "string" && META_FOLLOWUP_INTENTS.has(ruleResult.intent);

  // Câu hỏi nhắc từ khoá mà tri thức KHÔNG phủ (vd "javascript promise" nhưng
  // entry chỉ nói javascript chung) → model trả lời đúng trọng tâm hơn
  const offTopic = ruleResult ? isKnowledgeOffTopic(userText, ruleResult.text) : false;

  if (rulesMatched && ruleResult && !taskStyle && !metaFollowupIntent && !offTopic) {
    // Fast path: tri thức/FAQ khớp — trả lời tức thì, không cần model
    return streamRulesResult({
      req,
      convId,
      conversationTitle,
      result: ruleResult,
      user,
      isClearCmd,
    });
  }

  // Rules không khớp → model suy luận, kèm tri thức liên quan làm ngữ cảnh (RAG-lite)
  let localKnowledge = "";
  try {
    const data = getChatbotData();
    const norm = normalizeMessage(userText, data.aliases, data.system.engine.max_message_chars);
    const k = searchKnowledge(norm, data);
    if (k && k.confidence >= 0.2) {
      localKnowledge = renderKnowledge(k.entry);
    }
  } catch {
    // tri thức là phần tuỳ chọn
  }

  // RAG thật: truy vấn tài liệu USER đã nạp (embedding local + cosine)
  try {
    const ragResults = await retrieveKnowledge(user.id, userText, 4);
    const ragContext = formatRetrievedKnowledge(ragResults);
    if (ragContext) {
      localKnowledge = localKnowledge ? `${localKnowledge}\n\n${ragContext}` : ragContext;
    }
  } catch {
    // RAG là phần tuỳ chọn — không chặn chat khi lỗi
  }

  return runModelPath({
    req,
    convId,
    conversationTitle,
    userText,
    input,
    user,
    dbHistory,
    orch,
    model: modelInfo.runtimeName,
    modelIdLabel: input.modelId,
    localKnowledge,
    // dbHistory KHÔNG chứa tin user hiện tại (fetch trước khi save) → giữ nguyên;
    // riêng regenerate thì tin user cuối trong DB chính là currentMessage → bỏ đi
    history: (input.regenerate ? dbHistory.slice(0, -1) : dbHistory)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      .slice(-6),
  });
}

// ═════════════════════════════════════════════
// NHÁNH RULES ENGINE (giữ nguyên hành vi Task 11/12)
// ═════════════════════════════════════════════

interface RulesPathArgs {
  req: Request;
  convId: string;
  conversationTitle: string;
  userText: string;
  input: { modelId: string };
  engine: ReturnType<typeof getChatEngine>;
  user: { id: string; email: string; role: string; plan: string };
  isClearCmd: boolean;
}

async function runRulesPath(args: RulesPathArgs): Promise<Response> {
  const { req, convId, conversationTitle, userText, input, engine, user, isClearCmd } = args;

  let result;
  try {
    result = await engine.process({
      message: userText,
      conversationId: convId,
      userId: user.id,
      user: { id: user.id, email: user.email, role: user.role, plan: user.plan },
    });
  } catch (e) {
    console.error("[local-chat] engine error:", e);
    return fail(502, "Bộ máy chat cục bộ gặp lỗi. Thử lại sau.");
  }

  // Fallback khi KHÔNG có model runtime → thông điệp trung thực + hướng dẫn
  if (result.intent === null && result.confidence === 0 && !isClearCmd && !userText.startsWith("/")) {
    const runtime = await getRuntimeStatus().catch(() => null);
    if (!runtime?.available) {
      result = {
        ...result,
        text:
          result.text +
          "\n\n_(Mình đang chạy **chế độ tri thức cục bộ** — chưa có model AI cục bộ nào đang chạy. " +
          "Chạy `bash scripts/setup-ollama.sh` trên máy chủ để bật suy luận model thật, sau đó mình trả " +
          "lời thoải mái mọi câu hỏi ngoài tri thức)_",
      };
    }
  }

  return streamRulesResult({
    req,
    convId,
    conversationTitle,
    result,
    user,
    isClearCmd,
  });
}

/** Chia text thành chunk ~3-5 từ, giữ xuống dòng để render markdown mượt. */
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const parts = text.split(/(\n+)/);
  for (const part of parts) {
    if (!part) continue;
    if (/^\n+$/.test(part)) {
      chunks.push(part);
      continue;
    }
    const words = part.split(" ");
    for (let i = 0; i < words.length; i += 4) {
      chunks.push(words.slice(i, i + 4).join(" ") + (i + 4 < words.length ? " " : ""));
    }
  }
  return chunks;
}

async function streamRulesResult(args: {
  req: Request;
  convId: string;
  conversationTitle: string;
  result: Awaited<ReturnType<ReturnType<typeof getChatEngine>["process"]>>;
  user: { id: string };
  isClearCmd: boolean;
}): Promise<Response> {
  const { req, convId, conversationTitle, result, isClearCmd } = args;

  const finalText = result.text || "_[không có nội dung]_";
  const messageId = isClearCmd
    ? null
    : await saveAssistantMessage(convId, finalText, result.intent, DEFAULT_MODEL_ID, estimateTokens(finalText));

  recordRequest({
    at: Date.now(),
    conversationId: convId,
    userId: args.user.id,
    model: "khanhos-core",
    runtime: "local-rules",
    profile: result.intent?.startsWith("command:") ? "COMMAND" : "GENERAL",
    complexity: null,
    timeToFirstTokenMs: null,
    totalMs: null,
    tokensPerSecond: null,
    outputTokens: null,
    promptTokens: null,
    tokensEstimated: true,
    verification: null,
    toolCalls: 0,
    retries: 0,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(payload)));
        } catch {
          // stream đã đóng
        }
      };

      send({
        type: "meta",
        conversationId: convId,
        title: conversationTitle,
        modelId: DEFAULT_MODEL_ID,
        sources: [],
      });
      send({ type: "status", stage: "collecting_context", label: "Đang tra tri thức cục bộ…" });

      const chunks = chunkText(finalText);
      const perChunk = Math.min(30, Math.max(8, Math.round(900 / Math.max(1, chunks.length))));
      for (const chunk of chunks) {
        if (req.signal.aborted) break;
        send({ type: "delta", delta: chunk });
        await new Promise((r) => setTimeout(r, perChunk));
      }

      send({
        type: "done",
        conversationId: convId,
        messageId: messageId ?? undefined,
        interrupted: false,
        content: finalText,
        intent: result.intent,
        confidence: result.confidence,
        source: "local-rules",
        language: result.language,
        suggestions: result.suggestions,
        action: result.action,
      });
      controller.close();
    },
    cancel() {},
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ═════════════════════════════════════════════
// NHÁNH MODEL AI CỤC BỘ (inference thật, streaming thật)
// ═════════════════════════════════════════════

interface ModelPathArgs {
  req: Request;
  convId: string;
  conversationTitle: string;
  userText: string;
  input: { modelId: string };
  user: { id: string; email: string; role: string; plan: string };
  dbHistory: Array<{ role: string; content: string }>;
  orch: NonNullable<Awaited<ReturnType<typeof getAIOrchestrator>>>;
  model: string; // runtime name thật, vd "qwen2.5:0.5b"
  modelIdLabel: string; // id hiển thị, vd "runtime:qwen2.5:0.5b" hoặc "khanhos-core"
  localKnowledge?: string;
  history: HistoryMessage[];
}

async function runModelPath(args: ModelPathArgs): Promise<Response> {
  const { req, convId, conversationTitle, userText, input, user, orch, model, modelIdLabel, localKnowledge, history } =
    args;

  const language = detectLangVi(userText);
  const abortController = new AbortController();
  const onClientAbort = () => abortController.abort();
  req.signal.addEventListener("abort", onClientAbort, { once: true });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(payload)));
        } catch {
          // stream đã đóng
        }
      };

      send({
        type: "meta",
        conversationId: convId,
        title: conversationTitle,
        modelId: input.modelId,
        sources: [],
      });

      let result;
      try {
        result = await orch.reasoning.run(
          {
            message: userText,
            conversationId: convId,
            userId: user.id,
            history,
            language,
            model,
            localKnowledge,
            signal: abortController.signal,
          },
          {
            onStatus: (stage, label) => send({ type: "status", stage, label }),
            onDelta: (delta) => send({ type: "delta", delta }),
            onToolStart: (call) =>
              send({ type: "tool_call", id: call.id, name: call.name, args: call.args }),
            onToolEnd: (res) =>
              send({
                type: "tool_result",
                id: res.callId,
                name: res.name,
                ok: res.ok,
                output: res.output.slice(0, 500),
              }),
            onVerification: (v) =>
              send({
                type: "verification",
                passed: v.passed,
                severity: v.severity,
                checks: v.checks.map((c) => ({ name: c.name, passed: c.passed })),
              }),
          }
        );
      } catch (e) {
        console.error("[ai/model] reasoning error:", e);
        req.signal.removeEventListener("abort", onClientAbort);
        send({
          type: "error",
          message:
            "Model AI cục bộ gặp lỗi khi sinh phản hồi. Thử lại, hoặc dùng bộ máy tri thức cục bộ (khanhos-core).",
        });
        controller.close();
        return;
      }
      req.signal.removeEventListener("abort", onClientAbort);

      const finalText = result.text || "_[không có nội dung]_";
      const promptEst = estimateTokens(userText) + (result.usage.estimated ? 0 : 0);
      const tokensUsed =
        result.usage.estimated || result.usage.promptTokens === 0
          ? estimateTokens(finalText) + promptEst // ước lượng trung thực
          : Math.max(1, Math.round(result.usage.outputTokens * 0.4 + result.usage.promptTokens * 0.25));

      const messageId = await saveAssistantMessage(
        convId,
        finalText,
        null,
        modelIdLabel,
        tokensUsed
      );

      recordRequest({
        at: Date.now(),
        conversationId: convId,
        userId: user.id,
        model: result.interrupted ? `${model} (đã dừng)` : model,
        runtime: orch.status.runtime,
        profile: result.profile,
        complexity: result.router.complexity,
        timeToFirstTokenMs: result.timeToFirstTokenMs,
        totalMs: result.totalMs,
        tokensPerSecond: result.tokensPerSecond,
        outputTokens: result.usage.outputTokens,
        promptTokens: result.usage.promptTokens,
        tokensEstimated: result.usage.estimated,
        verification: result.verification
          ? {
              passed: result.verification.passed,
              checks: result.verification.checks.map((c) => ({ name: c.name, passed: c.passed })),
            }
          : null,
        toolCalls: result.toolCalls,
        retries: result.retries,
      });

      send({
        type: "done",
        conversationId: convId,
        messageId: messageId ?? undefined,
        interrupted: result.interrupted,
        content: finalText,
        intent: null,
        confidence: null,
        source: "local-model",
        model,
        profile: result.profile,
        complexity: result.router.complexity,
        language,
        metrics: {
          timeToFirstTokenMs: result.timeToFirstTokenMs ? Math.round(result.timeToFirstTokenMs) : null,
          totalMs: Math.round(result.totalMs),
          tokensPerSecond: result.tokensPerSecond ? Math.round(result.tokensPerSecond * 10) / 10 : null,
          outputTokens: result.usage.outputTokens,
          promptTokens: result.usage.promptTokens,
          estimated: result.usage.estimated,
        },
        verification: result.verification
          ? {
              passed: result.verification.passed,
              severity: result.verification.severity,
            }
          : null,
      });
      controller.close();
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function saveAssistantMessage(
  conversationId: string,
  content: string,
  intent: string | null,
  modelId: string,
  tokens: number
) {
  const message = await db.message.create({
    data: {
      conversationId,
      role: "assistant",
      content,
      modelId,
      tokens,
      sources: null, // engine cục bộ không truy cập web
    },
  });
  await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date(), modelId },
  });
  return message.id;
}
