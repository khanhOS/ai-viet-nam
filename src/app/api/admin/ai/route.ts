// GET /api/admin/ai — Diagnostics hệ AI cục bộ (owner)
// Số liệu THẬT: runtime, model, latency, tok/s, tool calls, verification.
// Không lộ biến môi trường/secret — chỉ tên runtime + model.

import { db } from "@/lib/db";
import { guard, ok } from "@/lib/api-helpers";
import { getRuntimeStatus } from "@/ai";
import { getDiagnosticsSummary, getRecentRequests } from "@/ai/observability/diagnostics";
import { listToolDefs } from "@/ai/tools/registry";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guard(req, { requireAuth: true });
  if (g.response) return g.response;
  if (!g.user || g.user.role !== "owner") {
    return Response.json({ error: "Chỉ chủ sở hữu" }, { status: 403 });
  }

  const runtime = await getRuntimeStatus();

  const toolLogs = await db.aiToolExecution.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      tool: true,
      status: true,
      durationMs: true,
      error: true,
      createdAt: true,
    },
  });

  const memoryCount = await db.aiMemory.count().catch(() => 0);

  return ok({
    runtime: {
      available: runtime.available,
      runtime: runtime.runtime,
      defaultModel: runtime.defaultModel?.runtimeName ?? null,
      models: runtime.models.map((m) => ({
        name: m.runtimeName,
        provider: m.provider,
        parameterSize: m.parameterSize ?? null,
        quantization: m.quantization ?? null,
        contextLength: m.capabilities.contextLength,
        tools: m.capabilities.tools,
      })),
      error: runtime.error ?? null,
    },
    diagnostics: getDiagnosticsSummary(),
    recentRequests: getRecentRequests().slice(0, 20),
    tools: listToolDefs(),
    toolLogs,
    memory: { longTermCount: memoryCount },
  });
}
