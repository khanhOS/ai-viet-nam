// GET    /api/chats/[id] — Lấy hội thoại + messages (authorization!)
// PATCH  /api/chats/[id] — Đổi tiêu đề
// DELETE /api/chats/[id] — Xoá hội thoại

import { db } from "@/lib/db";
import { guard, ok, fail } from "@/lib/api-helpers";
import { conversationPatchSchema, firstZodError } from "@/lib/security/validation";

// Authorization: user A KHÔNG đọc được conversation của user B
async function getOwnedConversation(id: string, userId: string) {
  return db.conversation.findFirst({
    where: { id, userId },
  });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const g = await guard(req, { requireAuth: true });
  if (g.response) return g.response;
  const user = g.user!;

  const { id } = await ctx.params;
  const conversation = await getOwnedConversation(id, user.id);
  if (!conversation) return fail(404, "Không tìm thấy cuộc trò chuyện");

  const messages = await db.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  return ok({
    conversation,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      modelId: m.modelId,
      attachments: m.attachments ? JSON.parse(m.attachments) : undefined,
      sources: m.sources ? JSON.parse(m.sources) : undefined,
      createdAt: m.createdAt,
    })),
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const g = await guard(req, { requireAuth: true });
  if (g.response) return g.response;
  const user = g.user!;

  const { id } = await ctx.params;
  const conversation = await getOwnedConversation(id, user.id);
  if (!conversation) return fail(404, "Không tìm thấy cuộc trò chuyện");

  const body = await req.json().catch(() => null);
  const parsed = conversationPatchSchema.safeParse(body);
  if (!parsed.success) return fail(400, firstZodError(parsed.error));

  const updated = await db.conversation.update({
    where: { id },
    data: { title: parsed.data.title },
  });

  return ok({ conversation: updated });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const g = await guard(req, { requireAuth: true });
  if (g.response) return g.response;
  const user = g.user!;

  const { id } = await ctx.params;
  const conversation = await getOwnedConversation(id, user.id);
  if (!conversation) return fail(404, "Không tìm thấy cuộc trò chuyện");

  await db.conversation.delete({ where: { id } });
  return ok({});
}
