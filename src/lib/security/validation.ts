// KhanhOS AI — Zod validation schemas cho mọi input từ client

import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email là bắt buộc")
  .max(254, "Email quá dài")
  .email("Email không hợp lệ")
  .transform((v) => v.toLowerCase());

// Chính sách mật khẩu KhanhOS AI (theo yêu cầu owner):
// - Không bắt buộc chữ số / chữ cái / ký tự đặc biệt
// - Tối thiểu 4 ký tự, tối đa 128 ký tự
export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Mật khẩu phải có ít nhất ${PASSWORD_MIN} ký tự`)
  .max(PASSWORD_MAX, `Mật khẩu quá dài (tối đa ${PASSWORD_MAX} ký tự)`);

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Tên hiển thị là bắt buộc")
  .max(50, "Tên hiển thị tối đa 50 ký tự");

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Xác nhận mật khẩu không khớp",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Mật khẩu là bắt buộc"),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "Token không hợp lệ"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Xác nhận mật khẩu không khớp",
    path: ["confirmPassword"],
  });

export const chatRequestSchema = z.object({
  conversationId: z.string().cuid().optional(),
  content: z.string().trim().min(1, "Tin nhắn trống").max(32_000, "Tin nhắn quá dài").optional(),
  modelId: z.string().min(1).max(64),
  webSearch: z.boolean().optional().default(false),
  regenerate: z.boolean().optional().default(false),
  attachments: z
    .array(
      z.object({
        name: z.string().max(255),
        size: z.number().int().min(0).max(10 * 1024 * 1024),
        type: z.string().max(128),
        textContent: z.string().max(120_000).optional(),
      })
    )
    .max(5, "Tối đa 5 tệp đính kèm")
    .optional()
    .default([]),
});

export const conversationPatchSchema = z.object({
  title: z.string().trim().min(1, "Tiêu đề trống").max(120, "Tiêu đề tối đa 120 ký tự"),
});

export const settingsPatchSchema = z.object({
  defaultModelId: z.string().max(64).nullable().optional(),
  webSearchEnabled: z.boolean().optional(),
  reducedMotionPref: z.enum(["system", "on", "off"]).optional(),
  theme: z.enum(["dark", "light", "system"]).optional(),
});

// ── Nâng cấp gói dịch vụ (Free/Plus/VIP/Max) ──
// SĐT Việt Nam chuẩn hoá: bỏ khoảng trắng/dấu/gạch nối, +84/84 → 0
const vnPhoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.\-()]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^(\+84|84|0)(3|5|7|8|9)\d{8}$/, "Số điện thoại Việt Nam không hợp lệ")
      .transform((v) => v.replace(/^\+?84/, "0"))
  );

export const planRequestSchema = z.object({
  plan: z.enum(["plus", "vip", "max"], { message: "Gói nâng cấp không hợp lệ" }),
  phone: vnPhoneSchema,
  momoNumber: vnPhoneSchema, // số MoMo dùng để thanh toán
  contactEmail: emailSchema,
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự").optional(),
});

export const planDecisionSchema = z.object({
  action: z.enum(["approve", "reject"], { message: "Hành động không hợp lệ" }),
});

// ── Đặt buổi tập thử (Iron Forge) ──
export const trialBookingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Vui lòng nhập họ tên")
    .max(60, "Họ tên tối đa 60 ký tự"),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s.\-()]/g, ""))
    .pipe(
      z
        .string()
        .regex(/^(\+84|84|0)(3|5|7|8|9)\d{8}$/, "Số điện thoại Việt Nam không hợp lệ")
        .transform((v) => v.replace(/^\+?84/, "0")) // +84/84 → 0, lưu định dạng VN
    ),
  goal: z.enum(["muscle", "fatloss", "fitness"], {
    message: "Vui lòng chọn mục tiêu",
  }),
  preferredTime: z.enum(["morning", "noon", "afternoon", "evening"], {
    message: "Vui lòng chọn khung giờ",
  }),
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự").optional(),
});

export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dữ liệu không hợp lệ";
}
