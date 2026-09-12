// POST /api/plan-requests — Gửi yêu cầu nâng cấp gói (Plus/VIP/Max)
// GET  /api/plan-requests — Danh sách yêu cầu (CHỦ SỞ HỮU)
//
// Flow: user chọn gói → xem thông tin chuyển khoản (MoMo) → điền SĐT + Gmail
// + ghi chú → gửi. Chủ sở hữu duyệt ở PlansModal → user.plan được cập nhật.

import { db } from "@/lib/db";
import { guard, ok, fail } from "@/lib/api-helpers";
import { getClientIp } from "@/lib/security/rate-limit";
import { planRequestSchema, firstZodError } from "@/lib/security/validation";
import { getPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guard(req, {
    requireAuth: true,
    rateLimit: { key: `planreq:${getClientIp(req)}`, limit: 3, windowMs: 10 * 60 * 1000 },
  });
  if (g.response) return g.response;
  const user = g.user!;

  const body = await req.json().catch(() => null);
  const parsed = planRequestSchema.safeParse(body);
  if (!parsed.success) return fail(400, firstZodError(parsed.error));
  const { plan, phone, momoNumber, contactEmail, note } = parsed.data;

  // Không cho yêu cầu gói mình đang dùng
  if (user.plan === plan) {
    return fail(400, `Bạn đang ở gói ${getPlan(plan).name} rồi`);
  }

  // Chỉ 1 yêu cầu đang chờ duyệt mỗi user
  const pending = await db.planRequest.findFirst({
    where: { userId: user.id, status: "pending" },
  });
  if (pending) {
    return fail(409, "Bạn đã có một yêu cầu nâng cấp đang chờ duyệt");
  }

  const request = await db.planRequest.create({
    data: { userId: user.id, plan, phone, momoNumber, contactEmail, note: note ?? null },
  });

  return ok({
    request: {
      id: request.id,
      plan: request.plan,
      status: request.status,
      createdAt: request.createdAt,
    },
  });
}

export async function GET(req: Request) {
  const g = await guard(req, { requireAuth: true, requireOrigin: false });
  if (g.response) return g.response;
  const user = g.user!;

  if (user.role !== "owner") {
    return fail(403, "Chỉ chủ sở hữu mới xem được danh sách yêu cầu");
  }

  const requests = await db.planRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }], // pending trước, mới nhất trước
    take: 100,
    include: {
      user: { select: { id: true, name: true, email: true, plan: true, role: true } },
    },
  });

  return ok({ requests });
}
