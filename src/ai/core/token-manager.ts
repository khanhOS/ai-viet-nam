// KhanhOS AI — Token Manager (ước lượng trung thực)
// Không có tokenizer chính xác của từng model trong sandbox → dùng ước lượng
// heuristic và LUÔN gắn nhãn estimated=true. Nếu runtime trả số liệu thật
// (Ollama metrics) thì dùng số thật và estimated=false.

import type { InferenceUsage } from "./types";

/**
 * Ước lượng số lượng đơn vị ngữ cảnh (xấp xỉ BPE):
 * - Tiếng Việt/tiếng Latin: ~1 từ ≈ 1.3 đơn vị, dấu câu tách riêng
 * - CJK: ~1 ký tự Han ≈ 1 đơn vị
 * - Code: dày đặc hơn (~3.2 đơn vị/từ)
 * Đây là ƯỚC LƯỢNG — mọi số hiển thị ra UI đều ghi rõ "ước tính".
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const nonCjk = text.replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, " ");
  const words = nonCjk.split(/\s+/).filter(Boolean).length;
  const punctuation = (nonCjk.match(/[{}()[\];:,.?!@#$%^&*+=/\\|`"'<>~-]/g) || []).length;
  const digits = (nonCjk.match(/\d/g) || []).length;
  return Math.max(1, Math.round(cjk + words * 1.3 + punctuation * 0.3 + digits * 0.2));
}

export function estimateMessagesTokens(
  messages: Array<{ role: string; content: string }>
): number {
  let total = 0;
  for (const m of messages) {
    total += estimateTokens(m.content) + 4; // overhead mỗi message (role, delimiter)
  }
  return total;
}

export function makeEstimatedUsage(promptTokens: number, outputTokens: number): InferenceUsage {
  return { promptTokens, outputTokens, estimated: true };
}

/** Quản lý ngân sách ngữ cảnh cho một lần sinh. */
export class TokenBudget {
  readonly max: number;
  private used = 0;

  constructor(max: number) {
    this.max = max;
  }

  get remaining(): number {
    return Math.max(0, this.max - this.used);
  }

  get spent(): number {
    return this.used;
  }

  /** Trừ ngân sách; trả về false nếu không còn chỗ. */
  charge(n: number): boolean {
    if (this.used + n > this.max) return false;
    this.used += n;
    return true;
  }

  /** Trừ nếu vừa, nếu không thì thêm vào cuối với dung lượng còn lại. */
  chargePartial(n: number): number {
    const room = this.remaining;
    const take = Math.min(n, room);
    this.used += take;
    return take;
  }
}
