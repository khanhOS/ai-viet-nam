// /api/feedback — Ghi nhận đánh giá 👍/👎 của user cho phản hồi AI.
// Dữ liệu vào AiFeedback → nguồn dataset huấn luyện (Training).
// POST {messageId?, conversationId?, rating: "up"|"down", comment?}

import { fail } from "@/lib/api-helpers";
import { getSessionUser } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rate-limit";
import { recordFeedback, feedbackStats } from "@/ai/evaluation/feedback";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail(403, "Yêu cầu không hợp lệ");
  const user = await getSessionUser();
  if (!user) return fail(401, "Chưa đăng nhập");

  const rl = rateLimit(`feedback:${user.id}`, 30, 60 * 1000);
  if (!rl.allowed) {
    return fail(429, `Đánh giá quá nhanh. Thử lại sau ${rl.retryAfterSec}s.`);
  }

  const body = await req.json().catch(() => null);
  const rating = body?.rating === "up" || body?.rating === "down" ? body.rating : null;
  const messageId = typeof body?.messageId === "string" && body.messageId ? body.messageId : null;
  const conversationId =
    typeof body?.conversationId === "string" && body.conversationId ? body.conversationId : null;
  const comment = typeof body?.comment === "string" ? body.comment : undefined;

  if (!rating) return fail(400, "Đánh giá phải là 'up' hoặc 'down'");
  if (!messageId && !conversationId) return fail(400, "Thiếu messageId hoặc conversationId");

  const result = await recordFeedback({
    userId: user.id,
    messageId,
    conversationId,
    rating,
    comment,
  });
  if (!result.ok) return fail(400, result.reason ?? "Không ghi nhận được đánh giá");

  const stats = await feedbackStats(user.id);
  return Response.json({ ok: true, id: result.id, stats });
}
