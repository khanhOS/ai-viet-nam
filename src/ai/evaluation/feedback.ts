// KhanhOS AI — Evaluation & Feedback loop.
// EVALUATION → MEMORY/FEEDBACK/TRAINING DATASET (bước cuối trong kiến trúc):
// - User đánh giá 👍/👎 phản hồi → AiFeedback (nguồn dữ liệu huấn luyện THẬT)
// - Self-evaluation của VerifierEngine được ghi nhận (metrics + verification)
// - Feedback 👍 trực tiếp góp vào dataset qua src/ai/training/dataset.ts
//
// TRUNG THỰC: feedback là dữ liệu huấn luyện cho LẦN fine-tune sau (LoRA),
// không tự đổi weights model đang chạy. Phản hồi 👍 cũng KHÔNG làm AI "học
// ngay" — nó vào dataset đợi huấn luyện.

import { db } from "@/lib/db";
import { rememberLongTerm } from "@/ai/memory/manager";

export interface FeedbackInput {
  userId: string;
  messageId: string | null;
  conversationId: string | null;
  rating: "up" | "down";
  comment?: string;
}

export interface FeedbackResult {
  ok: boolean;
  id?: string;
  reason?: string;
}

/** Ghi nhận đánh giá của user cho 1 phản hồi của AI (kèm snapshot hỏi-đáp). */
export async function recordFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const { userId, messageId, conversationId, rating } = input;

  let question = "";
  let answer = "";
  let source = "local-rules";

  if (messageId) {
    const msg = await db.message.findFirst({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (!msg || msg.conversation.userId !== userId) {
      return { ok: false, reason: "Không tìm thấy tin nhắn" };
    }
    // Lấy tin user NGAY TRƯỚC tin assistant này làm câu hỏi
    const prevUser = await db.message.findFirst({
      where: { conversationId: msg.conversationId, role: "user", createdAt: { lt: msg.createdAt } },
      orderBy: { createdAt: "desc" },
    });
    question = prevUser?.content ?? "";
    answer = msg.content;
    source = msg.modelId?.startsWith("runtime:") || msg.modelId?.includes("qwen") ? "local-model" : "local-rules";
  } else if (conversationId) {
    const conv = await db.conversation.findFirst({ where: { id: conversationId, userId } });
    if (!conv) return { ok: false, reason: "Không tìm thấy hội thoại" };
    const lastAssistant = await db.message.findFirst({
      where: { conversationId, role: "assistant" },
      orderBy: { createdAt: "desc" },
    });
    const prevUser = await db.message.findFirst({
      where: { conversationId, role: "user" },
      orderBy: { createdAt: "desc" },
    });
    question = prevUser?.content ?? "";
    answer = lastAssistant?.content ?? "";
  }

  if (!question.trim() && !answer.trim()) {
    return { ok: false, reason: "Không đủ dữ liệu để ghi nhận đánh giá" };
  }

  const created = await db.aiFeedback.create({
    data: {
      userId,
      messageId: messageId,
      conversationId,
      rating,
      comment: input.comment?.trim().slice(0, 500) || null,
      question: question.slice(0, 6000),
      answer: answer.slice(0, 6000),
      source,
    },
  });

  // Feedback có ghi chú mang tính sở thích ("nên trả lời ngắn hơn…") →
  // đưa vào long-term memory để điều chỉnh NGAY từ câu sau (prompt-level).
  if (input.comment && input.comment.trim().length >= 8) {
    const key = `feedback:${rating}:${Date.now().toString(36)}`;
    await rememberLongTerm(
      userId,
      key,
      rating === "up"
        ? `User khen và góp ý: ${input.comment.trim().slice(0, 400)}`
        : `User phê bình: ${input.comment.trim().slice(0, 400)}`,
    ).catch(() => undefined);
  }

  return { ok: true, id: created.id };
}

/** Thống kê feedback (cho panel diagnostics + training). */
export async function feedbackStats(userId?: string): Promise<{
  up: number;
  down: number;
  total: number;
}> {
  const [up, down] = await Promise.all([
    db.aiFeedback.count({ where: { rating: "up", ...(userId ? { userId } : {}) } }),
    db.aiFeedback.count({ where: { rating: "down", ...(userId ? { userId } : {}) } }),
  ]);
  return { up, down, total: up + down };
}
