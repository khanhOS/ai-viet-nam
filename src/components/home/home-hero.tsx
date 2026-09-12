// KhanhOS AI — Home hero
// Trải nghiệm mở web: brand xuất hiện → visual floating → tagline → composer
// Tối giản, có chiều sâu, không nhồi nhét.
// Hiệu ứng: shimmer gradient trên wordmark, glow "thở" quanh composer,
// chiều sâu khi scroll (scale + fade + dịch lên), particle network nền.

"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { AIOrb } from "@/components/app/ai-orb";
import { ChatComposer } from "@/components/composer/chat-composer";
import { LandingSections } from "@/components/home/landing-sections";
import { useAuthStore } from "@/store/use-auth-store";

const TAGLINES = [
  "Bắt đầu điều gì đó…",
  "Hỏi bất cứ điều gì bạn tò mò",
  "Tạo, viết, code, khám phá",
  "Ý tưởng của bạn, trí tuệ của AI",
];

function TaglineCycler() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return; // tagline đầu giữ nguyên
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % TAGLINES.length);
        setVisible(true);
      }, 350);
    }, 4200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-7 text-center" aria-live="polite">
      <AnimatePresence mode="wait">
        {visible && (
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="text-[15px] font-light tracking-wide text-muted-foreground"
          >
            {TAGLINES[index]}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export function HomeHero() {
  // Đã đăng nhập ⇒ trang chủ chỉ còn khung chat (hero + composer),
  // ẩn toàn bộ landing bên dưới (yêu cầu owner).
  // Gate qua `ready` để chờ session load xong — user đã đăng nhập
  // không thấy landing nhấp nháy rồi biến mất.
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const showLanding = ready && !user;

  // Chiều sâu khi scroll: hero co nhẹ + mờ + trôi lên khi cuộn xuống landing.
  // Theo dõi TRỰC TIẾP container [data-home-scroll] (window không cuộn) →
  // motion value cập nhật mượt, không re-render.
  const heroRef = useRef<HTMLDivElement>(null);
  const progress = useMotionValue(0);
  const depthScale = useTransform(progress, [0, 1], [1, 0.94]);
  const depthOpacity = useTransform(progress, [0, 0.7], [1, 0.2]);
  const depthY = useTransform(progress, [0, 1], [0, -48]);

  useEffect(() => {
    const hero = heroRef.current;
    const scroller = hero?.closest("[data-home-scroll]") as HTMLElement | null;
    if (!hero || !scroller) return;

    const update = () => {
      const elRect = scroller.getBoundingClientRect();
      const rect = hero.getBoundingClientRect();
      // p = 0 khi hero top chạm mép trên container;
      // p = 1 khi hero bottom chạm mép trên container (hero cuộn hết)
      const p = Math.min(1, Math.max(0, (elRect.top - rect.top) / rect.height));
      progress.set(p);
    };

    update();
    scroller.addEventListener("scroll", update, { passive: true });
    return () => scroller.removeEventListener("scroll", update);
  }, [progress]);

  return (
    <div className="w-full">
      {/* ── HERO (màn hình đầu) ── */}
      <div
        ref={heroRef}
        className="flex min-h-dvh flex-col items-center justify-center px-4 pb-20 pt-24"
      >
        <motion.div
          style={{ scale: depthScale, opacity: depthOpacity, y: depthY }}
          className="flex w-full flex-col items-center"
        >
          {/* AI Orb — visual trung tâm, floating + parallax */}
          <motion.div
            initial={{ opacity: 0, scale: 0.82, filter: "blur(12px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            className="kh-anim-float"
          >
            <AIOrb size={320} parallaxStrength={1} className="scale-[0.85] sm:scale-100" />
          </motion.div>

          {/* Brand wordmark — gradient trôi (shimmer) */}
          <motion.h1
            initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
            className="font-display text-[2.6rem] font-bold tracking-tight sm:text-5xl"
          >
            <span className="kh-text-gradient kh-anim-shimmer-text">KhanhOS AI</span>
          </motion.h1>

          {/* Tagline */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-3"
          >
            <TaglineCycler />
          </motion.div>

          {/* Composer — glow "thở" phía sau */}
          <motion.div
            initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.55 }}
            className="relative mt-10 w-full max-w-[42rem]"
          >
            <div
              className="kh-anim-pulse-glow pointer-events-none absolute -inset-5 rounded-[2.5rem] bg-primary/10 blur-2xl"
              aria-hidden="true"
            />
            <ChatComposer placeholder="Bạn muốn làm gì hôm nay?" />
          </motion.div>
        </motion.div>
      </div>

      {/* ── LANDING: features + CTA + footer — CHỈ dành cho khách chưa đăng nhập ── */}
      {showLanding && <LandingSections />}
    </div>
  );
}
