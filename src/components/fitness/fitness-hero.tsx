// Iron Forge — Hero: reel slow-motion tự chạy (đen trắng), click bật âm thanh thật,
// brand attitude + dải HLV + số liệu. People là chủ thể, nền mờ tối.

"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Volume2, VolumeX, ArrowDown, Flame } from "lucide-react";
import { REEL_IMAGES, REEL_VOICE, BRAND_STATS, COACHES } from "./fitness-data";

const REEL_MS = 5200;

export function FitnessHero() {
  const [index, setIndex] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  // Reel tự chạy — chỉ khi hero còn trong viewport, tab hiển thị, không reduced-motion
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let visible = true;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible = e.isIntersecting;
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    const id = setInterval(() => {
      if (visible && !document.hidden) {
        setIndex((i) => (i + 1) % REEL_IMAGES.length);
      }
    }, REEL_MS);
    return () => {
      io.disconnect();
      clearInterval(id);
    };
  }, []);

  const toggleSound = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (soundOn) {
      audio.pause();
      audio.currentTime = 0;
      setSoundOn(false);
    } else {
      audio.currentTime = 0;
      audio
        .play()
        .then(() => setSoundOn(true))
        .catch(() => setSoundOn(false));
    }
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section
      ref={heroRef}
      className="fx-reel relative flex min-h-[92svh] w-full items-center overflow-hidden"
      aria-label="IRON FORGE — phòng tập cao cấp"
    >
      {/* ── Reel slow-motion đen trắng ── */}
      {REEL_IMAGES.map((src, i) => (
        <div
          key={src}
          className={`fx-reel-layer ${i === index ? "fx-active" : ""}`}
          aria-hidden="true"
        >
          <img src={src} alt="" loading={i === 0 ? "eager" : "lazy"} />
        </div>
      ))}

      {/* Âm thanh thật — voiceover động lực, bật bằng click (autoplay policy) */}
      <audio ref={audioRef} src={REEL_VOICE} preload="none" onEnded={() => setSoundOn(false)} />

      {/* ── Nội dung ── */}
      <div className="relative z-[3] mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="fx-kicker mb-4 flex items-center gap-2 text-[11px] font-semibold text-[var(--fx-silver)]"
        >
          <Flame className="h-3.5 w-3.5 text-[var(--fx-orange)]" aria-hidden="true" />
          Phòng tập cao cấp · TP. Hồ Chí Minh
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.75, delay: 0.08 }}
          className="fx-heading font-display text-[13.5vw] font-bold uppercase leading-[0.9] text-white sm:text-6xl md:text-7xl lg:text-8xl"
        >
          Rèn thép
          <br />
          <span className="text-[var(--fx-orange)]">thân thể.</span>
          <br />
          Rèn thép <span className="text-white/40">ý chí.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.18 }}
          className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/70"
        >
          Ở đây không có kỳ diệu — chỉ có kỷ luật. Mỗi buổi tập được HLV chứng nhận
          quốc tế kèm sát 100%, mỗi tiến bộ đều đo được bằng số liệu. Bạn không tập
          một mình: <strong className="font-semibold text-white/90">cả một cộng đồng
          cùng gánh cùng bạn.</strong>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.26 }}
          className="mt-8 flex flex-wrap items-center gap-4"
        >
          <button
            onClick={() => scrollTo("fx-booking")}
            className="fx-cta-pulse fx-divider-notch h-12 bg-[var(--fx-orange)] px-7 text-[13px] font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Đặt buổi tập thử — miễn phí
          </button>
          <button
            onClick={() => scrollTo("fx-programs")}
            className="flex h-12 items-center gap-2 border border-white/20 px-6 text-[13px] font-semibold uppercase tracking-wider text-white/85 backdrop-blur-sm transition-all hover:border-[var(--fx-orange)]/60 hover:text-white active:scale-[0.98]"
          >
            Xem chương trình
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </motion.div>

        {/* ── Stats ── */}
        <motion.dl
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.34 }}
          className="mt-12 grid max-w-2xl grid-cols-2 gap-px bg-[var(--fx-line)] sm:grid-cols-4"
        >
          {BRAND_STATS.map((s) => (
            <div key={s.label} className="bg-[var(--fx-ink)]/80 px-4 py-3.5 backdrop-blur-sm">
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-display text-2xl font-bold tabular-nums text-white">
                {s.value}
              </dd>
              <dd className="mt-0.5 text-[11px] uppercase tracking-wide text-white/50">{s.label}</dd>
            </div>
          ))}
        </motion.dl>
      </div>

      {/* ── Dải HLV (coach team showcase) ── */}
      <motion.button
        initial={{ opacity: 0, x: -18 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.4 }}
        onClick={() => scrollTo("fx-coaches")}
        className="group absolute bottom-6 left-5 z-[3] flex items-center gap-3 sm:left-8"
        aria-label="Xem đội ngũ huấn luyện viên"
      >
        <span className="flex -space-x-3">
          {COACHES.map((c) => (
            <span
              key={c.id}
              className="block h-10 w-10 overflow-hidden rounded-full border-2 border-[var(--fx-ink)] grayscale transition-all duration-300 group-hover:border-[var(--fx-orange)]/80 group-hover:grayscale-0"
            >
              <img src={c.photo} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
            </span>
          ))}
        </span>
        <span className="text-left text-[11px] font-semibold uppercase tracking-widest text-white/60 transition-colors group-hover:text-white/95">
          Đội ngũ HLV
          <span className="block text-[10px] font-normal normal-case tracking-normal text-white/40">
            Nhấn để gặp gũi 4 huấn luyện viên trưởng
          </span>
        </span>
      </motion.button>

      {/* ── Nút âm thanh reel ── */}
      <div className="fx-sound-btn">
        <button
          onClick={toggleSound}
          aria-label={soundOn ? "Tắt âm thanh reel" : "Bật âm thanh reel"}
          className="relative flex h-11 items-center gap-2 rounded-full border border-white/20 bg-black/55 px-4 text-[11px] font-semibold uppercase tracking-widest text-white/85 backdrop-blur-md transition-all hover:border-[var(--fx-orange)]/70 hover:text-white"
        >
          {!soundOn && <span className="fx-ring" aria-hidden="true" />}
          {soundOn ? (
            <Volume2 className="h-4 w-4 text-[var(--fx-orange)]" aria-hidden="true" />
          ) : (
            <VolumeX className="h-4 w-4" aria-hidden="true" />
          )}
          {soundOn ? "Đang phát" : "Bật âm"}
        </button>
      </div>
    </section>
  );
}
