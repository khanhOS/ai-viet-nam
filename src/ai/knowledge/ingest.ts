// KhanhOS AI — Nạp tài liệu vào cơ sở tri thức local (RAG ingestion thật).
// Pipeline: văn bản → cắt chunk theo ranh giới câu (~600 ký tự, overlap 80)
// → nhúng MỖI chunk bằng model embedding local → lưu DB (KnowledgeChunk).
// Nếu model embedding chưa có → từ chối nạp TRUNG THỰC (không nhúng giả).

import { db } from "@/lib/db";
import { embedBatch, getEmbeddingModelName } from "@/ai/knowledge/embeddings";

export interface IngestResult {
  ok: boolean;
  documentId?: string;
  title: string;
  chunks: number;
  embedded: number;
  charCount: number;
  embeddingModel: string;
  error?: string;
}

const CHUNK_TARGET_CHARS = 600;
const CHUNK_OVERLAP_CHARS = 80;
const MAX_DOC_CHARS = 200_000; // ~50k token văn bản — đủ cho tài liệu vừa
const MAX_CHUNKS_PER_DOC = 400;

/**
 * Cắt văn bản thành chunk theo ranh giới câu/câu hỏi.
 * - Ưu tiên ngắt tại ". ", "! ", "? ", "\n\n", "\n" gần vị trí mục tiêu
 * - Overlap để giữ ngữ cảnh liên kết giữa 2 chunk kề nhau
 */
export function chunkText(
  text: string,
  target = CHUNK_TARGET_CHARS,
  overlap = CHUNK_OVERLAP_CHARS
): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length && chunks.length < MAX_CHUNKS_PER_DOC) {
    let end = Math.min(start + target, clean.length);
    if (end < clean.length) {
      // tìm ranh giới câu gần nhất TRƯỚC end (lùi lại tối đa 40% target)
      const window = clean.slice(start, end);
      const minBoundary = Math.floor(window.length * 0.6);
      let cut = -1;
      for (const re of [/[.!?…]\s/g, /\n\n/g, /\n/g, /[,;:]\s/g]) {
        re.lastIndex = minBoundary;
        const m = re.exec(window);
        if (m && m.index + m[0].length >= minBoundary) {
          cut = Math.max(cut, m.index + m[0].length);
          break;
        }
      }
      if (cut > 0) end = start + cut;
    }
    const piece = clean.slice(start, end).trim();
    if (piece.length >= 20) chunks.push(piece); // bỏ mẩu vụn quá ngắn
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  // chunk cuối nếu bị bỏ vì ngắn → nối vào chunk trước
  return chunks;
}

/** Nạp tài liệu: cắt chunk → nhúng THẬT → lưu DB. Trả kết quả trung thực. */
export async function ingestDocument(
  userId: string,
  title: string,
  content: string,
  source?: string
): Promise<IngestResult> {
  const cleanTitle = title.trim().slice(0, 200) || "Tài liệu không tên";
  const cleanContent = content.trim();
  const embeddingModel = getEmbeddingModelName();

  if (cleanContent.length < 50) {
    return {
      ok: false,
      title: cleanTitle,
      chunks: 0,
      embedded: 0,
      charCount: cleanContent.length,
      embeddingModel,
      error: "Nội dung quá ngắn (tối thiểu 50 ký tự)",
    };
  }
  if (cleanContent.length > MAX_DOC_CHARS) {
    return {
      ok: false,
      title: cleanTitle,
      chunks: 0,
      embedded: 0,
      charCount: cleanContent.length,
      embeddingModel,
      error: `Tài liệu quá dài (${cleanContent.length} ký tự, tối đa ${MAX_DOC_CHARS})`,
    };
  }

  const chunks = chunkText(cleanContent);
  if (!chunks.length) {
    return {
      ok: false,
      title: cleanTitle,
      chunks: 0,
      embedded: 0,
      charCount: cleanContent.length,
      embeddingModel,
      error: "Không cắt được chunk nào từ tài liệu",
    };
  }

  // Nhúng THẬT — model embedding local
  const vectors = await embedBatch(chunks);
  const embedded = vectors.filter((v): v is number[] => Array.isArray(v));
  if (embedded.length === 0) {
    return {
      ok: false,
      title: cleanTitle,
      chunks: chunks.length,
      embedded: 0,
      charCount: cleanContent.length,
      embeddingModel,
      error: `Model embedding "${embeddingModel}" chưa sẵn sàng — chạy: ollama pull ${embeddingModel}`,
    };
  }

  // Tài liệu được lưu với các chunk ĐÃ nhúng thành công (chunk hụt được ghi chú)
  const doc = await db.knowledgeDocument.create({
    data: {
      userId,
      title: cleanTitle,
      source: source?.trim().slice(0, 300) || null,
      content: cleanContent,
      charCount: cleanContent.length,
      chunkCount: embedded.length,
      embeddingModel,
    },
  });

  await db.knowledgeChunk.createMany({
    data: chunks.map((content, i) => {
      const v = vectors[i];
      const ok = Array.isArray(v);
      const norm = ok ? Math.sqrt(v.reduce((s, x) => s + x * x, 0)) : null;
      return {
        documentId: doc.id,
        docIndex: i,
        content,
        embedding: JSON.stringify(ok ? v : []),
        dim: ok ? v.length : 0,
        norm,
      };
    }),
  });

  return {
    ok: true,
    documentId: doc.id,
    title: cleanTitle,
    chunks: chunks.length,
    embedded: embedded.length,
    charCount: cleanContent.length,
    embeddingModel,
  };
}

/** Xoá tài liệu (chunk xoá theo cascade). */
export async function deleteDocument(userId: string, documentId: string): Promise<boolean> {
  const doc = await db.knowledgeDocument.findFirst({
    where: { id: documentId, userId },
  });
  if (!doc) return false;
  await db.knowledgeDocument.delete({ where: { id: doc.id } });
  return true;
}
