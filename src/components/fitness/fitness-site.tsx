// Iron Forge — Fitness studio brand sections, gắn dưới landing sẵn có của KhanhOS AI.
// Không đụng giao diện gốc: toàn bộ nằm trong namespace .fx- và portal riêng cho fixed layers.

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FitnessHero } from "./fitness-hero";
import { FitnessCurriculum } from "./fitness-curriculum";
import { FitnessCoaches } from "./fitness-coaches";
import { FitnessStories } from "./fitness-stories";
import { FitnessBooking } from "./fitness-booking";
import { useInView, useMounted } from "./fitness-hooks";

const MARQUEE_WORDS = [
  "IRON FORGE",
  "KHÔNG ĐƯỜNG TẮT",
  "KHÔNG LÝ DO",
  "CHỈ CÓ KỶ LUẬT",
  "MỒ HÔI TẠO NÊN THÉP",
  "MỘT GIA ĐÌNH",
  "RÈN THÂN RÈN TÂM",
];

function BrandMarquee() {
  const doubled = [...MARQUEE_WORDS, ...MARQUEE_WORDS];
  return (
    <div
      className="relative overflow-hidden border-y border-[var(--fx-line)] bg-[#080809] py-3.5"
      aria-hidden="true"
    >
      <div className="fx-marquee-track">
        {doubled.map((w, i) => (
          <span
            key={`${w}-${i}`}
            className="mx-6 flex items-center gap-6 whitespace-nowrap font-display text-[13px] font-bold uppercase tracking-[0.22em] text-white/30"
          >
            {w}
            <span className="h-1.5 w-1.5 rotate-45 bg-[var(--fx-orange)]/70" />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Lớp grain phủ viewport (portal) — hiện khi vùng fitness trong tầm nhìn,
 *  nhiễu film chạy + trôi parallax theo scroll (rAF, reduced-motion tắt).
 *  Chỉ render sau mount (useMounted) để tránh hydration mismatch. */
function GrainLayer({ active }: { active: boolean }) {
  const [driftY, setDriftY] = useState(0);
  const mounted = useMounted();

  useEffect(() => {
    if (!active) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let raf = 0;
    let last = -1;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = Math.round(window.scrollY * 0.07);
        if (y !== last) {
          last = y;
          setDriftY(y);
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [active]);

  // Portal chỉ render trên client sau khi hydrate xong
  if (!mounted) return null;

  return createPortal(
    <div
      className={`fx-grain ${active ? "fx-grain-on" : ""}`}
      style={{ transform: `translate3d(0, ${driftY}px, 0)` }}
      aria-hidden="true"
    />,
    document.body
  );
}

export function FitnessSite() {
  const { ref, inView } = useInView<HTMLElement>(0);

  return (
    <section ref={ref} className="fx-root relative w-full" aria-label="IRON FORGE — thương hiệu phòng tập">
      <FitnessHero />
      <BrandMarquee />
      <FitnessCurriculum />
      <FitnessCoaches />
      <FitnessStories />
      <FitnessBooking fitnessInView={inView} />
      <GrainLayer active={inView} />
    </section>
  );
}
