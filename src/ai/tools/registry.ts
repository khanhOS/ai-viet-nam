// KhanhOS AI — Tool Registry + công cụ builtin THẬT.
// Mọi tool: validate input/output, permission, chạy thật, log thật.
// KHÔNG có tool nào fake. Tool nguy hiểm (viết file, terminal) CHƯA bật —
// chỉ khai báo interface, phải được chủ sở hữu bật rõ ràng (bảo mật).

import type { PermissionLevel, ToolResult } from "@/ai/core/types";

export interface ToolContext {
  userId: string;
  conversationId: string;
  /** thư mục gốc cho phép đọc (READ_ONLY) */
  allowedReadDirs?: string[];
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: string; // mô tả JSON ngắn gọn cho model đọc
  permissionLevel: PermissionLevel;
  /** Cho phép chạy tự động không cần hỏi user */
  autoRunnable: boolean;
  validateInput(args: Record<string, unknown>): string | null; // trả lỗi hoặc null
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<string>;
}

// ─────────────────────────────────────────────
// calculator — máy tính AN TOÀN (tokenizer + shunting-yard, KHÔNG eval)
// ─────────────────────────────────────────────

function tokenizeExpression(input: string): string[] | null {
  const tokens: string[] = [];
  let i = 0;
  const s = input.replace(/\s+/g, "");
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let num = "";
      let dots = 0;
      while (i < s.length && /[0-9.]/.test(s[i])) {
        if (s[i] === "." && ++dots > 1) return null;
        num += s[i];
        i++;
      }
      tokens.push(num);
    } else if ("+-*/%^()".includes(c)) {
      tokens.push(c);
      i++;
    } else {
      return null; // ký tự lạ → từ chối (chống injection)
    }
  }
  return tokens.length ? tokens : null;
}

function precedence(op: string): number {
  if (op === "+" || op === "-") return 1;
  if (op === "*" || op === "/" || op === "%") return 2;
  if (op === "^") return 3;
  return 0;
}

export function safeEvaluate(expr: string): number | null {
  const tokens = tokenizeExpression(expr);
  if (!tokens) return null;
  const output: string[] = [];
  const ops: string[] = [];
  let prevWasValue = false;

  for (const t of tokens) {
    if (/^[0-9.]+$/.test(t)) {
      output.push(t);
      prevWasValue = true;
    } else if (t === "(") {
      ops.push(t);
      prevWasValue = false;
    } else if (t === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") output.push(ops.pop()!);
      if (!ops.length) return null;
      ops.pop();
      prevWasValue = true;
    } else {
      // unary minus
      if (t === "-" && !prevWasValue) output.push("0");
      while (ops.length && precedence(ops[ops.length - 1]) >= precedence(t)) {
        output.push(ops.pop()!);
      }
      ops.push(t);
      prevWasValue = false;
    }
  }
  while (ops.length) {
    const op = ops.pop()!;
    if (op === "(") return null;
    output.push(op);
  }

  const stack: number[] = [];
  for (const t of output) {
    if (/^[0-9.]+$/.test(t)) {
      stack.push(parseFloat(t));
    } else {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) return null;
      let r: number;
      switch (t) {
        case "+": r = a + b; break;
        case "-": r = a - b; break;
        case "*": r = a * b; break;
        case "/": if (b === 0) return null; r = a / b; break;
        case "%": if (b === 0) return null; r = a % b; break;
        case "^": r = Math.pow(a, b); break;
        default: return null;
      }
      if (!Number.isFinite(r)) return null;
      stack.push(r);
    }
  }
  return stack.length === 1 ? stack[0] : null;
}

// ─────────────────────────────────────────────
// Định nghĩa các tool builtin
// ─────────────────────────────────────────────

const calculator: Tool = {
  name: "calculator",
  description:
    "Máy tính chính xác cho biểu thức số học: + - * / % ^ và ngoặc (). Dùng khi cần tính toán chính xác.",
  inputSchema: '{"expr": "biểu thức toán, vd: (12.5 + 7) * 3"}',
  permissionLevel: "READ_ONLY",
  autoRunnable: true,
  validateInput(args) {
    if (typeof args.expr !== "string" || !args.expr.trim()) return "thiếu 'expr' (chuỗi biểu thức)";
    if (args.expr.length > 200) return "biểu thức quá dài (tối đa 200 ký tự)";
    return null;
  },
  async execute(args) {
    const r = safeEvaluate(String(args.expr));
    if (r === null) return `LỖI: biểu thức không hợp lệ hoặc chia cho 0: ${args.expr}`;
    // format gọn (tránh 0.30000000000000004)
    const pretty = Number.isInteger(r) ? String(r) : String(parseFloat(r.toFixed(10)));
    return `${args.expr} = ${pretty}`;
  },
};

