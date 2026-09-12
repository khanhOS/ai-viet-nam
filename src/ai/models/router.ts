// KhanhOS AI — ModelRouter: phân loại nhiệm vụ → chọn profile + model.
// Heuristic deterministic (nhanh, không tốn lượt model). User override được.

import type { Complexity, TaskType } from "@/ai/core/types";
import { getProfile, profileForComplexity, type ProfileId } from "./profiles";

export interface RouterInput {
  text: string;
  historyLength: number; // số tin nhắn trước đó
  attachmentsChars?: number; // tổng ký tự text đính kèm
  /** user chủ động chọn profile (UI) */
  overrideProfile?: ProfileId | null;
}

export interface RouterDecision {
  taskType: TaskType;
  complexity: Complexity;
  profileId: ProfileId;
  reasons: string[];
}

const CODE_SIGNALS =
  /(```|\b(function|const|let|var|class|def |import |from .* import|SELECT .* FROM|npm |bun |yarn |pip |gcc|rustc|cargo)\b|\.tsx?\b|\.jsx?\b|\.py\b|\.rs\b|\.go\b|\bbug\b|\bstack ?trace\b|traceback|lỗi code|sửa lỗi|viết code|code giúp|đoạn code|error:)/i;

const REASONING_SIGNALS =
  /(tại sao|vì sao|giai thích|giải thích|chứng minh|so sánh|phân tích|nếu.*thì|bao nhiêu phần trăm|%|toán|tính nhẩm|logic|nguyên lý|đánh giá|ưu nhược|khác nhau giữa|en quoi|pourquoi|why\b|explain\b|compare\b|prove\b|analy[sz]e\b)/i;

const TRIVIAL_SIGNALS =
  /^(xin )?(chào|hello|hi|hey|alo|hí|ê)\b|^(cảm ơn|thanks|thank you|ok|okay|ừ|ừm|ok rồi|tạm biệt|bye)\b/i;

export class ModelRouter {
  classify(input: RouterInput): RouterDecision {
    const reasons: string[] = [];
    let taskType: TaskType = "chat";
    let complexity: Complexity = "SIMPLE";

    const text = input.text;
    const totalLen = text.length + (input.attachmentsChars ?? 0);

    // 1) Loại nhiệm vụ
    if (CODE_SIGNALS.test(text)) {
      taskType = "coding";
      complexity = "COMPLEX";
      reasons.push("phát hiện tín hiệu lập trình");
    } else if (REASONING_SIGNALS.test(text) || /\?\s*$/.test(text.trim()) === false && text.length > 300) {
      if (REASONING_SIGNALS.test(text)) {
        taskType = "reasoning";
        reasons.push("từ khoá suy luận/giải thích");
      }
    }

    // 2) Độ phức tạp
    if (TRIVIAL_SIGNALS.test(text.trim()) && text.length < 60) {
      complexity = "TRIVIAL";
      reasons.push("câu chào/từ ngắn");
    } else if (complexity !== "COMPLEX") {
      if (totalLen > 3000 || (input.attachmentsChars ?? 0) > 2000) {
        complexity = "EXPERT";
        taskType = taskType === "chat" ? "long_context" : taskType;
        reasons.push("ngữ cảnh/tài liệu dài");
      } else if (totalLen > 800) {
        complexity = "COMPLEX";
        reasons.push("câu hỏi dài");
      } else if (taskType === "reasoning") {
        complexity = "COMPLEX";
      } else if (/\?[^?]*\?/.test(text) || text.split(/[.;\n]/).filter((s) => s.trim().length > 10).length >= 3) {
        complexity = "MODERATE";
        reasons.push("nhiều ý con");
      } else {
        complexity = "SIMPLE";
      }
    }

    if (input.historyLength >= 8 && complexity === "SIMPLE") {
      complexity = "MODERATE";
      reasons.push("hội thoại nhiều lượt");
    }

    // 3) Chọn profile (user override thắng)
    const profileId =
      input.overrideProfile ??
      (taskType === "coding"
        ? "CODING"
        : taskType === "long_context"
          ? "LONG_CONTEXT"
          : profileForComplexity(complexity));

    return { taskType, complexity, profileId, reasons };
  }

  /** API dạng ModelRouter.select({taskType, complexity, ...}) cho tương lai. */
  select(params: { taskType?: TaskType; complexity?: Complexity; contextSize?: number }): ProfileId {
    if (params.taskType === "coding") return "CODING";
    if (params.taskType === "agent") return "AGENT";
    if (params.taskType === "long_context" || (params.contextSize ?? 0) > 3000) return "LONG_CONTEXT";
    if (params.complexity) return profileForComplexity(params.complexity);
    return "GENERAL";
  }
}
