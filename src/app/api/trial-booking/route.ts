// POST /api/trial-booking — Đăng ký buổi tập thử (Iron Forge)
// Form công khai: không cần tài khoản; rate limit theo IP chống spam.

import { db } from "@/lib/db";
import { trialBookingSchema, firstZodError } from "@/lib/security/validation";
import { guard, ok, fail } from "@/lib/api-helpers";
import { getClientIp } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  const g = await guard(req, {
    requireAuth: false,
    rateLimit: {
      key: `trial-booking:${getClientIp(req)}`,
      limit: 3,
      windowMs: 10 * 60 * 1000,
    },
  });
  if (g.response) return g.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Body JSON không hợp lệ");
  }

  const parsed = trialBookingSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, firstZodError(parsed.error));
  }

  const { name, phone, goal, preferredTime, note } = parsed.data;

  const booking = await db.trialBooking.create({
    data: { name, phone, goal, preferredTime, note: note || null },
    select: { id: true },
  });

  return ok({
    booking: { id: booking.id },
    message: "Đã nhận đăng ký. Huấn luyện viên sẽ liên hệ xác nhận trong 24 giờ.",
  });
}
