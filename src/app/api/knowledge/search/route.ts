// /api/knowledge/search — Truy vấn RAG thật: query → embedding local →
// cosine similarity trên các chunk của user → top-k.
// POST {query, topK?}

import { fail } from "@/lib/api-helpers";
import { getSessionUser } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rate-limit";
import { retrieveKnowledge } from "@/ai/knowledge/retrieval";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail(403, "Yêu cầu không hợp lệ");
  const user = await getSessionUser();
  if (!user) return fail(401, "Chưa đăng nhập");

  const rl = rateLimit(`knowledge-search:${user.id}`, 20, 60 * 1000);
  if (!rl.allowed) {
    return fail(429, `Truy vấn quá nhanh. Thử lại sau ${rl.retryAfterSec}s.`);
  }

  const body = await req.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const topK = Math.min(Math.max(Number(body?.topK) || 5, 1), 12);
  if (!query) return fail(400, "Thiếu truy vấn");

  const results = await retrieveKnowledge(user.id, query, topK);
  return Response.json({
    query,
    results: results.map((r) => ({
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      chunkId: r.chunkId,
      docIndex: r.docIndex,
      content: r.content,
      score: Math.round(r.score * 1000) / 1000,
    })),
  });
}
