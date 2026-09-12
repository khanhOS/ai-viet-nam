// GET /api/plans — Danh sách gói + trạng thái usage của user hiện tại
// Public (không cần đăng nhập): trả danh sách gói để render pricing.
// Đã đăng nhập: kèm plan hiện tại + token đã dùng tháng này + yêu cầu đang chờ.

import { getSessionUser } from "@/lib/auth/session";
import { ok } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { PLANS, PAYMENT_INFO } from "@/lib/plans";
import { getPlanUsage } from "@/lib/plan-usage";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();

  // Khách: chỉ cần pricing công khai
  if (!user) {
    return ok({ plans: PLANS, payment: PAYMENT_INFO, plan: null, usage: null, pendingRequest: null });
  }

  const [usage, pending] = await Promise.all([
    getPlanUsage(user.plan, user.role, user.id),
    db.planRequest.findFirst({
      where: { userId: user.id, status: "pending" },
      orderBy: { createdAt: "desc" },
      select: { id: true, plan: true, createdAt: true },
    }),
  ]);

  return ok({
    plans: PLANS,
    payment: PAYMENT_INFO,
    plan: user.plan,
    role: user.role,
    usage: {
      plan: usage.plan,
      planName: usage.planName,
      usage: usage.usage,
      limit: Number.isFinite(usage.limit) ? usage.limit : null, // null = không giới hạn
      remaining: Number.isFinite(usage.remaining) ? usage.remaining : null,
    },
    pendingRequest: pending,
  });
}
