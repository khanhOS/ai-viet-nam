// KhanhOS AI — ThemeSync (client)
// Cầu nối giữa zustand store (không dùng được hook) và next-themes:
// store dispatch event "kh:apply-theme" → component này gọi setTheme thật.

"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

export function ThemeSync() {
  const { setTheme } = useTheme();

  useEffect(() => {
    const handler = (e: Event) => {
      const theme = (e as CustomEvent<string>).detail;
      if (theme === "dark" || theme === "light" || theme === "system") {
        setTheme(theme);
      }
    };
    window.addEventListener("kh:apply-theme", handler);
    return () => window.removeEventListener("kh:apply-theme", handler);
  }, [setTheme]);

  return null;
}
