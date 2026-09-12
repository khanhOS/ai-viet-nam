// KhanhOS AI — Effects Layer (hiệu ứng nền cho toàn app)
// 4 lớp hiệu ứng (tất cả pointer-events-none, aria-hidden):
//   1. Particle network canvas — hạt trôi + dây nối (chất "neural network"),
//      đẩy nhẹ khi chuột lại gần + dây nối chuột–hạt — tương tác thật.
//   2. Light beams — 4 tia sáng chéo bắn ngang màn hình (CSS, lệch pha).
//   3. Cursor spotlight — quầng sáng teal bám theo chuột (lerp mượt).
//   4. Grain film — nhiễu film cực nhẹ phủ toàn màn (chất "cinema").
//
// Hiệu năng: DPR cap 2, hạt ≤ 85, O(n²) link checks (~3.6k/frame — rẻ),
// pause khi tab ẩn, resize re-seed, prefers-reduced-motion → tắt toàn bộ.
// Theme-aware: đọc class html.light mỗi frame để đổi màu teal cho hợp nền.

"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-mouse-parallax";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
}

const BEAMS: Array<{
  top: string;
  width: string;
  dur: string;
  delay: string;
}> = [
  { top: "14%", width: "30vw", dur: "12s", delay: "0.5s" },
  { top: "32%", width: "22vw", dur: "16s", delay: "5s" },
  { top: "56%", width: "34vw", dur: "13s", delay: "9.5s" },
  { top: "78%", width: "18vw", dur: "19s", delay: "3.2s" },
];

export function EffectsLayer() {
  const reduced = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    const spot = spotRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Spotlight + tương tác hạt: mọi loại pointer đều đẩy hạt;
    // spotlight chỉ theo chuột/bút (không theo ngón tay chạm).
    let particles: Particle[] = [];
    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { tx: -9999, ty: -9999, x: -9999, y: -9999 };
    const LINK = 112; // khoảng cách nối hạt–hạt (px)
    const PUSH_R = 130; // bán kính hạt bị chuột đẩy (px)
    const CURSOR_LINK = 160; // bán kính nối chuột–hạt (px)

    const seed = () => {
      const count = Math.max(28, Math.min(85, Math.floor((w * h) / 17000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 16, // px/giây — trôi chậm
        vy: (Math.random() - 0.5) * 16,
        r: 0.8 + Math.random() * 1.3,
        a: 0.2 + Math.random() * 0.42,
      }));
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX;
      mouse.ty = e.clientY;
      if (spot && e.pointerType !== "touch") spot.style.opacity = "1";
    };
    const onLeave = () => {
      mouse.tx = -9999;
      mouse.ty = -9999;
      if (spot) spot.style.opacity = "0";
    };

    let last = performance.now();

    const frame = (now: number) => {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Màu theo theme (teal: sáng nền tối / đậm nền sáng)
      const light = document.documentElement.classList.contains("light");
      const dot = light ? "13, 148, 136" : "94, 234, 212";
      const linkA = light ? 0.13 : 0.2;
      const cursorA = light ? 0.15 : 0.23;

      // Chuột mượt (lerp)
      mouse.x += (mouse.tx - mouse.x) * 0.14;
      mouse.y += (mouse.ty - mouse.y) * 0.14;
      if (spot && mouse.tx > -9000) {
        spot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
      }

      ctx.clearRect(0, 0, w, h);

      // ── Cập nhật hạt ──
      for (const p of particles) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < PUSH_R * PUSH_R && d2 > 1) {
          const d = Math.sqrt(d2);
          const f = (1 - d / PUSH_R) * 30; // lực đẩy ra
          p.vx += (dx / d) * f * dt;
          p.vy += (dy / d) * f * dt;
        }
        p.vx *= 0.996; // damping — không bay nhanh dần vô hạn
        p.vy *= 0.996;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -24) p.x = w + 24;
        else if (p.x > w + 24) p.x = -24;
        if (p.y < -24) p.y = h + 24;
        else if (p.y > h + 24) p.y = -24;
      }

      // ── Dây nối hạt–hạt ──
      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const o = (1 - Math.sqrt(d2) / LINK) * linkA;
            ctx.strokeStyle = `rgba(${dot}, ${o.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // ── Hạt ──
      for (const p of particles) {
        ctx.fillStyle = `rgba(${dot}, ${p.a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Dây nối chuột–hạt gần ──
      if (mouse.tx > -9000) {
        for (const p of particles) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < CURSOR_LINK * CURSOR_LINK) {
            const o = (1 - Math.sqrt(d2) / CURSOR_LINK) * cursorA;
            ctx.strokeStyle = `rgba(${dot}, ${o.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(frame);
    };

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    resize();
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduced]);

  if (reduced) return null;

  return (
    <>
      {/* Particle network + tia sáng — dưới nội dung */}
      <div
        className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
        {BEAMS.map((b, i) => (
          <div
            key={i}
            className="kh-beam"
            style={
              {
                top: b.top,
                width: b.width,
                "--kh-beam-dur": b.dur,
                "--kh-beam-delay": b.delay,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* Spotlight bám chuột — trên nội dung, rất nhẹ */}
      <div ref={spotRef} className="kh-spotlight" aria-hidden="true" />

      {/* Grain film — phủ toàn màn, cực nhẹ */}
      <div className="kh-grain" aria-hidden="true" />
    </>
  );
}
