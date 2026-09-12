// KhanhOS AI — Chat Composer
// Rounded, glass, focus glow. Ô nhập + nút "+" + nút gửi.
// Dùng ở cả Home và Chat view.
// (File đính kèm + web search đã gỡ — engine cục bộ không đọc file / internet.)

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Square } from "lucide-react";
import { useChatStore } from "@/store/use-chat-store";
import { useAuthStore } from "@/store/use-auth-store";
import { PlusMenu } from "./plus-menu";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  placeholder?: string;
  autoFocus?: boolean;
}

export function ChatComposer({ placeholder = "Bạn muốn làm gì hôm nay?", autoFocus }: ChatComposerProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const streaming = useChatStore((s) => s.streaming);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopGeneration = useChatStore((s) => s.stopGeneration);
  const selectedModelId = useChatStore((s) => s.selectedModelId);
  const models = useChatStore((s) => s.models);
  const user = useAuthStore((s) => s.user);

  const modelName = models.find((m) => m.id === selectedModelId)?.name;

  // Auto-resize textarea
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(resize, [value, resize]);

  // Focus composer sau khi login (pending message flow)
  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  // Nghe sự kiện "Bắt đầu trò chuyện" từ landing CTA → focus + scroll tới composer
  useEffect(() => {
    const onFocusRequest = () => {
      textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      requestAnimationFrame(() => textareaRef.current?.focus());
    };
    window.addEventListener("kh:focus-composer", onFocusRequest);
    return () => window.removeEventListener("kh:focus-composer", onFocusRequest);
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || streaming) return;
    // sendMessage tự mở login modal nếu chưa đăng nhập
    sendMessage(trimmed);
    setValue("");
    requestAnimationFrame(resize);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = value.trim().length > 0 && !streaming;

  return (
    <div className="w-full">
      {/* Chips trạng thái: model đang chọn */}
      <AnimatePresence>
        {modelName && modelName !== "KhanhOS Core" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="mb-2 flex flex-wrap items-center gap-1.5 px-1"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/5 px-2.5 py-1 text-xs text-muted-foreground">
              {modelName}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer chính */}
      <motion.div
        animate={{
          boxShadow: focused
            ? "0 0 0 1px color-mix(in srgb, var(--primary) 35%, transparent), 0 0 28px color-mix(in srgb, var(--primary) 14%, transparent), 0 12px 40px oklch(0 0 0 / 18%)"
            : "0 0 0 1px oklch(0 0 0 / 0%), 0 8px 32px oklch(0 0 0 / 14%)",
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={cn(
          "kh-glass relative rounded-[1.4rem] transition-colors duration-300",
          focused ? "border-primary/30" : "hover:border-foreground/14"
        )}
      >
        {/* Hàng input chính */}
        <div className="flex items-end gap-2 p-2.5">
          <PlusMenu />

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            rows={1}
            aria-label="Nhập tin nhắn"
            className="max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />

          {streaming ? (
            <motion.button
              type="button"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.92 }}
              onClick={stopGeneration}
              aria-label="Dừng tạo phản hồi"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive border border-destructive/30 transition-colors hover:bg-destructive/25"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={submit}
              disabled={!canSend}
              aria-label="Gửi tin nhắn"
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                canSend
                  ? "bg-primary text-primary-foreground kh-glow-sm hover:brightness-110"
                  : "cursor-not-allowed bg-foreground/6 text-muted-foreground/40"
              )}
            >
              <ArrowUp className="h-4.5 w-4.5" strokeWidth={2.5} />
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Ghi chú nhỏ dưới composer */}
      <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/50">
        <span>
          {user
            ? "Enter để gửi • Shift+Enter xuống dòng"
            : "Đăng nhập để trò chuyện cùng AI"}
        </span>
      </div>
    </div>
  );
}