const datetime: Tool = {
  name: "datetime",
  description: "Lấy ngày giờ hiện tại (múi giờ cấu hình server) và các phép đổi giờ/phút/giây.",
  inputSchema: '{"op": "now" | "convert", "value?": "số", "from?": "giây|phút|giờ|ngày"}',
  permissionLevel: "READ_ONLY",
  autoRunnable: true,
  validateInput(args) {
    if (!["now", "convert"].includes(String(args.op))) return "op phải là 'now' hoặc 'convert'";
    return null;
  },
  async execute(args, _ctx) {
    if (args.op === "now") {
      const tz = process.env.TZ || "Asia/Ho_Chi_Minh";
      const now = new Date();
      return `Bây giờ (múi giờ ${tz}): ${now.toISOString()} — bản địa: ${now.toLocaleString("vi-VN")}`;
    }
    const v = Number(args.value);
    if (!Number.isFinite(v)) return "LỖI: 'value' phải là số";
    const from = String(args.from ?? "giây");
    const mult: Record<string, number> = {
      "giây": 1, "phút": 60, "giờ": 3600, "ngày": 86400,
      "second": 1, "minute": 60, "hour": 3600, "day": 86400,
    };
    const m = mult[from];
    if (!m) return `LỖI: không hiểu đơn vị '${from}'`;
    const seconds = v * m;
    return `${v} ${from} = ${seconds} giây = ${(seconds / 60).toFixed(2)} phút = ${(seconds / 3600).toFixed(2)} giờ`;
  },
};

const jsonParser: Tool = {
  name: "json_parser",
  description: "Kiểm tra & làm đẹp chuỗi JSON. Trả về lỗi cụ thể tại vị trí sai (nếu hỏng).",
  inputSchema: '{"text": "chuỗi JSON cần kiểm tra"}',
  permissionLevel: "READ_ONLY",
  autoRunnable: true,
  validateInput(args) {
    if (typeof args.text !== "string" || !args.text.trim()) return "thiếu 'text'";
    if (args.text.length > 50000) return "JSON quá lớn (tối đa 50KB)";
    return null;
  },
  async execute(args) {
    try {
      const parsed = JSON.parse(String(args.text));
      return `JSON HỢP LỆ. Đã parse:\n${JSON.stringify(parsed, null, 2).slice(0, 4000)}`;
    } catch (e) {
      return `JSON HỎNG: ${e instanceof Error ? e.message : "lỗi parse"}`;
    }
  },
};

const textProcessor: Tool = {
  name: "text_processor",
  description:
    "Xử lý văn bản: đếm từ/ký tự, chuyển hoa-thường, đảo ngược, cắt ngắn. op: count | upper | lower | reverse | truncate",
  inputSchema: '{"op": "count|upper|lower|reverse|truncate", "text": "chuỗi", "limit?": 100}',
  permissionLevel: "READ_ONLY",
  autoRunnable: true,
  validateInput(args) {
    if (typeof args.text !== "string") return "thiếu 'text'";
    if (!["count", "upper", "lower", "reverse", "truncate"].includes(String(args.op)))
      return "op không hợp lệ";
    return null;
  },
  async execute(args) {
    const text = String(args.text);
    switch (String(args.op)) {
      case "count": {
        const words = text.split(/\s+/).filter(Boolean).length;
        return `Từ: ${words} | Ký tự: ${text.length} | Ký tự không khoảng trắng: ${text.replace(/\s/g, "").length}`;
      }
      case "upper": return text.toUpperCase();
      case "lower": return text.toLowerCase();
      case "reverse": return [...text].reverse().join("");
      case "truncate": {
        const limit = Number(args.limit ?? 100);
        return text.length <= limit ? text : text.slice(0, limit) + "…";
      }
      default: return "LỖI: op lạ";
    }
  },
};

const randomTool: Tool = {
  name: "random",
  description: "Sinh số ngẫu nhiên thật (crypto) trong khoảng [min, max], hoặc chọn ngẫu nhiên 1 phần tử từ danh sách.",
  inputSchema: '{"op": "number" | "pick", "min?": 1, "max?": 100, "items?": ["a","b"]}',
  permissionLevel: "READ_ONLY",
  autoRunnable: true,
  validateInput(args) {
    if (args.op === "pick" && !Array.isArray(args.items)) return "op=pick cần 'items' (mảng)";
    return null;
  },
  async execute(args) {
    const crypto = await import("node:crypto");
    if (args.op === "pick") {
      const items = args.items as unknown[];
      if (!items.length) return "LỖI: danh sách rỗng";
      const idx = crypto.randomInt(items.length);
      return `Chọn ngẫu nhiên: ${JSON.stringify(items[idx])}`;
    }
    const min = Math.trunc(Number(args.min ?? 1));
    const max = Math.trunc(Number(args.max ?? 100));
    if (min > max) return "LỖI: min > max";
    const n = crypto.randomInt(min, max + 1);
    return `Số ngẫu nhiên trong [${min}, ${max}]: ${n}`;
  },
};

// ─────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────

export const BUILTIN_TOOLS: Tool[] = [
  calculator,
  datetime,
  jsonParser,
  textProcessor,
  randomTool,
];

const registry = new Map<string, Tool>();
for (const t of BUILTIN_TOOLS) registry.set(t.name, t);

export function getTool(name: string): Tool | undefined {
  return registry.get(name);
}

export function listToolDefs(): Array<{
  name: string;
  description: string;
  inputSchema: string;
  permissionLevel: string;
  autoRunnable: boolean;
}> {
  return BUILTIN_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    permissionLevel: t.permissionLevel,
    autoRunnable: t.autoRunnable,
  }));
}

/** Tool kết quả chuẩn hoá. */
export function makeToolResult(
  callId: string,
  name: string,
  ok: boolean,
  output: string,
  error: string | undefined,
  durationMs: number
): ToolResult {
  return { callId, name, ok, output: output.slice(0, 8000), error, durationMs };
}
