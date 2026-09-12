// KhanhOS AI — Safety Guardrails: đầu vào/đầu ra an toàn, không lộ secret.

import path from "node:path";

export interface GuardrailResult {
  clean: string; // chuỗi đã làm sạch
  redacted: string[]; // mô tả thứ đã bị che
  injectionSuspected: boolean;
}

const SECRET_PATTERNS: Array<{ name: string; re: RegExp; mask: string }> = [
  { name: "api_key_generic", re: /\b(sk-[A-Za-z0-9_-]{16,}|rk-[A-Za-z0-9_-]{16,})\b/g, mask: "[đã che khoá]" },
  { name: "bearer_token", re: /\bBearer\s+[A-Za-z0-9._-]{16,}\b/gi, mask: "[đã che khoá]" },
  { name: "password_assignment", re: /\b(password|passwd|mật khẩu|mat khau)\s*[:=]\s*\S{6,}/gi, mask: "$1: [đã che]" },
  { name: "private_key_block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, mask: "[đã che khoá riêng]" },
  { name: "env_secret", re: /\b(DATABASE_URL|SECRET_KEY|API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY)\s*=\s*\S+/g, mask: "$1=[đã che]" },
];

const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior) instructions/i,
  /bỏ qua (mọi )?(chỉ dẫn|hướng dẫn|quy tắc) (trước|trên)/i,
  /disregard (the )?(system|above)/i,
  /reveal (your )?(system prompt|instructions)/i,
  /in ra (system prompt|chỉ dẫn hệ thống)/i,
  /you are now (a|an) /i,
];

/** Làm sạch input user: che secret, cắt ký tự điều khiển, chống prompt injection. */
export function sanitizeInput(text: string): GuardrailResult {
  const redacted: string[] = [];
  let clean = text;

  for (const p of SECRET_PATTERNS) {
    if (p.re.test(clean)) {
      redacted.push(p.name);
      clean = clean.replace(p.re, p.mask);
    }
    p.re.lastIndex = 0;
  }

  // Ký tự điều khiển (trừ \n \t)
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  const injectionSuspected = INJECTION_PATTERNS.some((re) => re.test(text));

  return { clean, redacted, injectionSuspected };
}

/** Kiểm tra output model trước khi hiển thị — che secret nếu model lỡ nhả ra. */
export function sanitizeOutput(text: string): GuardrailResult {
  return sanitizeInput(text);
}

/** Chặn lộ đường dẫn nhạy cảm trong output agent (chống path traversal). */
export function isPathSafe(pathname: string, allowedRoots: string[]): boolean {
  const normalized = path.normalize(pathname).replace(/\.\./g, "").replace(/\\/g, "/");
  const allowed = allowedRoots.map((r) => path.normalize(r).replace(/\\/g, "/"));
  return allowed.some((root) => normalized.startsWith(root));
}
