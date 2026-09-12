// KhanhOS AI — Password reset tokens
// Random 32 bytes, lưu HMAC-SHA256(token, AUTH_SECRET), hạn 1 giờ, dùng 1 lần.

import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { hashToken } from "./pepper";

const TTL_MS = 1000 * 60 * 60; // 1 giờ

export interface IssuedResetToken {
  token: string; // token gốc — CHỈ trả qua email / dev link, không lưu DB
  expiresAt: Date;
}

export async function issuePasswordResetToken(
  userId: string
): Promise<IssuedResetToken> {
  // Vô hiệu hoá token cũ chưa dùng của user này
  await db.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);

  await db.passwordResetToken.create({
    data: { id: hashToken(token), userId, expiresAt },
  });

  return { token, expiresAt };
}

export type ConsumeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

export async function consumePasswordResetToken(
  token: string
): Promise<ConsumeResult> {
  const id = hashToken(token);
  const record = await db.passwordResetToken.findUnique({ where: { id } });

  if (!record) return { ok: false, reason: "invalid" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt < new Date()) return { ok: false, reason: "expired" };

  await db.passwordResetToken.update({
    where: { id },
    data: { usedAt: new Date() },
  });

  return { ok: true, userId: record.userId };
}
