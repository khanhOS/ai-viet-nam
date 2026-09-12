// POST /api/auth/logout — Đăng xuất

import { destroySession } from "@/lib/auth/session";
import { guard, ok } from "@/lib/api-helpers";

export async function POST(req: Request) {
  const g = await guard(req, { requireAuth: false });
  if (g.response) return g.response;

  await destroySession();
  return ok({});
}
