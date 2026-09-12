// KhanhOS AI — Tool Executor: chạy tool với validate + timeout + log DB.
// Permission: mọi tool đều phải khai báo level; DESTRUCTIVE/EXECUTE bị từ chối
// trừ khi chủ sở hữu bật AI_ENABLE_UNSAFE_TOOLS (mặc định TẮT — bảo mật).

import { db } from "@/lib/db";
import type { ToolCallRequest, ToolResult, ToolExecutionRecord } from "@/ai/core/types";
import { getTool, makeToolResult, type ToolContext } from "./registry";

const TOOL_TIMEOUT_MS = 8000;
const MAX_LOG_PER_CONVERSATION = 500; // chống phình DB

export interface ToolExecutorEvents {
  onToolStart?: (call: ToolCallRequest) => void;
  onToolEnd?: (result: ToolResult) => void;
}

export class ToolExecutor {
  constructor(private ctx: ToolContext) {}

  /** Thực thi 1 tool-call — trả kết quả thật (ok hoặc lỗi), không bao giờ fake. */
  async execute(
    call: ToolCallRequest,
    events?: ToolExecutorEvents
  ): Promise<ToolResult> {
    const started = Date.now();
    events?.onToolStart?.(call);

    const finish = async (
      ok: boolean,
      output: string,
      error?: string,
      status: ToolExecutionRecord["status"] = ok ? "ok" : "error"
    ): Promise<ToolResult> => {
      const durationMs = Date.now() - started;
      const result = makeToolResult(call.id, call.name, ok, output, error, durationMs);
      await this.logExecution(call, status, output, error, durationMs);
      events?.onToolEnd?.(result);
      return result;
    };

    const tool = getTool(call.name);
    if (!tool) {
      return finish(false, "", `Không tồn tại tool '${call.name}'`, "error");
    }

    // Permission enforcement
    if (tool.permissionLevel === "DESTRUCTIVE" || tool.permissionLevel === "EXECUTE") {
      if (process.env.AI_ENABLE_UNSAFE_TOOLS !== "true") {
        return finish(
          false,
          "",
          `Tool '${call.name}' cần quyền ${tool.permissionLevel} — đã bị chặn theo chính sách bảo mật`,
          "denied"
        );
      }
    }

    // Validate input
    const inputError = tool.validateInput(call.args);
    if (inputError) {
      return finish(false, ``, `Input không hợp lệ: ${inputError}`, "error");
    }

    // Execute với timeout
    try {
      const out = await Promise.race([
        tool.execute(call.args, this.ctx),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error(`Tool '${call.name}' vượt ${TOOL_TIMEOUT_MS}ms`)), TOOL_TIMEOUT_MS)
        ),
      ]);
      return finish(true, out);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "lỗi tool";
      const isTimeout = msg.includes("vượt");
      return finish(false, "", msg, isTimeout ? "timeout" : "error");
    }
  }

  private async logExecution(
    call: ToolCallRequest,
    status: ToolExecutionRecord["status"],
    output: string | undefined,
    error: string | undefined,
    durationMs: number
  ): Promise<void> {
    try {
      // Giới hạn log mỗi hội thoại
      const count = await db.aiToolExecution.count({
        where: { conversationId: this.ctx.conversationId },
      });
      if (count >= MAX_LOG_PER_CONVERSATION) {
        await db.aiToolExecution.deleteMany({
          where: { conversationId: this.ctx.conversationId },
        });
      }
      await db.aiToolExecution.create({
        data: {
          userId: this.ctx.userId,
          conversationId: this.ctx.conversationId,
          tool: call.name,
          input: JSON.stringify(call.args).slice(0, 2000),
          output: output?.slice(0, 4000) ?? null,
          status,
          error: error?.slice(0, 500) ?? null,
          durationMs,
        },
      });
    } catch {
      // log lỗi không được làm hỏng pipeline chính
    }
  }
}
