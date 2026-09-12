// KhanhOS AI — AI Orb visual (Canvas 2D)
// Thiết kế: "plasma core" KhanhOS — lõi phát sáng + các vành đai hạt elip
// quay lệch pha tạo chiều sâu 3D. Floating + parallax theo chuột (có trọng lượng).
// Hiệu năng: ~48 hạt, DPR cap 2, pause khi tab ẩn / ngoài viewport, ~45fps.

"use client";

import { useEffect, useRef } from "react";
import { useMouseParallax, usePrefersReducedMotion } from "@/hooks/use-mouse-parallax";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";

interface OrbProps {
  size?: number;
  className?: string;
  /** Tăng cường độ parallax (home lớn, chat nhỏ) */
  parallaxStrength?: number;
  /** Chế độ thu nhỏ (khi đang chat, hiển thị mini) */
  mini?: boolean;
}

interface Particle {
  ring: number;
  angle: number;
  speed: number;
  size: number;
  depth: number;
  twinkle: number;
}

const TEAL_DARK = { h: 172, s: 78, l: 62 };
const TEAL_LIGHT = { h: 172, s: 80, l: 46 };
const RING_CONFIG = [
  { rx: 0.92, ry: 0.34, tilt: -0.32, speed: 0.55, count: 18, size: 1.6 },
  { rx: 1.15, ry: 0.44, tilt: 0.42, speed: -0.38, count: 14, size: 1.2 },
  { rx: 0.68, ry: 0.24, tilt: 0.1, speed: 0.8, count: 10, size: 1.9 },
];

