// GET  /api/chats — Danh sách hội thoại của user
// POST /api/chats — Tạo hội thoại mới

import { db } from "@/lib/db";
import { guard, ok } from "@/lib/api-helpers";
import { getClientIp } from "@/lib/security/rate-limit";

export async function GET(req: Request) {
  const g = await guard(req, { requireAuth: true });
  if (g.response) return g.response;
  const user = g.user!;

  const conversations = await db.conversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      modelId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
    take: 100,
  });

  return ok({
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      modelId: c.modelId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c._count.messages,
    })),
  });
}

export async function POST(req: Request) {
  const g = await guard(req, {
    requireAuth: true,
    rateLimit: { key: `conv-create:${getClientIp(req)}`, limit: 30, windowMs: 60 * 1000 },
  });
  if (g.response) return g.response;
  const user = g.user!;

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const title = typeof body?.title === "string" ? body.title : "";
  const modelId = typeof body?.modelId === "string" ? body.modelId : null;

  const conversation = await db.conversation.create({
    data: {
      userId: user.id,
      title: title.trim() ? title.trim().slice(0, 120) : "Cuộc trò chuyện mới",
      modelId,
    },
  });

  return ok({ conversation });
}
