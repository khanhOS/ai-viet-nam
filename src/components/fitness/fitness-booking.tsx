// Iron Forge — Booking: CTA "Đặt buổi tập thử" (pulse nhẹ) + form modal lưu thật vào DB
// + sticky bottom bar xuất hiện khi lướt qua vùng CTA.

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  Phone,
  CalendarClock,
  Zap,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { GOAL_OPTIONS, TIME_OPTIONS } from "./fitness-data";
import { useSectionReveal, useInView, useMounted } from "./fitness-hooks";

interface BookingFormState {
  name: string;
  phone: string;
  goal: string;
  preferredTime: string;
  note: string;
}

const EMPTY: BookingFormState = { name: "", phone: "", goal: "", preferredTime: "", note: "" };

export function FitnessBooking({ fitnessInView }: { fitnessInView: boolean }) {
  const sectionRef = useSectionReveal<HTMLElement>();
  const { ref: bookingViewRef, inView: bookingInView } = useInView<HTMLElement>(0.35);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BookingFormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const mounted = useMounted();
  const { toast } = useToast();

  const stickyOn = fitnessInView && !bookingInView;

  const openModal = () => {
    setDone(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (form.name.trim().length < 2) {
      toast({ title: "Vui lòng nhập họ tên", variant: "destructive" });
      return;
    }
    if (!form.goal || !form.preferredTime) {
      toast({ title: "Vui lòng chọn mục tiêu và khung giờ", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/trial-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          goal: form.goal,
          preferredTime: form.preferredTime,
          note: form.note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Không gửi được", description: data?.error, variant: "destructive" });
        return;
      }
      setDone(data?.message ?? "Đã nhận đăng ký.");
      setForm(EMPTY);
    } catch {
      toast({ title: "Lỗi kết nối. Thử lại sau.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ── Section CTA ── */}
      <section
        id="fx-booking"
        ref={(node) => {
          sectionRef(node);
          bookingViewRef(node);
        }}
        className="relative px-5 pb-28 pt-20 sm:px-8 sm:pb-36 sm:pt-28"
      >
        <div className="fx-reveal relative mx-auto max-w-6xl overflow-hidden border border-[var(--fx-line)] bg-[var(--fx-panel)]">
          {/* Vệt cam neon góc */}
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(circle, var(--fx-orange), transparent 65%)" }}
            aria-hidden="true"
          />
          <div className="relative flex flex-col items-start gap-8 p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="fx-kicker text-[11px] font-semibold text-[var(--fx-orange)]">
                04 — Bắt đầu ngay
              </p>
              <h3 className="fx-heading mt-3 font-display text-4xl font-bold uppercase text-white sm:text-5xl">
                Buổi tập thử
                <br />
                <span className="text-[var(--fx-orange)]">miễn phí 45 phút.</span>
              </h3>
              <ul className="mt-5 space-y-2.5 text-[13.5px] text-white/65">
                <li className="flex items-center gap-2.5">
                  <Zap className="h-4 w-4 shrink-0 text-[var(--fx-orange)]" aria-hidden="true" />
                  Đánh giá thể lực + tư vấn mục tiêu 1-kèm-1 cùng HLV trưởng
                </li>
                <li className="flex items-center gap-2.5">
                  <CalendarClock className="h-4 w-4 shrink-0 text-[var(--fx-orange)]" aria-hidden="true" />
                  Trải nghiệm 1 buổi tập thật theo lộ trình gợi ý — không ràng buộc
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--fx-orange)]" aria-hidden="true" />
                  Không thu tiền, không cần thẻ. Chỉ cần bạn đến.
                </li>
              </ul>
            </div>
            <button
              onClick={openModal}
              className="fx-cta-pulse fx-divider-notch group flex h-14 shrink-0 items-center gap-3 bg-[var(--fx-orange)] px-8 font-display text-[15px] font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98]"
            >
              Đặt lịch ngay
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Sticky bottom bar (portal, chỉ sau mount — hydration-safe) ── */}
      {mounted &&
        createPortal(
          <div
            className={`fx-sticky-cta ${stickyOn ? "fx-sticky-on" : ""}`}
            aria-hidden={!stickyOn}
          >
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 border-t border-[var(--fx-orange)]/30 bg-[#0a0a0b]/95 px-5 py-3 backdrop-blur-md sm:px-8 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <p className="min-w-0 truncate text-[12px] font-semibold uppercase tracking-wide text-white/75 sm:text-[13px]">
                Buổi tập thử miễn phí
                <span className="ml-2 hidden font-normal normal-case text-white/45 sm:inline">
                  · 45 phút cùng HLV trưởng · không ràng buộc
                </span>
              </p>
              <button
                onClick={openModal}
                tabIndex={stickyOn ? 0 : -1}
                className="flex h-10 shrink-0 items-center gap-2 bg-[var(--fx-orange)] px-5 text-[12px] font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                Đặt ngay
              </button>
            </div>
          </div>,
          document.body
        )}
      {/* ── Modal form ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] max-w-[440px] overflow-y-auto rounded-none border border-[var(--fx-orange)]/25 bg-[#0c0c0d] p-0 text-white">
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="p-7 text-center"
              >
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--fx-orange)]/40 bg-[var(--fx-orange-soft)]"
                >
                  <CheckCircle2 className="h-8 w-8 text-[var(--fx-orange)]" aria-hidden="true" />
                </motion.div>
                <DialogTitle className="mt-4 font-display text-xl font-bold uppercase">
                  Đã ghi nhận!
                </DialogTitle>
                <DialogDescription className="mt-2 text-[13px] leading-relaxed text-white/60">
                  {done}
                </DialogDescription>
                <button
                  onClick={() => setOpen(false)}
                  className="fx-divider-notch mt-5 h-11 w-full bg-[var(--fx-orange)] text-[13px] font-bold uppercase tracking-wider text-black transition-all hover:brightness-110"
                >
                  Hoàn tất
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={submit}
                className="space-y-4 p-6"
                noValidate
              >
                <DialogHeader className="space-y-1.5 text-left">
                  <DialogTitle className="font-display text-lg font-bold uppercase tracking-tight">
                    Đặt buổi tập thử
                  </DialogTitle>
                  <DialogDescription className="text-[12px] text-white/50">
                    Miễn phí 45 phút · HLV trưởng sẽ gọi xác nhận trong 24 giờ.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-1.5">
                  <Label htmlFor="fx-name" className="text-[12px] text-white/70">Họ và tên</Label>
                  <Input
                    id="fx-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Nguyễn Văn A"
                    autoComplete="name"
                    maxLength={60}
                    className="h-10 rounded-none border-white/15 bg-white/4 text-[13px] focus-visible:border-[var(--fx-orange)]/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fx-phone" className="text-[12px] text-white/70">Số điện thoại</Label>
                  <Input
                    id="fx-phone"
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="09xx xxx xxx"
                    autoComplete="tel"
                    className="h-10 rounded-none border-white/15 bg-white/4 text-[13px] focus-visible:border-[var(--fx-orange)]/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px] text-white/70">Mục tiêu</Label>
                  <Select value={form.goal} onValueChange={(v) => setForm((f) => ({ ...f, goal: v }))}>
                    <SelectTrigger className="h-10 rounded-none border-white/15 bg-white/4 text-[13px] focus-visible:border-[var(--fx-orange)]/60">
                      <SelectValue placeholder="Chọn mục tiêu của bạn" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-white/15 bg-[#121213] text-white">
                      {GOAL_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-[13px] focus:bg-[var(--fx-orange)]/25 focus:text-white">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px] text-white/70">Khung giờ thuận tiện</Label>
                  <Select
                    value={form.preferredTime}
                    onValueChange={(v) => setForm((f) => ({ ...f, preferredTime: v }))}
                  >
                    <SelectTrigger className="h-10 rounded-none border-white/15 bg-white/4 text-[13px] focus-visible:border-[var(--fx-orange)]/60">
                      <SelectValue placeholder="Chọn khung giờ" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-white/15 bg-[#121213] text-white">
                      {TIME_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-[13px] focus:bg-[var(--fx-orange)]/25 focus:text-white">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fx-note" className="text-[12px] text-white/70">
                    Ghi chú <span className="text-white/35">(tuỳ chọn)</span>
                  </Label>
                  <Textarea
                    id="fx-note"
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                    placeholder="Chấn thương cũ, lịch bận đột xuất, mong muốn riêng…"
                    maxLength={500}
                    rows={3}
                    className="rounded-none border-white/15 bg-white/4 text-[13px] focus-visible:border-[var(--fx-orange)]/60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="fx-divider-notch flex h-11 w-full items-center justify-center gap-2 bg-[var(--fx-orange)] text-[13px] font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" aria-hidden="true" />}
                  Gửi đăng ký
                </button>
                <p className="text-center text-[10.5px] leading-relaxed text-white/35">
                  Thông tin chỉ dùng để liên hệ xác nhận lịch hẹn và được bảo mật.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
