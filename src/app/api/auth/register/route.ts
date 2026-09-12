// POST /api/auth/register — Đăng ký tài khoản

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { registerSchema, firstZodError } from "@/lib/security/validation";
import { guard, ok, fail } from "@/lib/api-helpers";
import { getClientIp } from "@/lib/security/rate-limit";
import { roleForEmail } from "@/lib/auth/owner";

export async function POST(req: Request) {
  const g = await guard(req, {
    requireAuth: false,
    rateLimit: { key: `register:${getClientIp(req)}`, limit: 5, windowMs: 60 * 60 * 1000 },
  });
  if (g.response) return g.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Body JSON không hợp lệ");
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, firstZodError(parsed.error));
  }

  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return fail(409, "Email này đã được đăng ký");
  }

  const passwordHash = await hashPassword(password);
  // Email chủ sở hữu ⇒ luôn nhận role "owner" (yêu cầu owner)
  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: roleForEmail(email),
      avatarSeed: Math.random().toString(36).slice(2, 10),
    },
  });

  // Tạo settings mặc định + session
  await db.userSettings.create({ data: { userId: user.id } }).catch(() => {});
  await createSession(user.id, req.headers.get("user-agent") ?? undefined);

  return ok({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, plan: user.plan, avatarSeed: user.avatarSeed },
  });
}
