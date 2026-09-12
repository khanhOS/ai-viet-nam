// KhanhOS AI — Mouse parallax hook
// Theo dõi chuột toàn màn hình → giá trị chuẩn hoá [-1, 1] có smoothing (lerp).
// Có "trọng lượng": object không bám cứng chuột.
// Tự tắt khi prefers-reduced-motion.
//
// Trả về:
//  - value: React state (throttle ~30fps) cho transform container
//  - ref:   mutable ref cập nhật mỗi frame cho canvas draw loop (không re-render)

"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export interface ParallaxPoint {
  x: number;
  y: number;
}

const REDUCED_MQ = "(prefers-reduced-motion: reduce)";

function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedSnapshot() {
  return window.matchMedia(REDUCED_MQ).matches;
}

/** Dò prefers-reduced-motion (reactive, hydration-safe). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, getReducedSnapshot, () => false);
}

export function useMouseParallax(strength = 1) {
  const [value, setValue] = useState<ParallaxPoint>({ x: 0, y: 0 });
  const ref = useRef<ParallaxPoint>({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduced = getReducedSnapshot();
    if (reduced) return; // giữ 0,0

    let lastEmit = 0;

    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const tick = (now: number) => {
      // Lerp — hệ số thấp = nhiều "trọng lượng", không bám cứng chuột
      current.current.x += (target.current.x - current.current.x) * 0.045;
      current.current.y += (target.current.y - current.current.y) * 0.045;

      ref.current.x = current.current.x * strength;
      ref.current.y = current.current.y * strength;

      // State cho React consumer — throttle để tiết kiệm re-render
      if (now - lastEmit > 33) {
        lastEmit = now;
        setValue({ x: ref.current.x, y: ref.current.y });
      }
      raf.current = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [strength]);

  return { value, ref };
}