export function AIOrb({ size = 340, className, parallaxStrength = 1, mini = false }: OrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { value: parallax, ref: parallaxRef } = useMouseParallax(parallaxStrength);
  const reducedMotion = usePrefersReducedMotion();
  // Light mode: teal đậm hơn để giữ độ tương phản trên nền sáng
  const { resolvedTheme } = useTheme();
  const lightMode = resolvedTheme === "light";
  const TEAL = lightMode ? TEAL_LIGHT : TEAL_DARK;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    // Sinh hạt một lần — cố định, không tạo lại
    const particles: Particle[] = [];
    RING_CONFIG.forEach((ring, ri) => {
      for (let i = 0; i < ring.count; i++) {
        particles.push({
          ring: ri,
          angle: (i / ring.count) * Math.PI * 2 + Math.random() * 0.35,
          speed: ring.speed * (0.012 + Math.random() * 0.007),
          size: ring.size * (0.7 + Math.random() * 0.6),
          depth: Math.random(),
          twinkle: Math.random() * Math.PI * 2,
        });
      }
    });

    let raf = 0;
    let running = true;
    let visible = true;
    let lastTime = 0;
    const cx = size / 2;
    const cy = size / 2;
    const coreR = size * 0.19;

    const draw = (time: number) => {
      if (!running) return;
      // Pause khi tab ẩn hoặc orb ngoài viewport
      if (!visible || document.hidden) {
        raf = requestAnimationFrame(draw);
        return;
      }
      // Giới hạn ~45fps cho canvas (đủ mượt, nhẹ CPU)
      if (time - lastTime < 22) {
        raf = requestAnimationFrame(draw);
        return;
      }
      lastTime = time;
      const t = time * 0.001;

      // Đọc parallax từ ref (cập nhật mỗi frame bởi hook, không re-render)
      const mx = reducedMotion ? 0 : parallaxRef.current.x * 14;
      const my = reducedMotion ? 0 : parallaxRef.current.y * 10;
      const floatY = reducedMotion ? 0 : Math.sin(t * 0.7) * 7;
      const floatX = reducedMotion ? 0 : Math.cos(t * 0.45) * 4;

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(cx + mx + floatX, cy + my + floatY);

      // ── 1. Halo ngoài (hơi thở chậm) ──────────
      const breathe = 1 + (reducedMotion ? 0 : Math.sin(t * 0.5) * 0.04);
      const haloR = size * 0.3 * breathe;
      const halo = ctx.createRadialGradient(0, 0, coreR * 0.6, 0, 0, haloR);
      halo.addColorStop(0, `hsla(${TEAL.h}, ${TEAL.s}%, ${TEAL.l}%, 0.22)`);
      halo.addColorStop(0.6, `hsla(${TEAL.h}, ${TEAL.s}%, ${TEAL.l}%, 0.07)`);
      halo.addColorStop(1, `hsla(${TEAL.h}, ${TEAL.s}%, ${TEAL.l}%, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, haloR, 0, Math.PI * 2);
      ctx.fill();

      // ── 2. Lõi plasma ──────────────────────────
      const core = ctx.createRadialGradient(-coreR * 0.25, -coreR * 0.3, coreR * 0.1, 0, 0, coreR);
      core.addColorStop(0, lightMode ? "hsla(165, 80%, 88%, 0.95)" : "hsla(165, 90%, 92%, 0.98)");
      core.addColorStop(0.35, `hsla(${TEAL.h}, ${TEAL.s}%, ${TEAL.l + 8}%, 0.92)`);
      core.addColorStop(0.75, `hsla(${TEAL.h}, ${TEAL.s}%, ${TEAL.l - 14}%, 0.55)`);
      core.addColorStop(1, `hsla(${TEAL.h}, ${TEAL.s}%, ${TEAL.l - 20}%, 0.05)`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 0, coreR * breathe, 0, Math.PI * 2);
      ctx.fill();

      // Lõi inner spark
      if (!mini) {
        const spark = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 0.4);
        spark.addColorStop(0, lightMode ? "hsla(160, 90%, 92%, 0.85)" : "hsla(160, 100%, 97%, 0.9)");
        spark.addColorStop(1, "hsla(170, 95%, 85%, 0)");
        ctx.fillStyle = spark;
        ctx.beginPath();
        ctx.arc(0, 0, coreR * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── 3. Vành đai hạt (chiều sâu 3D) ────────
      for (const p of particles) {
        if (!reducedMotion) p.angle += p.speed;

        const ring = RING_CONFIG[p.ring];
        const ex = Math.cos(p.angle) * ring.rx * size * 0.31;
        const ey = Math.sin(p.angle) * ring.ry * size * 0.31;
        const tiltedY = ey * Math.cos(ring.tilt) + Math.abs(ex) * Math.sin(ring.tilt) * 0.22;

        // "z" ảo: sin âm = phía sau lõi → nhỏ hơn, mờ hơn
        const behind = Math.sin(p.angle) < 0;
        const scale = behind ? 0.45 : 0.85 + p.depth * 0.4;
        const alpha = behind ? 0.14 : 0.35 + p.depth * 0.45;
        const tw = 0.75 + 0.25 * Math.sin(t * 1.6 + p.twinkle);

        const r = p.size * scale;
        ctx.beginPath();
        ctx.arc(ex, tiltedY, r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${TEAL.h}, ${TEAL.s}%, ${TEAL.l + 12}%, ${alpha * tw})`;
        ctx.fill();

        // Glint cho hạt gần
        if (!behind && p.depth > 0.72 && !mini) {
          ctx.beginPath();
          ctx.arc(ex, tiltedY, r * 2.6, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${TEAL.h}, ${TEAL.s}%, ${TEAL.l}%, ${0.08 * tw})`;
          ctx.fill();
        }
      }

      // ── 4. Vòng quỹ đạo mảnh ──────────────────
      RING_CONFIG.forEach((ring, i) => {
        const rot = reducedMotion ? 0 : t * 0.06 * (i % 2 === 0 ? 1 : -1);
        ctx.save();
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, ring.rx * size * 0.31, ring.ry * size * 0.31, ring.tilt * 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${TEAL.h}, ${TEAL.s}%, ${TEAL.l}%, ${mini ? 0.08 : 0.13})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      });

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    // IntersectionObserver — pause khi không thấy
    const io = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting; },
      { threshold: 0.05 }
    );
    io.observe(canvas);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [size, mini, reducedMotion, parallaxRef, lightMode]);

  // Parallax dịch container (transform CSS mượt, GPU-accelerated)
  const translate = reducedMotion
    ? { x: 0, y: 0 }
    : { x: parallax.x * 18, y: parallax.y * 12 };

  return (
    <motion.div
      className={className}
      style={{ width: size, height: size }}
      animate={{ x: translate.x, y: translate.y }}
      transition={{ type: "spring", stiffness: 40, damping: 18, mass: 1.2 }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </motion.div>
  );
}
