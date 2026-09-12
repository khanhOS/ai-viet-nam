// KhanhOS AI — Ambient background (aurora blobs + grid tinh tế)
// Cực nhẹ: chỉ 2 blob CSS + grid, dùng animation CSS thuần.
// Theme-aware:aura + vignette + grid tự đổi theo light/dark.

"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

export function BackgroundAura() {
  const { resolvedTheme } = useTheme();
  // SSR/first paint luôn render biến thể dark (tránh hydration mismatch);
  // sau mount mới áp theme thật — đổi style post-hydration là an toàn.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const light = mounted && resolvedTheme === "light";

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Lớp nền deepest */}
      <div className="absolute inset-0 bg-background" />

      {/* Aurora blob 1 — teal, góc trên trái */}
      <div
        className="kh-anim-aurora absolute -top-40 -left-32 w-[44rem] h-[44rem] rounded-full blur-3xl"
        style={{
          background: light
            ? "radial-gradient(circle at 50% 50%, oklch(0.75 0.09 175 / 22%) 0%, oklch(0.75 0.09 175 / 7%) 40%, transparent 70%)"
            : "radial-gradient(circle at 50% 50%, oklch(0.55 0.1 175 / 16%) 0%, oklch(0.55 0.1 175 / 5%) 40%, transparent 70%)",
          animationDelay: "0s",
        }}
      />

      {/* Aurora blob 2 — teal lạnh hơn, góc dưới phải */}
      <div
        className="kh-anim-aurora absolute -bottom-48 -right-32 w-[50rem] h-[50rem] rounded-full blur-3xl"
        style={{
          background: light
            ? "radial-gradient(circle at 50% 50%, oklch(0.8 0.08 195 / 18%) 0%, oklch(0.8 0.08 195 / 6%) 45%, transparent 72%)"
            : "radial-gradient(circle at 50% 50%, oklch(0.5 0.09 195 / 12%) 0%, oklch(0.5 0.09 195 / 4%) 45%, transparent 72%)",
          animationDelay: "-12s",
        }}
      />

      {/* Vignette — làm sâu tâm màn hình (light: sáng dần ra mép, giữ chiều sâu) */}
      <div
        className="absolute inset-0"
        style={{
          background: light
            ? "radial-gradient(ellipse 120% 90% at 50% 42%, transparent 55%, oklch(0.88 0.01 200 / 38%) 100%)"
            : "radial-gradient(ellipse 120% 90% at 50% 42%, transparent 55%, oklch(0.08 0.005 220 / 55%) 100%)",
        }}
      />

      {/* Grid mảnh cực nhẹ — chất "kỹ thuật" */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: light
            ? "linear-gradient(oklch(0.2 0.01 220 / 4%) 1px, transparent 1px), linear-gradient(90deg, oklch(0.2 0.01 220 / 4%) 1px, transparent 1px)"
            : "linear-gradient(oklch(1 0 0 / 1.5%) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 1.5%) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 75%)",
        }}
      />
    </div>
  );
}
