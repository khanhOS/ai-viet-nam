// KhanhOS AI — Lệnh chat chạm DB (async)
// /usage — công khai: xem mức dùng tín dụng của chính mình
// /give /user /pending /approve /deny — CHỈ owner (commands.json owner_only)
// Chặn user thường bằng thông báo rõ ràng, không đổi dữ liệu.

import { db } from "@/lib/db";
import { getMonthlyUsage } from "@/lib/plan-usage";
import { getPlan, monthlyTokenLimit, formatCredits, PLANS } from "@/lib/plans";
import type { EngineUserContext } from "./types";

export interface DbCommandOutput {
  text: string;
  action?: string;
}

/** Các lệnh cần truy vấn DB — engine gọi trước runCommand thường. */
const DB_COMMANDS = new Set(["/usage", "/give", "/user", "/pending", "/approve", "/deny"]);

export function isDbCommand(name: string): boolean {
  return DB_COMMANDS.has(name);
}

function denyOwnerOnly(name: string): DbCommandOutput {
  return {
    text: `Lệnh **${name}** chỉ dành cho chủ sở hữu — bạn không có quyền dùng lệnh này.`,
  };
}

function syntaxHint(name: string, usage: string): DbCommandOutput {
  return {
    text: `Cú pháp: **${name} ${usage}**`,
  };
}

// ─────────────────────────────────────────────
// Tra user theo email (không phân biệt hoa/thường) hoặc ID
// ─────────────────────────────────────────────

async function findUser(target: string) {
  const t = target.trim();
  if (!t) return null;

  // theo ID
  const byId = await db.user.findUnique({ where: { id: t } }).catch(() => null);
  if (byId) return byId;

  // theo email — thử exact rồi scan thường-hoá (SQLite không insensitive)
  const byEmail = await db.user.findUnique({ where: { email: t } }).catch(() => null);
  if (byEmail) return byEmail;

  const lower = t.toLowerCase();
  const all = await db.user.findMany({
    select: { id: true, email: true, name: true, plan: true, planUpdatedAt: true, createdAt: true, role: true },
  });
  return all.find((u) => u.email.toLowerCase() === lower) ?? null;
}

// ─────────────────────────────────────────────
// Các lệnh
// ─────────────────────────────────────────────

async function cmdUsage(user: EngineUserContext): Promise<DbCommandOutput> {
  const plan = getPlan(user.plan);
  const limit = monthlyTokenLimit(user.plan, user.role);
  const usage = await getMonthlyUsage(user.id);

  if (!Number.isFinite(limit)) {
    return {
      text:
        `Gói của bạn: **Chủ sở hữu** — không giới hạn tín dụng.\n` +
        `Đã dùng tháng này: **${formatCredits(usage)}** tín dụng (chỉ để tham khảo).`,
    };
  }
  const remaining = Math.max(0, limit - usage);
  return {
    text:
      `Gói của bạn: **${plan.name}** — hạn mức **${formatCredits(limit)}** tín dụng/tháng.\n` +
      `Đã dùng tháng này: **${formatCredits(usage)} / ${formatCredits(limit)}** tín dụng (còn **${formatCredits(remaining)}**).\n` +
      `Nâng cấp gói: Menu tài khoản (góc phải) → Gói dịch vụ.`,
  };
}

