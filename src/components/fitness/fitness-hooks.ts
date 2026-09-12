// Iron Forge — hooks dùng chung

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Mounted gate hydration-safe (useSyncExternalStore):
 * server/hydration-render → false; sau mount trên client → true.
 * Dùng để chỉ render portal/fixed-layer sau khi hydrate xong (tránh mismatch).
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/**
 * Scroll reveal: quan sát mọi phần tử `.fx-reveal` bên trong node được gắn ref.
 * Khi vào viewport → thêm class `fx-in` (fade + upward translate, stagger qua --fx-d).
 * Trả về callback ref để gắn vào <section ref={...}>.
 */
export function useSectionReveal<T extends HTMLElement = HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);

  useEffect(() => {
    if (!node) return;
    const targets = Array.from(node.querySelectorAll<HTMLElement>(".fx-reveal"));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach((t) => t.classList.add("fx-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("fx-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [node]);

  return setNode;
}

/**
 * Theo dõi 1 phần tử có đang nằm trong viewport hay không (IntersectionObserver).
 */
export function useInView<T extends HTMLElement = HTMLElement>(threshold = 0) {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setInView(e.isIntersecting);
      },
      { threshold }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node, threshold]);

  return { ref: setNode, inView };
}
