// KhanhOS AI — Token hashing với AUTH_SECRET (HMAC pepper)
// Session token & reset token đều được hash bằng HMAC-SHA256 với AUTH_SECRET
// trước khi lưu DB → kẻ tấn công có được dump DB cũng không giả được token.
// Đổi AUTH_SECRET = invalidating mọi session/token (hành vi đúng, an toàn).

import { createHmac } from "crypto";

const DEV_FALLBACK = "khanhos-dev-pepper-do-not-use-in-production";

export function hashToken(input: string): string {
  const secret = process.env.AUTH_SECRET?.trim() || DEV_FALLBACK;
  return createHmac("sha256", secret).update(input).digest("hex");
}
