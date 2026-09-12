// KhanhOS AI — Plans modal: gói dịch vụ Free/Plus/VIP/Max
// - Xem gói hiện tại + tín dụng đã dùng tháng này (progress bar)
// - Chọn gói trả phí → form nâng cấp: thông tin chuyển khoản MoMo + SĐT + Gmail + MoMo + ghi chú
// - Chủ sở hữu: duyệt/từ chối yêu cầu nâng cấp ngay trong modal

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useUIStore } from "@/store/use-ui-store";
import { useAuthStore } from "@/store/use-auth-store";
import { useToast } from "@/hooks/use-toast";
import { PLANS, formatVND, formatCredits, type PlanInfo } from "@/lib/plans";
import {
  Sparkles, Check, X, Loader2, ArrowLeft, Phone, Mail, MessageSquareText,
  Wallet, Copy, CheckCircle2, Crown, ShieldCheck, Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types (khớp /api/plans + /api/plan-requests) ──
interface PlansPayload {
  plans: PlanInfo[];
  payment: { accountName: string; accountNumber: string; methods: string; note: string };
  plan: string | null;
  role?: string;
  usage: { planName: string; usage: number; limit: number | null; remaining: number | null } | null;
  pendingRequest: { id: string; plan: string; createdAt: string } | null;
}

interface AdminRequest {
  id: string;
  plan: string;
  phone: string;
  momoNumber: string | null;
  contactEmail: string;
  note: string | null;
  status: string;
  createdAt: string;
  user: { id: string; name: string; email: string; plan: string; role: string };
}

const ACCENTS: Record<PlanInfo["accent"], { badge: string; btn: string; border: string }> = {
  primary: {
    badge: "border-primary/30 bg-primary/12 text-primary",
    btn: "bg-primary text-primary-foreground hover:brightness-110",
    border: "border-primary/25",
  },
  emerald: {
    badge: "border-emerald-500/30 bg-emerald-500/12 text-emerald-500",
    btn: "bg-emerald-500 text-white hover:brightness-110",
    border: "border-emerald-500/25",
  },
  violet: {
    badge: "border-violet-500/30 bg-violet-500/12 text-violet-400",
    btn: "bg-violet-500 text-white hover:brightness-110",
    border: "border-violet-500/25",
  },
  amber: {
    badge: "border-amber-500/30 bg-amber-500/12 text-amber-500",
    btn: "bg-amber-500 text-black hover:brightness-110",
    border: "border-amber-500/40",
  },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return new Date(iso).toLocaleDateString("vi-VN", { day: "numeric", month: "short" });
}

export function PlansModal() {
  const open = useUIStore((s) => s.plansModalOpen);
  const setOpen = useUIStore((s) => s.setPlansModalOpen);
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const { toast } = useToast();

  const [data, setData] = useState<PlansPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"plans" | "form" | "success">("plans");
  const [chosen, setChosen] = useState<PlanInfo | null>(null);

  // Form state
  const [phone, setPhone] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Owner: danh sách yêu cầu
  const [requests, setRequests] = useState<AdminRequest[] | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const isOwner = user?.role === "owner";

  // Load dữ liệu khi mở modal
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/plans")
      .then((r) => r.json())
      .then((d) => setData(d ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    if (user?.role === "owner") {
      fetch("/api/plan-requests")
        .then((r) => r.json())
        .then((d) => setRequests(d?.requests ?? []))
        .catch(() => setRequests([]));
    }
  }, [open, user?.role]);

  // Reset khi đóng
  useEffect(() => {
    if (!open) {
      setStep("plans");
      setChosen(null);
      setSubmitting(false);
    }
  }, [open]);

  const refresh = () => {
    fetch("/api/plans")
      .then((r) => r.json())
      .then((d) => setData(d ?? null))
      .catch(() => {});
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `Đã sao chép ${label}` });
    } catch {
      toast({ title: "Không sao chép được", variant: "destructive" });
    }
  };

  const openForm = (plan: PlanInfo) => {
    setChosen(plan);
    setPhone("");
    setMomoNumber("");
    setContactEmail(user?.email ?? "");
    setNote("");
    setStep("form");
  };

  const submitRequest = async () => {
    if (!chosen) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/plan-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: chosen.id, phone, momoNumber, contactEmail, note: note || undefined }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast({ title: "Không gửi được yêu cầu", description: d?.error, variant: "destructive" });
        return;
      }
      setStep("success");
      refresh();
    } catch {
      toast({ title: "Lỗi kết nối", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const decide = async (id: string, action: "approve" | "reject") => {
    setDecidingId(id);
    try {
      const res = await fetch(`/api/plan-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast({ title: "Không xử lý được", description: d?.error, variant: "destructive" });
        return;
      }
      toast({
        title: action === "approve" ? "Đã duyệt — gói đã kích hoạt" : "Đã từ chối yêu cầu",
      });
      // Refresh cả hai nguồn
      fetch("/api/plan-requests")
        .then((r) => r.json())
        .then((d2) => setRequests(d2?.requests ?? []))
        .catch(() => {});
      refresh();
    } catch {
      toast({ title: "Lỗi kết nối", variant: "destructive" });
    } finally {
      setDecidingId(null);
    }
  };

  const usage = data?.usage ?? null;
  const limit = usage?.limit ?? null;
  const usedPct = usage && limit ? Math.min(100, Math.round((usage.usage / limit) * 100)) : 0;
  const currentPlan = user ? (data?.plan ?? user.plan ?? "free") : null; // khách: chưa có gói
  const pending = data?.pendingRequest ?? null;
  const payment = data?.payment;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="kh-glass-strong max-h-[88dvh] max-w-[560px] overflow-y-auto rounded-2xl border-foreground/10 p-0">
        <AnimatePresence mode="wait" initial={false}>
          {/* ═══ VIEW: DANH SÁCH GÓI ═══ */}
          {step === "plans" && (
            <motion.div
              key="plans"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="p-6"
            >
              <DialogHeader className="text-left">
                <DialogTitle className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Gói dịch vụ
                </DialogTitle>
                <DialogDescription className="text-[13px]">
                  Hạn mức tín dụng mỗi tháng. Nâng cấp bất cứ lúc nào — kích hoạt ngay sau khi chủ sở hữu duyệt.
                </DialogDescription>
              </DialogHeader>

              {/* Usage banner */}
              {user && (
                <div className="mt-4 rounded-xl border border-foreground/10 bg-foreground/4 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-foreground">
                      Gói hiện tại:{" "}
                      <span className="text-primary">
                        {isOwner ? "Chủ sở hữu (không giới hạn)" : (usage?.planName ?? "Free")}
                      </span>
                    </span>
                    {usage && limit !== null && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatCredits(usage.usage)} / {formatCredits(limit)} tín dụng
                      </span>
                    )}
                  </div>
                  {usage && limit !== null && (
                    <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-foreground/8">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${usedPct}%` }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className={cn("h-full rounded-full", usedPct >= 90 ? "bg-destructive" : "bg-primary")}
                      />
                    </div>
                  )}
                  {usage && limit === null && (
                    <p className="mt-1.5 text-xs text-muted-foreground">Tín dụng đã dùng tháng này: {formatCredits(usage.usage)}</p>
                  )}
                  {usage && limit !== null && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Còn lại {formatCredits(usage.remaining ?? 0)} tín dụng • làm mới mùng 1 mỗi tháng
                    </p>
                  )}
                </div>
              )}

              {/* Pending banner */}
              {pending && (
                <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-500" />
                  <p className="text-[13px] text-foreground/90">
                    Yêu cầu nâng cấp lên{" "}
                    <b>{PLANS.find((p) => p.id === pending.plan)?.name ?? pending.plan}</b> đang chờ duyệt
                    ({timeAgo(pending.createdAt)}).
                  </p>
                </div>
              )}

              {/* Plan cards */}
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PLANS.map((plan) => {
                  const accent = ACCENTS[plan.accent];
                  const isCurrent = currentPlan === plan.id;
                  const isChosen = pending?.plan === plan.id;
                  return (
                    <div
                      key={plan.id}
                      className={cn(
                        "relative flex flex-col rounded-2xl border p-4 transition-all",
                        isCurrent ? cn(accent.border, "bg-foreground/6") : "border-foreground/10 bg-foreground/3",
                        plan.id === "max" && "sm:col-span-2"
                      )}
                    >
                      {isCurrent && (
                        <span className={cn("absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", accent.badge)}>
                          <Check className="h-3 w-3" />
                          Đang dùng
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <span className={cn("inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-bold uppercase tracking-wide", accent.badge)}>
                          {plan.name}
                        </span>
                      </div>
                      <p className="mt-2 font-display text-xl font-bold tabular-nums text-foreground">
                        {formatVND(plan.priceVND)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{plan.tagline}</p>
                      <ul className="mt-3 space-y-1.5">
                        {plan.perks.map((perk) => (
                          <li key={perk} className="flex items-start gap-1.5 text-[12.5px] leading-snug text-foreground/80">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                            {perk}
                          </li>
                        ))}
                      </ul>
                      {user ? (
                        <div className="mt-4">
                          {isCurrent ? (
                            <div className="flex h-9 w-full items-center justify-center rounded-xl border border-foreground/10 text-[13px] font-medium text-muted-foreground">
                              Gói hiện tại
                            </div>
                          ) : isChosen ? (
                            <div className="flex h-9 w-full items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/8 text-[13px] font-medium text-amber-600 dark:text-amber-400">
                              Chờ duyệt
                            </div>
                          ) : plan.priceVND > 0 ? (
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={() => openForm(plan)}
                              className={cn("flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition-all", accent.btn)}
                            >
                              Nâng cấp
                            </motion.button>
                          ) : (
                            <div className="flex h-9 w-full items-center justify-center rounded-xl border border-foreground/10 text-[13px] font-medium text-muted-foreground">
                              Miễn phí
                            </div>
                          )}
                        </div>
                      ) : (
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            setOpen(false);
                            openAuthModal("register");
                          }}
                          className="mt-4 flex h-9 w-full items-center justify-center rounded-xl border border-primary/30 bg-primary/8 text-[13px] font-medium text-primary transition-all hover:bg-primary/12"
                        >
                          Đăng nhập để bắt đầu
                        </motion.button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Owner: duyệt yêu cầu */}
              {isOwner && (
                <div className="mt-6 rounded-xl border border-foreground/10 bg-foreground/3 p-4">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                      <Crown className="h-4 w-4 text-primary" />
                      Yêu cầu nâng cấp
                    </p>
                    {(requests?.length ?? 0) > 0 && (
                      <span className="rounded-full border border-primary/30 bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {requests!.length}
                      </span>
                    )}
                  </div>
                  {requests === null ? (
                    <div className="mt-3 space-y-2">
                      {[1, 2].map((i) => (
                        <div key={i} className="h-14 animate-pulse rounded-lg bg-foreground/6" />
                      ))}
                    </div>
                  ) : requests.length === 0 ? (
                    <p className="mt-2.5 text-xs text-muted-foreground">Chưa có yêu cầu nào.</p>
                  ) : (
                    <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                      {requests.map((r) => (
                        <div key={r.id} className="rounded-lg border border-foreground/10 bg-foreground/4 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium text-foreground">
                                {r.user.name}{" "}
                                <span className="font-normal text-muted-foreground">({r.user.email})</span>
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                <b className="text-foreground/80">{r.user.plan}</b> →{" "}
                                <b className="text-primary">{PLANS.find((p) => p.id === r.plan)?.name ?? r.plan}</b>{" "}
                                • {timeAgo(r.createdAt)}
                              </p>
                              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                                SĐT {r.phone}{r.momoNumber ? ` • MoMo ${r.momoNumber}` : ""} • {r.contactEmail}
                              </p>
                              {r.note && <p className="mt-0.5 truncate text-xs italic text-muted-foreground">“{r.note}”</p>}
                            </div>
                            {r.status === "pending" ? (
                              <div className="flex shrink-0 gap-1.5">
                                <button
                                  onClick={() => decide(r.id, "approve")}
                                  disabled={decidingId === r.id}
                                  aria-label="Duyệt yêu cầu"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
                                >
                                  {decidingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                </button>
                                <button
                                  onClick={() => decide(r.id, "reject")}
                                  disabled={decidingId === r.id}
                                  aria-label="Từ chối yêu cầu"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/25 bg-destructive/8 text-destructive transition-all hover:bg-destructive/15 disabled:opacity-50"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <span
                                className={cn(
                                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
                                  r.status === "approved"
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                                    : "border-destructive/25 bg-destructive/8 text-destructive"
                                )}
                              >
                                {r.status === "approved" ? "Đã duyệt" : "Đã từ chối"}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {loading && !data && (
                <div className="mt-4 flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              <p className="mt-4 flex items-center gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                Thanh toán qua MoMo / chuyển khoản. Chủ sở hữu duyệt thủ công — gói kích hoạt ngay sau khi duyệt.
              </p>
            </motion.div>
          )}

          {/* ═══ VIEW: FORM NÂNG CẤP ═══ */}
          {step === "form" && chosen && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="p-6"
            >
              <button
                onClick={() => setStep("plans")}
                className="mb-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Quay lại
              </button>
              <DialogHeader className="text-left">
                <DialogTitle className="font-display text-lg font-semibold tracking-tight">
                  Nâng cấp lên {chosen.name}
                </DialogTitle>
                <DialogDescription className="text-[13px]">
                  {formatCredits(chosen.monthlyCredits)} tín dụng mỗi tháng • {formatVND(chosen.priceVND)}
                </DialogDescription>
              </DialogHeader>

              {/* Thông tin thanh toán */}
              <div className="mt-4 rounded-xl border border-primary/25 bg-primary/6 p-4">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                  <Wallet className="h-4 w-4 text-primary" />
                  Thông tin chuyển khoản
                </p>
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-foreground/4 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Số tiền</p>
                      <p className="text-[13px] font-bold tabular-nums text-foreground">{formatVND(chosen.priceVND)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-foreground/4 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Chủ tài khoản</p>
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {payment?.accountName ?? "HOANG BAO KHANH"}
                      </p>
                    </div>
                    <button
                      onClick={() => copy(payment?.accountName ?? "HOANG BAO KHANH", "tên")}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground"
                      aria-label="Sao chép tên chủ tài khoản"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-foreground/4 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Số tài khoản / MoMo</p>
                      <p className="text-[13px] font-bold tabular-nums tracking-wide text-foreground">
                        {payment?.accountNumber ?? "000000"}
                      </p>
                    </div>
                    <button
                      onClick={() => copy(payment?.accountNumber ?? "000000", "số tài khoản")}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground"
                      aria-label="Sao chép số tài khoản"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {payment?.note ?? "Chuyển khoản đúng số tiền, nội dung kèm email đăng ký."}
                  </p>
                </div>
              </div>

              {/* Form */}
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    Số điện thoại <span className="text-destructive">*</span>
                  </span>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    maxLength={15}
                    placeholder="0901234567"
                    className="h-10 rounded-xl border-foreground/10 bg-foreground/4"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                    <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                    Số MoMo (tài khoản dùng để thanh toán) <span className="text-destructive">*</span>
                  </span>
                  <Input
                    value={momoNumber}
                    onChange={(e) => setMomoNumber(e.target.value)}
                    inputMode="tel"
                    maxLength={15}
                    placeholder="0901234567"
                    className="h-10 rounded-xl border-foreground/10 bg-foreground/4"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    Gmail liên hệ <span className="text-destructive">*</span>
                  </span>
                  <Input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    inputMode="email"
                    maxLength={254}
                    placeholder="ten@gmail.com"
                    className="h-10 rounded-xl border-foreground/10 bg-foreground/4"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                    <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
                    Ghi chú (tùy chọn)
                  </span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder="VD: đã chuyển khoản lúc 14h30, nội dung: email đăng ký…"
                    className="w-full resize-none rounded-xl border border-foreground/10 bg-foreground/4 px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
                  />
                </label>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={submitRequest}
                disabled={submitting || !phone.trim() || !momoNumber.trim() || !contactEmail.trim()}
                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {submitting ? "Đang gửi…" : "Gửi yêu cầu nâng cấp"}
              </motion.button>
              <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
                Gửi sau khi đã chuyển khoản. Chủ sở hữu kiểm tra và duyệt — gói kích hoạt ngay.
              </p>
            </motion.div>
          )}

          {/* ═══ VIEW: THÀNH CÔNG ═══ */}
          {step === "success" && chosen && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/12"
              >
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </motion.div>
              <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-foreground">
                ĐÃ GHI NHẬN!
              </h3>
              <p className="mx-auto mt-2 max-w-[320px] text-[13px] leading-relaxed text-muted-foreground">
                Yêu cầu nâng cấp lên <b className="text-primary">{chosen.name}</b> đã được gửi.
                Chủ sở hữu sẽ kiểm tra chuyển khoản và duyệt — gói kích hoạt ngay sau đó.
              </p>
              <button
                onClick={() => setOpen(false)}
                className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
              >
                Hoàn tất
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
