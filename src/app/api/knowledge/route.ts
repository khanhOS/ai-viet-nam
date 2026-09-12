// /api/knowledge — Quản lý cơ sở tri thức local (RAG) của user.
// GET  : danh sách tài liệu + trạng thái model embedding
// POST : nạp tài liệu mới {title, content, source?} → chunk + nhúng THẬT
// DELETE ?id= : xoá tài liệu
// KHÔNG gọi API ngoài — embedding chạy qua Ollama local.

import { db } from "@/lib/db";
import { fail } from "@/lib/api-helpers";
import { getSessionUser } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rate-limit";
import { ingestDocument, deleteDocument } from "@/ai/knowledge/ingest";
import { getEmbeddingStatus } from "@/ai/knowledge/embeddings";
import { invalidateUserVectorCache } from "@/ai/knowledge/retrieval";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return fail(401, "Chưa đăng nhập");

  const [docs, embed] = await Promise.all([
    db.knowledgeDocument.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        source: true,
        charCount: true,
        chunkCount: true,
        embeddingModel: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    getEmbeddingStatus().catch(() => null),
  ]);

  return Response.json({
    documents: docs,
    embedding: embed,
  });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail(403, "Yêu cầu không hợp lệ");
  const user = await getSessionUser();
  if (!user) return fail(401, "Chưa đăng nhập");

  const rl = rateLimit(`knowledge:${user.id}`, 10, 60 * 1000);
  if (!rl.allowed) {
    return fail(429, `Thao tác quá nhanh. Thử lại sau ${rl.retryAfterSec}s.`);
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title : "";
  const content = typeof body?.content === "string" ? body.content : "";
  const source = typeof body?.source === "string" ? body.source : undefined;

  if (!title.trim()) return fail(400, "Thiếu tiêu đề tài liệu");
  if (!content.trim()) return fail(400, "Thiếu nội dung tài liệu");

  const result = await ingestDocument(user.id, title, content, source);
  if (result.ok) {
    invalidateUserVectorCache(user.id);
  } else {
    return fail(400, result.error ?? "Không nạp được tài liệu", { result });
  }

  return Response.json({
    ok: true,
    documentId: result.documentId,
    title: result.title,
    chunks: result.chunks,
    embedded: result.embedded,
    charCount: result.charCount,
    embeddingModel: result.embeddingModel,
  });
}

export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) return fail(403, "Yêu cầu không hợp lệ");
  const user = await getSessionUser();
  if (!user) return fail(401, "Chưa đăng nhập");

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail(400, "Thiếu id tài liệu");

  const removed = await deleteDocument(user.id, id);
  if (!removed) return fail(404, "Không tìm thấy tài liệu");
  invalidateUserVectorCache(user.id);
  return Response.json({ ok: true });
}
