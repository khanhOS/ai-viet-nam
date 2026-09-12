// KhanhOS AI — Success burst: dấu tích vẽ SVG (pathLength) + halo + hạt bay.
// Dùng trong panel thành công của auth modal — không dùng chữ "demo"/"token".

"use client";

import { motion } from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Dấu tích vẽ itself: vòng ngoài quét -> nét tích vẽ ngay sau. */
export function AnimatedCheck({ size = 64 }: { size?: number }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      initial="hidden"
      animate="show"
      aria-hidden
    >
      {/* Vòng ngoài quét qua (pathLength 0 -> 1) */}
      <motion.circle
        cx="32"
        cy="32"
        r="24"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          show: {
            pathLength: 1,
            opacity: 1,
            transition: { duration: 0.5, ease: EASE },
          },
        }}
      />
      {/* Nét tích */}
      <motion.path
        d="M20 33.5 L28.5 42 L44 25"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={{
          hidden: { pathLength: 0 },
          show: {
            pathLength: 1,
            transition: { delay: 0.26, duration: 0.36, ease: EASE },
          },
        }}
      />
    </motion.svg>
  );
}

/** Sự bùng nổ: halo lan + 8 hạt bay toả quanh dấu tích. */
export function SuccessBurst() {
  const dots = [
    { x: -50, y: -32 },
    { x: 46, y: -38 },
    { x: -38, y: 28 },
    { x: 42, y: 32 },
    { x: 0, y: -54 },
    { x: 58, y: 2 },
    { x: -58, y: 2 },
    { x: 6, y: 50 },
  ];
  return (
    <div className="relative flex items-center justify-center text-primary">
      {/* Halo lan toả */}
      <motion.span
        className="absolute rounded-full bg-primary/20"
        initial={{ width: 12, height: 12, opacity: 0 }}
        animate={{ width: 128, height: 128, opacity: [0, 0.8, 0] }}
        transition={{ delay: 0.18, duration: 0.85, ease: "easeOut" }}
      />
      {/* Vòng nhịp mảnh */}
      <motion.span
        className="absolute rounded-full border border-primary/35"
        initial={{ width: 40, height: 40, opacity: 0 }}
        animate={{ width: 96, height: 96, opacity: [0, 0.9, 0] }}
        transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
      />
      {/* Hạt toả ra */}
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full bg-primary"
          initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
          animate={{ x: d.x, y: d.y, scale: [0, 1.25, 0.5], opacity: [0, 1, 0] }}
          transition={{ delay: 0.3 + i * 0.028, duration: 0.55, ease: EASE }}
        />
      ))}
      <AnimatedCheck size={64} />
    </div>
  );
}
