// GET  /api/admin/chatbot        — Danh sách file dữ liệu + stats + warnings (owner)
// PUT  /api/admin/chatbot        — Ghi 1 file dữ liệu JSON (whitelist + atomic) (owner)
// POST /api/admin/chatbot/test   — Test 1 message qua engine (kết quả + debug) (owner)

import { guard, ok, fail } from "@/lib/api-helpers";
import {
  getChatbotData,
  listDataFiles,
  readDataFile,
  writeDataFile,
} from "@/lib/local-chat/data-loader";
import { getChatEngine } from "@/lib/local-chat/chat-engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guard(req, { requireAuth: true });
  if (g.response) return g.response;
  if (g.user!.role !== "owner") return fail(403, "Chỉ chủ sở hữu mới được quản trị tri thức");

  // GET ?file=<path> — đọc nội dung 1 file dữ liệu (whitelist)
  const url = new URL(req.url);
  const file = url.searchParams.get("file");
  if (file) {
    const content = readDataFile(file);
    if (content === null) return fail(400, "File không nằm trong whitelist dữ liệu chatbot");
    return ok({ path: file, content });
  }

  const data = getChatbotData();
  return ok({
    files: listDataFiles(),
    stats: data.stats,
    system: data.system.engine,
    warnings: data.warnings,
    topics: data.topics.map((t) => ({ id: t.id, name: t.name })),
  });
}

export async function PUT(req: Request) {
  const g = await guard(req, { requireAuth: true });
  if (g.response) return g.response;
  if (g.user!.role !== "owner") return fail(403, "Chỉ chủ sở hữu mới được quản trị tri thức");

  const body = await req.json().catch(() => null);
  const path = typeof body?.path === "string" ? body.path : "";
  const content = typeof body?.content === "string" ? body.content : "";

  if (!path || !content) return fail(400, "Thiếu path/content");
  if (content.length > 2_000_000) return fail(413, "File quá lớn (tối đa 2MB)");

  // Validate JSON hợp lệ TRƯỚC khi ghi
  try {
    JSON.parse(content);
  } catch (e) {
    return fail(400, `JSON không hợp lệ: ${(e as Error).message}`);
  }

  // Kiểm tra schema tối thiểu theo loại file
  const schemaError = basicSchemaCheck(path, content);
  if (schemaError) return fail(400, schemaError);

  const before = getChatbotData();
  const written = writeDataFile(path, content);
  if (!written) return fail(400, "File không nằm trong whitelist dữ liệu chatbot");

  // Reload ngay để xác nhận + trả warnings nếu có
  const after = getChatbotData();
  if (after.stats.intents === 0) {
    return ok({
      saved: true,
      warnings: [...after.warnings, "CẢNH BÁO: intents = 0 sau khi nạp — kiểm tra lại file vừa sửa!"],
      stats: after.stats,
      previousStats: before.stats,
    });
  }

  return ok({
    saved: true,
    warnings: after.warnings,
    stats: after.stats,
    previousStats: before.stats,
  });
}

export async function POST(req: Request) {
  const g = await guard(req, { requireAuth: true });
  if (g.response) return g.response;
  if (g.user!.role !== "owner") return fail(403, "Chỉ chủ sở hữu mới được quản trị tri thức");

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message : "";
  if (!message.trim()) return fail(400, "Thiếu message để test");

  const engine = getChatEngine();
  const result = await engine.process({
    message: message.slice(0, 2000),
    conversationId: `admin-test-${Date.now()}`,
    userId: g.user!.id,
    // Truyền đủ ngữ cảnh để lệnh admin (/give, /usage...) test được từ đây
    user: {
      id: g.user!.id,
      email: g.user!.email,
      role: g.user!.role,
      plan: g.user!.plan,
    },
  });

  return ok({
    intent: result.intent,
    confidence: result.confidence,
    language: result.language,
    text: result.text,
    suggestions: result.suggestions ?? [],
    candidates: (result.debug ?? []).map((c) => ({
      intent: c.intent.id,
      score: c.score,
      confidence: c.confidence,
      reasons: c.reasons,
    })),
  });
}

/** Kiểm tra cấu trúc tối thiểu — chặn ghi file làm hỏng engine. */
function basicSchemaCheck(path: string, content: string): string | null {
  try {
    const parsed = JSON.parse(content);
    if (path.startsWith("intents/")) {
      if (!Array.isArray(parsed)) return "intents/*.json phải là mảng intent";
      for (const it of parsed) {
        if (!it?.id || !it?.response_id || !Array.isArray(it?.patterns) || !it?.topic) {
          return `Intent thiếu id/topic/patterns/response_id: ${JSON.stringify(it).slice(0, 80)}`;
        }
      }
    }
    if (path.startsWith("responses/")) {
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return "responses/*.json phải là object { response_id: { vi: [...] } }";
      }
      for (const [k, v] of Object.entries(parsed)) {
        if (!v || !Array.isArray((v as { vi?: unknown[] }).vi)) {
          return `Response "${k}" thiếu mảng "vi"`;
        }
      }
    }
    if (path.startsWith("knowledge/")) {
      if (!Array.isArray(parsed)) return "knowledge/*.json phải là mảng entry";
      for (const k of parsed) {
        if (!k?.id || !k?.title || !k?.content) {
          return `Knowledge thiếu id/title/content: ${JSON.stringify(k).slice(0, 80)}`;
        }
      }
    }
    return null;
  } catch {
    return "JSON không parse được";
  }
}
