// KhanhOS AI — Gói dịch vụ & hạn mức tín dụng (nguồn sự thật duy nhất)
// ----------------------------------------------------------------
// Số liệu theo yêu cầu chủ sở hữu:
//   Free 25k tín dụng/tháng • Plus 85k (55.000đ) • VIP 256k (99.000đ) • Max 500k (159.000đ)
// Muốn đổi hạn mức/giá: chỉ cần sửa PLANS ở đây — UI + API tự theo.
// (Ghi chú: VIP từng được nói "128k", bản chốt lấy 256k — đổi 1 dòng nếu cần.)

export type PlanId = "free" | "plus" | "vip" | "max";

export interface PlanInfo {
  id: PlanId;
  name: string;
  /** Hạn mức tín dụng phản hồi AI mỗi tháng (chủ sở hữu = không giới hạn) */
  monthlyCredits: number;
  /** Giá gói mỗi tháng (VND). Free = 0. */
  priceVND: number;
  tagline: string;
  perks: string[];
  /** Màu nhấn dùng cho UI */
  accent: "primary" | "amber" | "violet" | "emerald";
  order: number;
}

export const PLANS: PlanInfo[] = [
  {
    id: "free",
    name: "Free",
    monthlyCredits: 25_000,
    priceVND: 0,
    tagline: "Khởi đầu đủ dùng",
    accent: "primary",
    order: 1,
    perks: [
      "25.000 tín dụng mỗi tháng",
      "Model KhanhOS Core",
      "Lưu hội thoại mãi mãi",
      "Đủ tính năng chat cơ bản",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    monthlyCredits: 85_000,
    priceVND: 55_000,
    tagline: "Cho người dùng mỗi ngày",
    accent: "emerald",
    order: 2,
    perks: [
      "85.000 tín dụng mỗi tháng",
      "Mọi model khả dụng",
      "Ưu tiên hàng đợi",
      "Web search không giới hạn",
    ],
  },
  {
    id: "vip",
    name: "VIP",
    monthlyCredits: 256_000,
    priceVND: 99_000,
    tagline: "Nhiều việc, nhiều ý tưởng",
    accent: "violet",
    order: 3,
    perks: [
      "256.000 tín dụng mỗi tháng",
      "Mọi model khả dụng",
      "Ưu tiên cao",
      "Tệp đính kèm & hội thoại dài",
    ],
  },
  {
    id: "max",
    name: "Max",
    monthlyCredits: 500_000,
    priceVND: 159_000,
    tagline: "Không phải nghĩ tới giới hạn",
    accent: "amber",
    order: 4,
    perks: [
      "500.000 tín dụng mỗi tháng",
      "Mọi model, ưu tiên tối đa",
      "Hội thoại dài nhất",
      "Hỗ trợ từ chủ sở hữu",
    ],
  },
];

const PLAN_MAP = new Map<string, PlanInfo>(PLANS.map((p) => [p.id, p]));

export function getPlan(id: string | null | undefined): PlanInfo {
  return PLAN_MAP.get(id ?? "") ?? PLANS[0];
}

/** Hạn mức tín dụng/tháng — chủ sở hữu không giới hạn. */
export function monthlyTokenLimit(plan: string, role?: string): number {
  if (role === "owner") return Number.POSITIVE_INFINITY;
  return getPlan(plan).monthlyCredits;
}

export const PAID_PLAN_IDS: PlanId[] = ["plus", "vip", "max"];

export function isPaidPlan(id: string): boolean {
  return PAID_PLAN_IDS.includes(id as PlanId);
}

// ── Thông tin thanh toán (nâng cấp thủ công qua MoMo / chuyển khoản) ──
// Override bằng env PAYMENT_ACCOUNT_NAME / PAYMENT_ACCOUNT_NUMBER khi có sẵn.
export const PAYMENT_INFO = {
  accountName: process.env.PAYMENT_ACCOUNT_NAME ?? "HOANG BAO KHANH",
  accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER ?? "000000",
  methods: "MoMo • Chuyển khoản ngân hàng",
  note: "Chuyển khoản đúng số tiền gói, nội dung kèm email đăng ký. Sau khi chủ sở hữu duyệt, gói kích hoạt ngay.",
} as const;

// ── Format helpers (dùng cả server + client) ──
export function formatVND(vnd: number): string {
  if (vnd === 0) return "Miễn phí";
  return `${vnd.toLocaleString("vi-VN")}đ/tháng`;
}

export function formatCredits(credits: number): string {
  if (!Number.isFinite(credits)) return "Không giới hạn";
  return credits.toLocaleString("vi-VN");
}

/** Ước lượng mức dùng từ nội dung (≈4 ký tự/đơn vị — dùng để ghi usage). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
