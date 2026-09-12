// KhanhOS AI — Chat view: danh sách tin nhắn + composer dưới
// HOME → CHAT transition mượt bằng framer-motion (không reload trang).

"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useChatStore } from "@/store/use-chat-store";
import { MessageBubble } from "./message-bubble";
import { ChatComposer } from "@/components/composer/chat-composer";
import { AIOrb } from "@/components/app/ai-orb";

export function ChatView() {
  const messages = useChatStore((s) => s.messages);
  const streaming = useChatStore((s) => s.streaming);
  const error = useChatStore((s) => s.error);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // Auto scroll khi có message mới / đang stream — chỉ khi user đang ở đáy
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      stickToBottom.current = scrollHeight - scrollTop - clientHeight < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (stickToBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="flex h-full flex-col">
      {/* Vùng tin nhắn */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-1 py-6 space-y-6">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-4 flex items-center gap-2.5 rounded-xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive/90"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <div ref={bottomRef} className="h-2" />
        </div>
      </div>

      {/* Composer đáy */}
      <div className="shrink-0 border-t border-foreground/6 bg-background/40 backdrop-blur-xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-3xl px-4 pt-3">
          <ChatComposer placeholder="Nhập tin nhắn…" />
        </div>
      </div>
    </div>
  );
}
