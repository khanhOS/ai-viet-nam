// Iron Forge — Member Stories: carousel tự chạy + kéo- kéo- thả có rubber-band.
// Ảnh before/after tinh thần: người là chủ thể, số liệu chuyển hoá rõ ràng.

"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { STORIES } from "./fitness-data";
import { useSectionReveal, useInView } from "./fitness-hooks";
import { usePrefersReducedMotion } from "@/hooks/use-mouse-parallax";

const AUTO_ADVANCE_MS = 5500;

export function FitnessStories() {
  const sectionRef = useSectionReveal<HTMLElement>();
  const { ref: viewRef, inView } = useInView<HTMLElement>(0.2);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [page, setPage] = useState(0);
  const [holding, setHolding] = useState(false);
  const [metrics, setMetrics] = useState({ step: 360, maxScroll: 0 });
  const reduced = usePrefersReducedMotion();

  const count = STORIES.length;
  const maxPage = count - 1;

  // Đo bề rộng thẻ + tổng cuộn được (khi mount và khi resize)
  useEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      const container = containerRef.current;
      if (!track || !container) return;
      const cards = track.querySelectorAll<HTMLElement>("[data-story-card]");
      const step =
        cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : container.clientWidth;
      setMetrics({
        step,
        maxScroll: Math.max(0, track.scrollWidth - container.clientWidth),
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Tự chạy — dừng khi: hover/đang kéo/ra khỏi viewport/tab ẩn/reduced-motion
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      if (!holding && inView && !document.hidden) {
        setPage((p) => (p + 1 > maxPage ? 0 : p + 1));
      }
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [holding, inView, maxPage, reduced]);

  const xTarget = -Math.min(page * metrics.step, metrics.maxScroll);

  const go = (dir: 1 | -1) => {
    setPage((p) => Math.min(maxPage, Math.max(0, p + dir)));
  };

  const onDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    setHolding(false);
    // Dự đoán trang đích theo vị trí thả + vận tốc quăng (hỗ trợ flick)
    const projected = -(xTarget + info.offset.x + info.velocity.x * 0.22);
    const nextPage = Math.round(projected / metrics.step);
    setPage(Math.min(maxPage, Math.max(0, nextPage)));
  };

  return (
    <section
      id="fx-stories"
      ref={(node) => {
        sectionRef(node);
        viewRef(node);
      }}
      className="relative overflow-hidden px-5 py-20 sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="fx-reveal fx-kicker text-[11px] font-semibold text-[var(--fx-orange)]">
              03 — Câu chuyện hội viên
            </p>
            <h3 className="fx-reveal fx-heading mt-3 font-display text-4xl font-bold uppercase text-white sm:text-5xl">
              Kết quả thật,
              <br />
              <span className="text-white/40">từ người thật.</span>
            </h3>
          </div>
          <div className="fx-reveal flex items-center gap-2">
            <button
              onClick={() => go(-1)}
              disabled={page === 0}
              aria-label="Câu chuyện trước"
              className="flex h-10 w-10 items-center justify-center border border-white/15 text-white/70 transition-all hover:border-[var(--fx-orange)]/60 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => go(1)}
              disabled={page >= maxPage}
              aria-label="Câu chuyện tiếp theo"
              className="flex h-10 w-10 items-center justify-center border border-white/15 text-white/70 transition-all hover:border-[var(--fx-orange)]/60 hover:text-white disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Carousel — kéo để lướt (rubber-band ở hai mép) */}
      <div
        ref={containerRef}
        className="fx-carousel mx-auto mt-9 max-w-6xl overflow-hidden px-1 py-1"
        onMouseEnter={() => setHolding(true)}
        onMouseLeave={() => setHolding(false)}
      >
        <motion.div
          ref={trackRef}
          className="flex gap-5"
          drag={reduced ? false : "x"}
          dragConstraints={{ left: -metrics.maxScroll, right: 0 }}
          dragElastic={0.18}
          dragMomentum={false}
          onDragStart={() => setHolding(true)}
          onDragEnd={onDragEnd}
          animate={{ x: xTarget }}
          transition={{ type: "spring", stiffness: 280, damping: 32 }}
        >
          {STORIES.map((s) => (
            <article
              key={s.id}
              data-story-card
              className="fx-card w-[82vw] max-w-[400px] shrink-0 select-none overflow-hidden border border-[var(--fx-line)] bg-[var(--fx-panel)] sm:w-[400px]"
            >
              <div className="relative h-64 sm:h-72">
                <img
                  src={s.image}
                  alt={`${s.name} — ${s.goal}`}
                  loading="lazy"
                  draggable={false}
                  className="fx-photo h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--fx-panel)] via-black/20 to-transparent" />
                <span className="fx-kicker absolute left-4 top-4 border border-[var(--fx-orange)]/50 bg-black/60 px-2.5 py-1 text-[10px] font-bold text-[var(--fx-orange)] backdrop-blur-sm">
                  {s.goal}
                </span>
              </div>

              <div className="p-5">
                <blockquote className="text-[13.5px] leading-relaxed text-white/75">
                  <span className="mr-1 font-display text-2xl font-bold leading-none text-[var(--fx-orange)]" aria-hidden="true">
                    “
                  </span>
                  {s.quote}
                </blockquote>

                <div className="mt-4 grid grid-cols-3 gap-px border border-[var(--fx-line)] bg-[var(--fx-line)]">
                  {s.results.map((r) => (
                    <div key={r.label} className="bg-[#101011] px-2.5 py-2.5 text-center">
                      <p className="font-display text-[15px] font-bold tabular-nums text-[var(--fx-orange)]">
                        {r.value}
                      </p>
                      <p className="mt-0.5 text-[9px] uppercase tracking-widest text-white/40">{r.label}</p>
                    </div>
                  ))}
                </div>

                <footer className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="font-display text-[14px] font-bold text-white">
                      {s.name} <span className="font-normal text-white/45">· {s.age}</span>
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-white/45">
                      <TrendingUp className="h-3 w-3 text-[var(--fx-orange)]" aria-hidden="true" />
                      {s.duration}
                    </p>
                  </div>
                </footer>
              </div>
            </article>
          ))}
        </motion.div>
      </div>

      {/* Dots */}
      <div className="mx-auto mt-6 flex max-w-6xl items-center justify-center gap-2 px-5">
        {STORIES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setPage(i)}
            aria-label={`Chuyển đến câu chuyện của ${s.name}`}
            aria-current={page === i}
            className={`h-1.5 transition-all duration-300 ${
              page === i
                ? "w-8 bg-[var(--fx-orange)]"
                : "w-3 bg-white/20 hover:bg-white/40"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
