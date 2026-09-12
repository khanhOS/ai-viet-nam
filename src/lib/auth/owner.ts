// KhanhOS AI — Chính sách tài khoản Chủ sở hữu (owner)
// -----------------------------------------------------
// Email owner đọc từ env OWNER_EMAIL — hỗ trợ NHIỀU email, cách nhau bằng dấu phẩy.
// Mặc định gồm cả hai cách viết của email chủ sở hữu:
//   hoangbaokhanhhehe@gmail.com  •  haongbaokhanhhehe@gmail.com
// (Hai tin nhắn của chủ viết khác chính tả "hoang…"/"haong…" — hỗ trợ cả hai
//  để không bao giờ mất quyền owner vì lỗi gõ. Khi chắc chắn email thật:
//  sửa OWNER_EMAIL trong .env và xoá email sai — không cần sửa code.)
//
// Quyền owner:
//   • Đăng ký (register) email này ⇒ LUÔN nhận role "owner".
//   • KHÔNG bị giới hạn hạn mức dùng hàng tháng (vô hạn — xem plans.ts).
//   • Duyệt yêu cầu nâng cấp gói của người dùng (plan-requests).

export const OWNER_EMAILS: readonly string[] = (
  process.env.OWNER_EMAIL ??
  "hoangbaokhanhhehe@gmail.com,haongbaokhanhhehe@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter((e) => e.length > 0);

/** Email owner chính (dùng hiển thị / seed mặc định) — phần tử đầu của danh sách. */
export const OWNER_EMAIL = OWNER_EMAILS[0];

export type UserRole = "user" | "owner";

/** Role mặc định khi tạo user mới — email owner luôn được nâng lên "owner". */
export function roleForEmail(email: string): UserRole {
  return isOwnerEmail(email) ? "owner" : "user";
}

/** Kiểm tra email có nằm trong danh sách email chủ sở hữu không. */
export function isOwnerEmail(email: string): boolean {
  return OWNER_EMAILS.includes(email.trim().toLowerCase());
}
