// PATCH /api/plan-requests/[id] — Duyệt / từ chối yêu cầu nâng cấp (CHỦ SỞ HỮU)
// approve ⇒ status=approved + user.plan=plan + planUpdatedAt=now
// reject  ⇒ status=rejected + decidedAt=now

import { db } from "@/lib/db";
import { guard, ok, fail } from "@/lib/api-helpers";
import { planDecisionSchema, firstZodError } from "@/lib/security/validation";
import { getPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { requireAuth: true });
  if (g.response) return g.response;
  const user = g.user!;

  if (user.role !== "owner") {
    return fail(403, "Chỉ chủ sở hữu mới duyệt được yêu cầu");
  }

  const body = await req.json().catch(() => null);
  const parsed = planDecisionSchema.safeParse(body);
  if (!parsed.success) return fail(400, firstZodError(parsed.error));
  const { action } = parsed.data;

  const { id } = await ctx.params;
  const request = await db.planRequest.findUnique({ where: { id } });
  if (!request) return fail(404, "Không tìm thấy yêu cầu");
  if (request.status !== "pending") {
    return fail(409, `Yêu cầu này đã được xử lý (${request.status})`);
  }

  if (action === "approve") {
    const [updated] = await db.$transaction([
      db.planRequest.update({
        where: { id },
        data: { status: "approved", decidedAt: new Date() },
      }),
      db.user.update({
        where: { id: request.userId },
        data: { plan: request.plan, planUpdatedAt: new Date() },
      }),
    ]);
    return ok({ request: updated, upgradedPlan: request.plan });
  }

  const rejected = await db.planRequest.update({
    where: { id },
    data: { status: "rejected", decidedAt: new Date() },
  });
  return ok({ request: rejected });
}
