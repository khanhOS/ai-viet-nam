// /api/memory — Xem & quản lý trí nhớ dài hạn của user (AiMemory).
// GET : danh sách trí nhớ (phân trang nhẹ)
// DELETE ?id= : xoá 1 mục trí nhớ
// PATCH {id, value} : sửa giá trị trí nhớ

import { db } from "@/lib/db";
import { fail } from "@/lib/api-helpers";
import { getSessionUser } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return fail(401, "Chưa đăng nhập");

  const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit")) || 50, 1), 200);
  const memories = await db.aiMemory.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      kind: true,
      key: true,
      value: true,
      importance: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return Response.json({ memories });
}

export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) return fail(403, "Yêu cầu không hợp lệ");
  const user = await getSessionUser();
  if (!user) return fail(401, "Chưa đăng nhập");

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail(400, "Thiếu id");

  const existing = await db.aiMemory.findFirst({ where: { id, userId: user.id } });
  if (!existing) return fail(404, "Không tìm thấy trí nhớ");

  await db.aiMemory.delete({ where: { id } });
  return Response.json({ ok: true });
}

export async function PATCH(req: Request) {
  if (!isSameOrigin(req)) return fail(403, "Yêu cầu không hợp lệ");
  const user = await getSessionUser();
  if (!user) return fail(401, "Chưa đăng nhập");

  const rl = rateLimit(`memory-edit:${user.id}`, 20, 60 * 1000);
  if (!rl.allowed) return fail(429, `Thao tác quá nhanh. Thử lại sau ${rl.retryAfterSec}s.`);

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const value = typeof body?.value === "string" ? body.value.trim() : "";
  if (!id) return fail(400, "Thiếu id");
  if (!value) return fail(400, "Thiếu giá trị mới");
  if (value.length > 1000) return fail(400, "Giá trị tối đa 1000 ký tự");

  const existing = await db.aiMemory.findFirst({ where: { id, userId: user.id } });
  if (!existing) return fail(404, "Không tìm thấy trí nhớ");

  const updated = await db.aiMemory.update({
    where: { id },
    data: { value: value.slice(0, 1000) },
  });
  return Response.json({ ok: true, memory: { id: updated.id, key: updated.key, value: updated.value } });
}