async function cmdGive(args: string[], user: EngineUserContext): Promise<DbCommandOutput> {
  if (user.role !== "owner") return denyOwnerOnly("/give");
  if (args.length < 2) return syntaxHint("/give", "<free|plus|vip|max> <email hoặc ID>");

  const planId = args[0].toLowerCase();
  if (!PLANS.some((p) => p.id === planId)) {
    return {
      text: `Gói **${args[0]}** không hợp lệ. Các gói hợp lệ: ${PLANS.map((p) => `\`${p.id}\``).join(", ")}.`,
    };
  }

  const target = await findUser(args.slice(1).join(" "));
  if (!target) {
    return { text: `Không tìm thấy user nào với email/ID **${args.slice(1).join(" ")}**.` };
  }

  await db.user.update({
    where: { id: target.id },
    data: { plan: planId, planUpdatedAt: new Date() },
  });
  const plan = getPlan(planId);
  return {
    text:
      `Đã gán gói ${plan.name} cho **${target.email}** — hạn mức **${formatCredits(plan.monthlyCredits)}** tín dụng/tháng.`,
  };
}

async function cmdUser(args: string[], user: EngineUserContext): Promise<DbCommandOutput> {
  if (user.role !== "owner") return denyOwnerOnly("/user");
  if (!args.length) return syntaxHint("/user", "<email hoặc ID>");

  const target = await findUser(args.join(" "));
  if (!target) {
    return { text: `Không tìm thấy user nào với email/ID **${args.join(" ")}**.` };
  }

  const plan = getPlan(target.plan);
  const limit = monthlyTokenLimit(target.plan, target.role);
  const usage = await getMonthlyUsage(target.id);
  const conversations = await db.conversation.count({ where: { userId: target.id } });
  const roleLabel = target.role === "owner" ? " 👑 chủ sở hữu" : "";

  const limitText = Number.isFinite(limit)
    ? `**${plan.name}** — ${formatCredits(limit)} tín dụng/tháng`
    : `**Chủ sở hữu** — không giới hạn`;
  return {
    text:
      `👤 **${target.email}**${roleLabel}\n` +
      `Tên: ${target.name}\n` +
      `Gói: ${limitText}\n` +
      `Đã dùng tháng này: **${formatCredits(usage)}** tín dụng\n` +
      `Tham gia: ${target.createdAt.toLocaleDateString("vi-VN")} • Hội thoại: ${conversations}`,
  };
}

async function cmdPending(user: EngineUserContext): Promise<DbCommandOutput> {
  if (user.role !== "owner") return denyOwnerOnly("/pending");

  const requests = await db.planRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  if (!requests.length) {
    return { text: "Không có yêu cầu nâng cấp nào đang chờ duyệt." };
  }

  const lines = [`Yêu cầu đang chờ duyệt (${requests.length}, mới nhất trước):`];
  requests.forEach((r, i) => {
    const plan = getPlan(r.plan);
    const note = r.note ? ` — "${r.note}"` : "";
    const momo = r.momoNumber ? ` • MoMo ${r.momoNumber}` : "";
    lines.push(
      `${i + 1}. **[${plan.name}]** ${r.contactEmail} — SĐT ${r.phone}${momo}${note}\n   id: \`${r.id}\` — dùng: \`/approve ${r.id.slice(0, 6)}\``
    );
  });
  return { text: lines.join("\n") };
}

async function cmdDecide(
  name: "/approve" | "/deny",
  args: string[],
  user: EngineUserContext
): Promise<DbCommandOutput> {
  if (user.role !== "owner") return denyOwnerOnly(name);
  const approve = name === "/approve";
  if (!args.length) {
    return syntaxHint(name, "<id — chấp nhận cả id viết tắt ≥ 4 ký tự>");
  }

  const prefix = args.join("").trim().toLowerCase();
  if (prefix.length < 4) {
    return { text: "Id quá ngắn — nhập ít nhất 4 ký tự đầu của yêu cầu (xem /pending)." };
  }

  const pending = await db.planRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const matches = pending.filter((r) => r.id.toLowerCase().startsWith(prefix));

  if (!matches.length) {
    return { text: `Không tìm thấy yêu cầu nào khớp id **${prefix}** (xem /pending).` };
  }
  if (matches.length > 1) {
    const list = matches
      .map((r) => `- \`${r.id}\` — **[${getPlan(r.plan).name}]** ${r.contactEmail}`)
      .join("\n");
    return { text: `Nhiều yêu cầu khớp **${prefix}** — nhập id dài hơn:\n${list}` };
  }

  const req = matches[0];
  const plan = getPlan(req.plan);

  await db.planRequest.update({
    where: { id: req.id },
    data: { status: approve ? "approved" : "rejected", decidedAt: new Date() },
  });

  if (approve) {
    const target = await db.user.findUnique({ where: { id: req.userId } });
    if (target) {
      await db.user.update({
        where: { id: target.id },
        data: { plan: req.plan, planUpdatedAt: new Date() },
      });
      return {
        text:
          `Đã duyệt yêu cầu **${plan.name}** cho **${target.email}** — gói đã kích hoạt (${formatCredits(plan.monthlyCredits)} tín dụng/tháng).`,
      };
    }
    return { text: `Đã duyệt yêu cầu **${plan.name}** (id \`${req.id}\`) — nhưng không tìm thấy user gắn kèm.` };
  }

  return { text: `Đã từ chối yêu cầu **${plan.name}** của **${req.contactEmail}** (id \`${req.id}\`).` };
}

/** Chạy lệnh DB. Trả về text hiển thị trong chat. */
export async function runDbCommand(
  name: string,
  args: string[],
  user: EngineUserContext | undefined
): Promise<DbCommandOutput> {
  if (!user) {
    return { text: "Cần đăng nhập để dùng lệnh này." };
  }
  switch (name) {
    case "/usage":
      return cmdUsage(user);
    case "/give":
      return cmdGive(args, user);
    case "/user":
      return cmdUser(args, user);
    case "/pending":
      return cmdPending(user);
    case "/approve":
      return cmdDecide("/approve", args, user);
    case "/deny":
      return cmdDecide("/deny", args, user);
    default:
      return { text: `Lệnh ${name} chưa được hỗ trợ.` };
  }
}
