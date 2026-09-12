// POST /api/auth/login — Đăng nhập

import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { loginSchema, firstZodError } from "@/lib/security/validation";
import { guard, ok, fail } from "@/lib/api-helpers";
import { getClientIp } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  const g = await guard(req, {
    requireAuth: false,
    rateLimit: { key: `login:${getClientIp(req)}`, limit: 10, windowMs: 60 * 1000 },
  });
  if (g.response) return g.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Body JSON không hợp lệ");
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, firstZodError(parsed.error));
  }

  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  // Thông báo lỗi chung để không lộ email nào tồn tại
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return fail(401, "Email hoặc mật khẩu không đúng");
  }

  await createSession(user.id, req.headers.get("user-agent") ?? undefined);

  return ok({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, plan: user.plan, avatarSeed: user.avatarSeed },
  });
}
