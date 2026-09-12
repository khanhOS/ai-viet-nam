// KhanhOS AI — Model Profiles: cấu hình sinh theo loại nhiệm vụ.
// User đổi profile không cần sửa code (qua modelId "runtime:<model>@<profile>"
// hoặc mặc định tự chọn).

import type { Complexity, TaskType } from "@/ai/core/types";
import type { GenerationOptions } from "@/ai/core/types";

export type ProfileId =
  | "GENERAL"
  | "REASONING"
  | "CODING"
  | "FAST"
  | "LONG_CONTEXT"
  | "AGENT";

export interface ModelProfile {
  id: ProfileId;
  label: string;
  description: string;
  options: GenerationOptions;
  /** Số vòng tự sửa tối đa (verify → revise) */
  maxIterations: number;
  /** Có chạy vòng tool không */
  useTools: boolean;
}

export const MODEL_PROFILES: Record<ProfileId, ModelProfile> = {
  GENERAL: {
    id: "GENERAL",
    label: "Chung",
    description: "Trò chuyện & trả lời đa chủ đề",
    options: { temperature: 0.7, topP: 0.9, maxOutputTokens: 768, contextLength: 4096 },
    maxIterations: 1,
    useTools: false,
  },
  REASONING: {
    id: "REASONING",
    label: "Suy luận",
    description: "Phân tích, so sánh, giải thích nguyên nhân",
    options: { temperature: 0.5, topP: 0.9, maxOutputTokens: 1024, contextLength: 4096 },
    maxIterations: 2,
    useTools: false,
  },
  CODING: {
    id: "CODING",
    label: "Lập trình",
    description: "Viết & sửa code, giải thích kỹ thuật",
    options: { temperature: 0.3, topP: 0.9, maxOutputTokens: 1024, repeatPenalty: 1.05, contextLength: 4096 },
    maxIterations: 2,
    useTools: false,
  },
  FAST: {
    id: "FAST",
    label: "Nhanh",
    description: "Câu hỏi đơn giản — trả lời gọn",
    options: { temperature: 0.3, topP: 0.8, maxOutputTokens: 256, contextLength: 4096 },
    maxIterations: 0,
    useTools: false,
  },
  LONG_CONTEXT: {
    id: "LONG_CONTEXT",
    label: "Ngữ cảnh dài",
    description: "Tài liệu dài, nhiều thông tin",
    options: { temperature: 0.6, topP: 0.9, maxOutputTokens: 1024, contextLength: 4096 },
    maxIterations: 1,
    useTools: false,
  },
  AGENT: {
    id: "AGENT",
    label: "Agent",
    description: "Tự lập kế hoạch + chạy công cụ + tự kiểm tra",
    options: { temperature: 0.4, topP: 0.9, maxOutputTokens: 1024, contextLength: 4096 },
    maxIterations: 2,
    useTools: true,
  },
};

export function getProfile(id: string | null | undefined): ModelProfile {
  if (id && id in MODEL_PROFILES) return MODEL_PROFILES[id as ProfileId];
  return MODEL_PROFILES.GENERAL;
}

/** Bảng mapping complexity → profile mặc định. */
export function profileForComplexity(c: Complexity): ProfileId {
  switch (c) {
    case "TRIVIAL":
      return "FAST";
    case "COMPLEX":
    case "EXPERT":
      return "REASONING";
    case "SIMPLE":
    case "MODERATE":
    default:
      return "GENERAL";
  }
}
