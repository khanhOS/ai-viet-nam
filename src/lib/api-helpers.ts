// KhanhOS AI — API helpers dùng chung cho mọi route handler

import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rate-limit";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...data }, init);
}

export function fail(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export interface GuardOptions {
  /** Yêu cầu đã đăng nhập */
  requireAuth: boolean;
  /** Yêu cầu same-origin cho mutating requests (mặc định true với non-GET) */
  requireOrigin?: boolean;
  /** Rate limit — key do route tự build (kèm ip/userId) */
  rateLimit?: { key: string; limit: number; windowMs: number };
}

export interface GuardResult {
  response?: NextResponse;
  user?: SessionUser;
}

/** Chạy các kiểm tra chung: origin, rate limit, auth. */
export async function guard(
  req: Request,
  options: GuardOptions
): Promise<GuardResult> {
  // 1. CSRF origin check cho mutating requests
  if (options.requireOrigin !== false && req.method !== "GET") {
    if (!isSameOrigin(req)) {
      return { response: fail(403, "Yêu cầu không hợp lệ (origin)") };
    }
  }

  // 2. Rate limit (key đã kèm định danh từ route)
  if (options.rateLimit) {
    const { key, limit, windowMs } = options.rateLimit;
    const rl = rateLimit(key, limit, windowMs);
    if (!rl.allowed) {
      return {
        response: fail(429, `Thao tác quá nhanh. Thử lại sau ${rl.retryAfterSec}s.`, {
          retryAfter: rl.retryAfterSec,
        }),
      };
    }
  }

  // 3. Auth
  if (options.requireAuth) {
    const user = await getSessionUser();
    if (!user) {
      return { response: fail(401, "Chưa đăng nhập") };
    }
    return { user };
  }

  return {};
}
