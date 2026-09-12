// KhanhOS AI — Landing sections (dưới hero, scroll để xem)
// Features → CTA → Footer. Kết nối thật: CTA focus composer, Login mở modal.
// Không nút giả — mọi hành động đều có tác dụng thật.

"use client";

import { motion } from "framer-motion";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  Zap,
  History,
  Layers,
  ShieldCheck,
  MonitorSmartphone,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "@/store/use-auth-store";

const FEATURES = [
  {
    icon: Zap,
    title: "AI siêu nhanh",
    desc: "Bộ máy tri thức cục bộ trả lời gần như tức thì — không chờ network, không hàng đợi API ngoài.",
  },
  {
    icon: History,
    title: "Hội thoại lưu mãi",
    desc: "Mọi cuộc trò chuyện được lưu trong database thật — quay lại tiếp tục bất cứ lúc nào.",
  },
  {
    icon: Layers,
    title: "Tri thức cục bộ",
    desc: "Chatbot chạy 100% local bằng intent + knowledge từ file JSON — không API ngoài, không API key.",
  },
  {
    icon: ShieldCheck,
    title: "Bảo mật thật",
    desc: "Mật khẩu hash, session server-side, cookie httpOnly, rate limiting và chống truy cập chéo.",
  },
  {
    icon: MonitorSmartphone,
    title: "Mọi thiết bị",
    desc: "Giao diện responsive mượt từ điện thoại đến desktop — đồng bộ qua tài khoản của bạn.",
  },
] as const;

const fadeUp = {
  initial: { opacity: 0, y: 28, filter: "blur(8px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-80px" },
};

/** Glow bám theo con trỏ trong card — set CSS var --mx/--my (px). */
function trackGlow(e: ReactMouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
}

export function LandingSections() {
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);

  const startChatting = () => {
    window.dispatchEvent(new CustomEvent("kh:focus-composer"));
    document.querySelector("[data-home-scroll]")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="w-full border-t border-foreground/6 bg-background/40">
      {/* ── FEATURES ─────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Vì sao chọn <span className="kh-text-gradient">KhanhOS AI</span>?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            Một trợ lý AI nghiêm túc: nhanh, bảo mật, và thực sự nhớ bạn —
            không phải bản thử nghiệm.
          </p>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              {...fadeUp}
              transition={{ duration: 0.55, delay: i * 0.07 }}
              onMouseMove={trackGlow}
              className="kh-glass kh-card-glow group rounded-2xl p-5 transition-all duration-300 hover:border-primary/25 hover:shadow-[0_0_28px_oklch(0.55_0.11_172/10%)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {f.desc}
              </p>
            </motion.div>
          ))}

          {/* Card thứ 6: điểm nhấn stats */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.35 }}
            onMouseMove={trackGlow}
            className="kh-glass kh-card-glow relative overflow-hidden rounded-2xl p-5"
          >
            <div className="kh-anim-pulse-glow pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/15 blur-2xl" />
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-[15px] font-semibold text-foreground">
              Kiến trúc mở
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              Lớp ChatEngine trừu tượng — sau này cắm model local thật
              (Ollama, llama.cpp) mà không phải viết lại ứng dụng.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:pb-20">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6 }}
          onMouseMove={trackGlow}
          className="kh-glass kh-card-glow relative overflow-hidden rounded-3xl px-6 py-10 text-center sm:px-12 sm:py-14"
        >
          <div className="kh-anim-aurora pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-[2rem]">
            Sẵn sàng bắt đầu?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            {user
              ? "Tiếp tục cuộc trò chuyện của bạn ngay bên dưới."
              : "Tạo tài khoản miễn phí — hội thoại đầu tiên chỉ cách một câu hỏi."}
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={startChatting}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary hover:kh-glow-sm"
            >
              Bắt đầu trò chuyện
              <ArrowRight className="h-4 w-4" />
            </motion.button>
            {!user && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => openAuthModal("login")}
                className="rounded-full border border-foreground/12 bg-foreground/4 px-6 py-3 text-sm font-medium text-foreground transition-all hover:border-primary/30 hover:bg-foreground/8"
              >
                Đăng nhập
              </motion.button>
            )}
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ───────────────────────────── */}
      <footer className="mx-auto w-full max-w-5xl px-4 pb-8">
        <div className="flex flex-col items-center justify-between gap-4 border-t border-foreground/6 pt-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md border border-primary/25 bg-primary/8">
              <span className="font-display text-[10px] font-bold text-primary">K</span>
            </div>
            <span className="text-[13px] text-muted-foreground">
              KhanhOS AI © {new Date().getFullYear()}
            </span>
          </div>
          <nav className="flex items-center gap-5 text-[13px] text-muted-foreground">
            <button
              onClick={startChatting}
              className="transition-colors hover:text-foreground"
            >
              Trò chuyện
            </button>
            {!user && (
              <button
                onClick={() => openAuthModal("register")}
                className="transition-colors hover:text-foreground"
              >
                Đăng ký
              </button>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}
