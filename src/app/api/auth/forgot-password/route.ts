// POST /api/auth/forgot-password — Gửi yêu cầu đặt lại mật khẩu
// Luôn trả 200 với thông điệp chung (không lộ email nào tồn tại).
// Sandbox chưa có email provider → EmailService (dev) log link;
// khi EMAIL_PROVIDER chưa cấu hình và KHÔNG phải production, response
// kèm devResetLink để test được toàn bộ flow.

import { db } from "@/lib/db";
import { issuePasswordResetToken } from "@/lib/auth/reset-token";
import { forgotPasswordSchema, firstZodError } from "@/lib/security/validation";
import { emailService } from "@/lib/email/email-service";
import { guard, ok, fail } from "@/lib/api-helpers";
import { getClientIp } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  const g = await guard(req, {
    requireAuth: false,
    rateLimit: { key: `forgot:${getClientIp(req)}`, limit: 5, windowMs: 15 * 60 * 1000 },
  });
  if (g.response) return g.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Body JSON không hợp lệ");
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, firstZodError(parsed.error));
  }

  const { email } = parsed.data;
  const genericMessage =
    "Nếu email đó tồn tại trong hệ thống, đường dẫn đặt lại mật khẩu đã được gửi.";

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    // Trả giống hệt trường hợp có user — chống user enumeration
    return ok({ message: genericMessage });
  }

  const { token } = await issuePasswordResetToken(user.id);

  // Base URL cho link reset — ưu tiên env (đúng domain production)
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  const resetLink = `${base}/reset-password?token=${encodeURIComponent(token)}`;

  const sendResult = await emailService.sendPasswordResetEmail(email, resetLink);

  const emailConfigured = process.env.EMAIL_PROVIDER === "resend";

  return ok({
    message: genericMessage,
    // Chỉ lộ link trong môi trường dev/test khi chưa có email thật
    ...(emailConfigured
      ? {}
      : process.env.NODE_ENV === "production" && sendResult.ok
        ? {}
        : {
            devResetLink: resetLink,
            devNote: "Chưa cấu hình EMAIL_PROVIDER — link hiển thị ở đây để test flow.",
          }),
  });
}
