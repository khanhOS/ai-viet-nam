// /api/training — Quản lý dataset + huấn luyện LoRA/QLoRA (CHỦ SỞ HỮU).
// GET  : runtime status + datasets + jobs + thống kê feedback
// POST : action
//   - {action:"export_dataset", name, format:"alpaca"|"sharegpt"} → xuất JSONL từ feedback 👍
//   - {action:"create_job", name, config:{...LoRA}} → sinh bộ file huấn luyện thật
//   - {action:"delete_dataset", name}
// TRUNG THỰC: không có Python+torch trên server → job "pending_runtime",
// vẫn sinh đầy đủ script chạy trên máy có GPU — KHÔNG fake kết quả.

import { db } from "@/lib/db";
import { fail } from "@/lib/api-helpers";
import { getSessionUser } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  collectFeedbackPairs,
  exportDataset,
  listDatasets,
  deleteDataset,
} from "@/ai/training/dataset";
import {
  validateLoraConfig,
  createLoraJob,
  checkTrainingRuntime,
  DEFAULT_LORA_TARGETS,
} from "@/ai/training/lora";
import { feedbackStats } from "@/ai/evaluation/feedback";

export const dynamic = "force-dynamic";

async function requireOwner() {
  const user = await getSessionUser();
  if (!user) return { error: fail(401, "Chưa đăng nhập") };
  if (user.role !== "owner") {
    return { error: fail(403, "Chức năng huấn luyện chỉ dành cho chủ sở hữu") };
  }
  return { user };
}

export async function GET() {
  const { user, error } = await requireOwner();
  if (error) return error;

  const [runtime, datasets, jobs, stats, pairCount] = await Promise.all([
    checkTrainingRuntime(),
    Promise.resolve(listDatasets()),
    db.trainingJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        kind: true,
        baseModel: true,
        status: true,
        config: true,
        result: true,
        error: true,
        createdAt: true,
      },
    }),
    feedbackStats(),
    db.aiFeedback.count({ where: { rating: "up" } }),
  ]);

  return Response.json({
    runtime,
    datasets,
    jobs: jobs.map((j) => ({
      ...j,
      config: (() => {
        try {
          return JSON.parse(j.config);
        } catch {
          return null;
        }
      })(),
      result: (() => {
        try {
          return j.result ? JSON.parse(j.result) : null;
        } catch {
          return null;
        }
      })(),
    })),
    feedback: stats,
    trainingPairsAvailable: pairCount,
    loraDefaults: {
      targetModules: DEFAULT_LORA_TARGETS,
      rank: 8,
      alpha: 16,
      epochs: 3,
      learningRate: 2e-4,
      batchSize: 4,
      maxSeqLength: 1024,
    },
  });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail(403, "Yêu cầu không hợp lệ");
  const { user, error } = await requireOwner();
  if (error) return error;

  const rl = rateLimit(`training:${user.id}`, 10, 60 * 1000);
  if (!rl.allowed) return fail(429, `Thao tác quá nhanh. Thử lại sau ${rl.retryAfterSec}s.`);

  const body = await req.json().catch(() => null);
  const action = body?.action;

  if (action === "export_dataset") {
    const name = typeof body.name === "string" ? body.name : "";
    const format = body.format === "sharegpt" ? "sharegpt" : "alpaca";
    try {
      const pairs = await collectFeedbackPairs();
      if (!pairs.length) {
        return fail(400, "Chưa có phản hồi 👍 nào để tạo dataset — hãy dùng chat và đánh giá tích cực trước");
      }
      const result = exportDataset(pairs, format, name);
      return Response.json({
        ok: true,
        file: result.file,
        pairs: result.pairs,
        sizeBytes: result.sizeBytes,
        format,
      });
    } catch (e) {
      return fail(400, e instanceof Error ? e.message : "Không xuất được dataset");
    }
  }

  if (action === "create_job") {
    const name = typeof body.name === "string" ? body.name : "LoRA job";
    const check = validateLoraConfig(body.config);
    if (!check.ok) return fail(400, check.error);
    try {
      const job = await createLoraJob(user.id, name, check.config);
      return Response.json({ ok: true, ...job });
    } catch (e) {
      return fail(400, e instanceof Error ? e.message : "Không tạo được job");
    }
  }

  if (action === "delete_dataset") {
    const name = typeof body.name === "string" ? body.name : "";
    if (!name) return fail(400, "Thiếu tên dataset");
    const removed = deleteDataset(name);
    if (!removed) return fail(404, "Không tìm thấy dataset");
    return Response.json({ ok: true });
  }

  return fail(400, "Action không hợp lệ (export_dataset | create_job | delete_dataset)");
}
