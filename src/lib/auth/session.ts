// KhanhOS AI — Session management (server-side session + httpOnly cookie)
// Token gốc chỉ tồn tại trong cookie; DB chỉ lưu HMAC-SHA256(token, AUTH_SECRET).

import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { hashToken } from "./pepper";

export const SESSION_COOKIE = "kh_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 ngày

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string; // "user" | "owner"
  plan: string; // "free" | "plus" | "vip" | "max" (xem src/lib/plans.ts)
  avatarSeed: string | null;
  createdAt: Date;
}

/** Tạo session mới, set cookie httpOnly, trả về token. */
export async function createSession(userId: string, userAgent?: string) {
  const token = randomBytes(32).toString("base64url");
  const id = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: { id, userId, expiresAt, userAgent: userAgent?.slice(0, 255) },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax", // an toàn CSRF cho POST same-origin + không phá preview proxy
    secure: process.env.NODE_ENV === "production" && process.env.FORCE_INSECURE_COOKIE !== "1",
    path: "/",
    expires: expiresAt,
  });

  // Dọn session hết hạn định kỳ (fire-and-forget)
  db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});

  return token;
}

/** Đọc session từ cookie → user. Trả về null nếu không hợp lệ/hết hạn. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const id = hashToken(token);
  const session = await db.session.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id } }).catch(() => {});
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    plan: session.user.plan,
    avatarSeed: session.user.avatarSeed,
    createdAt: session.user.createdAt,
  };
}

/** Xoá session hiện tại (logout). */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.delete({ where: { id: hashToken(token) } }).catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Xoá tất cả session của user (đổi mật khẩu). */
export async function destroyAllUserSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
