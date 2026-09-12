// KhanhOS AI — Plus menu (mở từ nút "+" của composer)
// + → Model (chọn model — hiện chỉ có KhanhOS Core cục bộ)
// Glass, slide-fade, blur, hover effects. Click-outside để đóng.
// (Web search / file đính kèm đã gỡ: engine cục bộ không truy cập internet
//  và không đọc file — giữ UI thật thà, không hiển thị tính năng chết.)

"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, ChevronRight } from "lucide-react";
import { ModelSelectorPanel } from "./model-selector";
import { cn } from "@/lib/utils";

type Panel = "root" | "model";

export function PlusMenu() {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("root");
  const rootRef = useRef<HTMLDivElement>(null);

  // Click outside → đóng
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPanel("root");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPanel("root");
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setPanel("root");
  };

  return (
    <div ref={rootRef} className="relative">
      {/* Nút + */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => {
          setOpen(!open);
          setPanel("root");
        }}
        aria-label="Chọn model AI"
        aria-expanded={open}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200",
          open
            ? "bg-primary/15 text-primary border border-primary/30 kh-glow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-foreground/6 border border-foreground/8"
        )}
      >
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </motion.span>
      </motion.button>

      {/* Menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="kh-glass-strong absolute bottom-[calc(100%+10px)] left-0 z-50 rounded-2xl p-2 shadow-2xl shadow-black/40"
            style={{ transformOrigin: "bottom left" }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {panel === "root" ? (
                <motion.div
                  key="root"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="w-[240px]"
                >
                  <p className="px-2 pb-1.5 pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                    Thêm
                  </p>
                  <div className="space-y-0.5">
                    <button
                      onClick={() => setPanel("model")}
                      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-foreground/6"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/5 text-muted-foreground transition-all group-hover:bg-primary/15 group-hover:text-primary">
                        <Brain className="h-4 w-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-foreground">Model</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          Bộ máy đang dùng
                        </span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <ModelSelectorPanel
                  key="model"
                  onBack={() => setPanel("root")}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
