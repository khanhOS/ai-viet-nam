// KhanhOS AI — Mức dùng theo tháng (server-side)
// Đếm tổng mức dùng (Message.tokens) của user trong tháng lịch hiện tại.

import { db } from "@/lib/db";
import { monthlyTokenLimit, getPlan, formatCredits } from "@/lib/plans";

export interface PlanUsage {
  plan: string;
  planName: string;
  usage: number; // tín dụng đã dùng tháng này
  limit: number; // hạn mức (Infinity với owner)
  remaining: number;
}

/** Tổng token assistant đã dùng trong tháng hiện tại (mùng 1 → nay). */
export async function getMonthlyUsage(userId: string): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const agg = await db.message.aggregate({
    _sum: { tokens: true },
    where: {
      role: "assistant",
      tokens: { not: null },
      conversation: { userId },
      createdAt: { gte: start },
    },
  });
  return agg._sum.tokens ?? 0;
}

/** Thông tin gói + usage hiện tại của user. */
export async function getPlanUsage(plan: string, role: string, userId: string): Promise<PlanUsage> {
  const usage = await getMonthlyUsage(userId);
  const limit = monthlyTokenLimit(plan, role);
  return {
    plan,
    planName: role === "owner" ? "Chủ sở hữu" : getPlan(plan).name,
    usage,
    limit,
    remaining: Math.max(0, limit - usage),
  };
}

/** true nếu user đã vượt hạn mức tháng này. */
export async function isOverQuota(plan: string, role: string, userId: string): Promise<boolean> {
  const limit = monthlyTokenLimit(plan, role);
  if (!Number.isFinite(limit)) return false; // owner — không giới hạn
  const usage = await getMonthlyUsage(userId);
  return usage >= limit;
}

/** Thông báo lỗi quota thống nhất cho chat API. */
export function quotaErrorMessage(plan: string, role: string, usage: number, limit: number): string {
  if (role === "owner") return "Chủ sở hữu không bị giới hạn mức dùng.";
  const p = getPlan(plan);
  return (
    `Bạn đã dùng hết ${formatCredits(limit)} tín dụng của gói ${p.name} trong tháng này ` +
    `(đã dùng ${formatCredits(usage)}). Mở menu ≡ → "Gói & Nâng cấp" để tiếp tục.`
  );
}
