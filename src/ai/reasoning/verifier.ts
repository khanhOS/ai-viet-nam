// KhanhOS AI — VerifierEngine: tự kiểm tra kết quả trước khi trả user.
// Checks: rỗng, bị cắt, sai ngôn ngữ, lộ secret, hỏng markdown, thừa mirror.
// Nếu fail → trả feedback để ReasoningEngine sinh lại (giới hạn vòng lặp).

export interface VerificationCheck {
  name: string;
  passed: boolean;
  note?: string;
}

export interface VerificationResult {
  passed: boolean; // true khi KHÔNG có check nghiêm trọng nào fail
  checks: VerificationCheck[];
  severity: "ok" | "warn" | "fail";
  feedback: string | null; // hướng dẫn sửa cho vòng revise
}

export interface VerifyInput {
  output: string;
  language: "vi" | "en";
  finishReason: "stop" | "length" | "error" | null;
  userQuestion: string;
  /** danh sách check bật theo profile */
  thorough: boolean;
}

const SECRET_LEAK_RE =
  /\b(sk-[A-Za-z0-9_-]{16,})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|DATABASE_URL\s*=\s*\S+/;

/**
 * Câu từ chối thẳng (chủ sở hữu CẤM — bot phải luôn trả lời best-effort).
 * Chỉ bắt dạng TRỪ CHỐI THẲNG ở đầu câu / đứng một mình, tránh bắt nhầm
 * câu hợp lệ kiểu "tôi không thể nói chắc 100% nhưng theo mình...".
 */
const REFUSAL_HEAD_RE =
  /^\s*(xin\s+lỗi|tôi\s+xin\s+lỗi|riêng\s+tôi\s+xin\s+lỗi|sorry,?\s*(but)?|i'?m\s+sorry)[^\n.!?]{0,40}?(không\s+thể|cannot|can'?t|không\s+biết\s+trả\s+lời|don'?t\s+know\s+the\s+answer|không\s+thể\s+trả\s+lời)/i;
const REFUSAL_ANYWHERE_RE =
  /(tôi\s+không\s+thể\s+trả\s+lời|tôi\s+không\s+biết\s+cách\s+trả\s+lời|điều\s+này\s+vượt\s+khả\s+năng\s+của\s+tôi|i\s+cannot\s+answer|beyond\s+my\s+capabilities|beyond\s+my\s+knowledge\s+base)/i;

function isRefusal(text: string): boolean {
  return REFUSAL_HEAD_RE.test(text) || REFUSAL_ANYWHERE_RE.test(text);
}

/** Mirror: model nhại lại câu hỏi thay vì trả lời. */
function looksLikeMirror(output: string, question: string): boolean {
  const q = question.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter((w) => w.length > 3);
  if (q.length < 4) return false;
  const o = output.toLowerCase();
  const overlap = q.filter((w) => o.includes(w)).length / q.length;
  return overlap > 0.92 && output.length < question.length * 1.3;
}

/** Kiểm tra ngôn ngữ đầu ra khớp ngôn ngữ câu hỏi (heuristic dấu tiếng Việt). */
function isVietnameseText(text: string): boolean {
  const vietChars = (text.match(/[àáảãạăâđèéêìíòóôưũùý]/gi) || []).length;
  return vietChars >= Math.max(2, text.length * 0.01);
}

export function verifyOutput(input: VerifyInput): VerificationResult {
  const checks: VerificationCheck[] = [];
  const out = input.output.trim();

  // 1. Không rỗng
  checks.push({
    name: "non_empty",
    passed: out.length > 0,
    note: out.length === 0 ? "model trả chuỗi rỗng" : undefined,
  });

  // 2. Không bị cắt giữa chừng
  const truncated =
    input.finishReason === "length" ||
    (out.length > 0 && !/[\s)\]\}"'`。，！？.!?…]$/.test(out) && out.length > 80);
  checks.push({
    name: "not_truncated",
    passed: !truncated,
    note: truncated ? "câu trả lời dở dang (finish=length hoặc kết thúc bất thường)" : undefined,
  });

  // 3. Không lộ secret
  const leak = SECRET_LEAK_RE.test(out);
  checks.push({
    name: "no_secret_leak",
    passed: !leak,
    note: leak ? "phát hiện chuỗi giống khoá bí mật" : undefined,
  });

  // 3b. KHÔNG từ chối thẳng (chủ sở hữu cấm — luôn trả lời best-effort)
  const refusal = isRefusal(out);
  checks.push({
    name: "no_refusal",
    passed: !refusal,
    note: refusal
      ? "mở đầu/có câu 'xin lỗi… không thể' — cấm từ chối, hãy trả lời trực tiếp bằng phần biết + nêu giả định"
      : undefined,
  });

  // 4. Ngôn ngữ khớp
  if (input.language === "vi") {
    const ok = isVietnameseText(out) || out.length < 120 || /```/.test(out); // code block tiếng Anh chấp nhận
    checks.push({
      name: "language_match",
      passed: ok,
      note: ok ? undefined : "câu hỏi tiếng Việt nhưng trả lời toàn tiếng Anh",
    });
  }

  // 5. Không mirror câu hỏi
  const mirror = looksLikeMirror(out, input.userQuestion);
  checks.push({
    name: "not_mirror",
    passed: !mirror,
    note: mirror ? "trả lời chỉ nhại lại câu hỏi" : undefined,
  });

  // 6. Markdown cân bằng (thorough)
  if (input.thorough) {
    const fences = (out.match(/```/g) || []).length;
    checks.push({
      name: "balanced_code_fences",
      passed: fences % 2 === 0,
      note: fences % 2 !== 0 ? "khối code thiếu dấu đóng" : undefined,
    });
  }

  const hardFails = checks.filter(
    (c) => !c.passed && ["non_empty", "not_truncated", "no_secret_leak", "no_refusal"].includes(c.name)
  );
  const softFails = checks.filter((c) => !c.passed && !hardFails.includes(c));

  let feedback: string | null = null;
  if (hardFails.length || softFails.length) {
    feedback = [...hardFails, ...softFails]
      .filter((c) => !c.passed)
      .map((c) => `${c.name}: ${c.note}`)
      .join("; ");
  }

  return {
    passed: hardFails.length === 0 && softFails.length === 0,
    checks,
    severity: hardFails.length ? "fail" : softFails.length ? "warn" : "ok",
    feedback,
  };
}
