// POST /api/auth/reset-password — Đặt lại mật khẩu bằng token one-time

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { consumePasswordResetToken } from "@/lib/auth/reset-token";
import { destroyAllUserSessions } from "@/lib/auth/session";
import { resetPasswordSchema, firstZodError } from "@/lib/security/validation";
import { guard, ok, fail } from "@/lib/api-helpers";
import { getClientIp } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  const g = await guard(req, {
    requireAuth: false,
    rateLimit: { key: `reset:${getClientIp(req)}`, limit: 10, windowMs: 15 * 60 * 1000 },
  });
  if (g.response) return g.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Body JSON không hợp lệ");
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, firstZodError(parsed.error));
  }

  const { token, password } = parsed.data;

  const result = await consumePasswordResetToken(token);
  if (!result.ok) {
    const messages: Record<string, string> = {
      invalid: "Mã đặt lại không hợp lệ",
      expired: "Mã đặt lại đã hết hạn (60 phút). Hãy yêu cầu mã mới.",
      used: "Mã này đã được sử dụng. Hãy yêu cầu mã mới.",
    };
    return fail(400, messages[result.reason]);
  }

  const passwordHash = await hashPassword(password);
  await db.user.update({
    where: { id: result.userId },
    data: { passwordHash },
  });

  // Bảo mật: đăng xuất mọi phiên cũ sau khi đổi mật khẩu
  await destroyAllUserSessions(result.userId);

  return ok({ message: "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập lại." });
}
