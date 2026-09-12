// GET /api/auth/me — Thông tin user hiện tại từ session

import { getSessionUser } from "@/lib/auth/session";
import { ok } from "@/lib/api-helpers";

export async function GET() {
  const user = await getSessionUser();
  return ok({ user });
}
