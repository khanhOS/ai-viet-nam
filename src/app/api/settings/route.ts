// GET   /api/settings — Cài đặt user
// PATCH /api/settings — Cập nhật cài đặt

import { db } from "@/lib/db";
import { guard, ok, fail } from "@/lib/api-helpers";
import { settingsPatchSchema, firstZodError } from "@/lib/security/validation";
import { DEFAULT_MODEL_ID, isModelAvailable } from "@/lib/models";

async function getOrCreateSettings(userId: string) {
  return (
    (await db.userSettings.findUnique({ where: { userId } })) ??
    db.userSettings.create({ data: { userId } })
  );
}

export async function GET(req: Request) {
  const g = await guard(req, { requireAuth: true });
  if (g.response) return g.response;

  const settings = await getOrCreateSettings(g.user!.id);
  return ok({
    settings: {
      defaultModelId: settings.defaultModelId ?? DEFAULT_MODEL_ID,
      webSearchEnabled: settings.webSearchEnabled,
      reducedMotionPref: settings.reducedMotionPref ?? "system",
      theme: settings.theme ?? "system",
    },
  });
}

export async function PATCH(req: Request) {
  const g = await guard(req, { requireAuth: true });
  if (g.response) return g.response;
  const user = g.user!;

  const body = await req.json().catch(() => null);
  const parsed = settingsPatchSchema.safeParse(body);
  if (!parsed.success) return fail(400, firstZodError(parsed.error));

  // Validate model nếu có
  if (parsed.data.defaultModelId && !isModelAvailable(parsed.data.defaultModelId)) {
    return fail(400, "Model không hợp lệ hoặc chưa khả dụng");
  }

  const settings = await getOrCreateSettings(user.id);
  const updated = await db.userSettings.update({
    where: { userId: user.id },
    data: {
      ...(parsed.data.defaultModelId !== undefined
        ? { defaultModelId: parsed.data.defaultModelId }
        : {}),
      ...(parsed.data.webSearchEnabled !== undefined
        ? { webSearchEnabled: parsed.data.webSearchEnabled }
        : {}),
      ...(parsed.data.reducedMotionPref !== undefined
        ? { reducedMotionPref: parsed.data.reducedMotionPref }
        : {}),
      ...(parsed.data.theme !== undefined
        ? { theme: parsed.data.theme }
        : {}),
    },
  });

  return ok({
    settings: {
      defaultModelId: updated.defaultModelId ?? DEFAULT_MODEL_ID,
      webSearchEnabled: updated.webSearchEnabled,
      reducedMotionPref: updated.reducedMotionPref ?? "system",
      theme: updated.theme ?? "system",
    },
  });
}
