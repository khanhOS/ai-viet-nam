// GET   /api/user — Thông tin user hiện tại (từ session)
// PATCH /api/user — Cập nhật hồ sơ (name)

import { db } from "@/lib/db";
import { guard, ok, fail } from "@/lib/api-helpers";
import { nameSchema, firstZodError } from "@/lib/security/validation";
import { z } from "zod";

const profilePatchSchema = z.object({
  name: nameSchema.optional(),
});

export async function GET(req: Request) {
  const g = await guard(req, { requireAuth: true });
  if (g.response) return g.response;

  const user = g.user!;
  return ok({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan,
      avatarSeed: user.avatarSeed,
      createdAt: user.createdAt,
    },
  });
}

export async function PATCH(req: Request) {
  const g = await guard(req, { requireAuth: true });
  if (g.response) return g.response;
  const user = g.user!;

  const body = await req.json().catch(() => null);
  const parsed = profilePatchSchema.safeParse(body);
  if (!parsed.success) return fail(400, firstZodError(parsed.error));

  if (parsed.data.name === undefined) {
    return fail(400, "Không có trường nào để cập nhật");
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      plan: true,
      avatarSeed: true,
      createdAt: true,
    },
  });

  return ok({ user: updated });
}
