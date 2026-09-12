// KhanhOS AI — Message bubble (user & assistant)
// Assistant: markdown + code + copy + regenerate + sources web search

"use client";

import { memo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Check, Copy, RefreshCw, Globe, FileText, Sparkles, Loader2, ThumbsUp, ThumbsDown } from "lucide-react";
import { MarkdownContent } from "./markdown-content";
import { useChatStore } from "@/store/use-chat-store";
import type { ChatMessage } from "@/types/chat";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex justify-end px-4"
    >
      <div className="max-w-[85%] md:max-w-[70%]">
        {/* File đính kèm */}
        {message.attachments?.length ? (
          <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
            {message.attachments.map((att, i) => (
              <span
                key={i}
                className="inline-flex max-w-[200px] items-center gap-1.5 rounded-lg border border-foreground/10 bg-foreground/5 px-2 py-1 text-xs text-muted-foreground"
                title={att.name}
              >
                <FileText className="h-3 w-3 shrink-0 text-primary/70" />
                <span className="truncate">{att.name}</span>
              </span>
            ))}
          </div>
        ) : null}

        <div className="rounded-2xl rounded-br-md border border-primary/20 bg-primary/10 px-4 py-3 text-[15px] leading-relaxed text-foreground/95 whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    </motion.div>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const [rated, setRated] = useState<"up" | "down" | null>(null);
  const [ratingInFlight, setRatingInFlight] = useState(false);
  const regenerate = useChatStore((s) => s.regenerate);
  const streaming = useChatStore((s) => s.streaming);
  // id bền vững (không phải id tạm "assistant-*") mới đánh giá được
  const canRate = !message.streaming && !message.id.startsWith("assistant-");

  const sendFeedback = useCallback(
    async (rating: "up" | "down") => {
      if (rated || ratingInFlight || !canRate) return;
      setRatingInFlight(true);
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: message.id, rating }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok) {
          setRated(rating);
          toast({
            title: rating === "up" ? "Đã ghi nhận đánh giá tốt" : "Đã ghi nhận đánh giá",
            description:
              rating === "up"
                ? "Câu trả lời này sẽ góp vào tập dữ liệu huấn luyện (khi owner chạy fine-tune)."
                : "Cảm ơn phản hồi — AI sẽ được cải thiện qua các lần huấn luyện sau.",
          });
        } else {
          toast({ title: "Không gửi được đánh giá", description: data?.error ?? "Thử lại sau", variant: "destructive" });
        }
      } catch {
        toast({ title: "Không gửi được đánh giá", variant: "destructive" });
      } finally {
        setRatingInFlight(false);
      }
    },
    [rated, ratingInFlight, canRate, message.id]
  );

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }, [message.content]);

  const isLast =
    useChatStore((s) => s.messages[s.messages.length - 1]?.id === message.id) ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="group px-4"
    >
      <div className="flex gap-3.5">
        {/* Avatar orb mini */}
        <div className="relative mt-0.5 shrink-0">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-primary/10",
              message.streaming && "kh-anim-pulse-glow"
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          {message.streaming && (
            <span className="absolute -inset-1 rounded-full border border-primary/20 animate-ping [animation-duration:2s]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Nguồn web search */}
          {message.sources?.length ? (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {message.sources.slice(0, 5).map((src, i) => (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={src.snippet}
                  className="inline-flex max-w-[240px] items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/4 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                >
                  <Globe className="h-3 w-3 shrink-0" />
                  <span className="truncate">{src.title}</span>
                </a>
              ))}
            </div>
          ) : null}

          {/* Status pipeline THẬT — hiển thị khi đang stream (trước/trong khi có text) */}
          {message.streaming && message.status ? (
            <div className="mb-1.5 inline-flex items-center gap-2 text-xs text-primary/80">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{message.status}</span>
            </div>
          ) : null}

          {/* Nội dung markdown */}
          <div
            className={cn(
              "text-[15px] text-foreground/92",
              message.streaming && "kh-stream-cursor"
            )}
          >
            {message.content ? (
              <MarkdownContent content={message.content} />
            ) : !message.status ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground/60">
                <ThinkingDots />
              </span>
            ) : null}
          </div>

          {/* Footer meta model cục bộ — chỉ khi đã xong, không stream */}
          {!message.streaming && message.meta?.source === "local-model" ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground/60">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary/60" />
                {message.meta.model ?? "model cục bộ"}
              </span>
              {message.meta.metrics?.totalMs ? (
                <span>· {(message.meta.metrics.totalMs / 1000).toFixed(1)}s</span>
              ) : null}
              {message.meta.metrics?.tokensPerSecond ? (
                <span>· sinh {message.meta.metrics.tokensPerSecond}/giây</span>
              ) : null}
              {message.meta.verification?.passed ? (
                <span className="inline-flex items-center gap-0.5 text-primary/70">
                  · <Check className="h-3 w-3" /> đã kiểm tra
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Actions: copy + regenerate */}
          {!message.streaming && message.content && (
            <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
              <button
                onClick={copy}
                aria-label="Copy phản hồi"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-primary" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Đã copy" : "Copy"}
              </button>
              {isLast && (
                <button
                  onClick={() => regenerate()}
                  disabled={streaming}
                  aria-label="Tạo lại phản hồi"
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground disabled:opacity-40"
                >
                  <RefreshCw className="h-3 w-3" />
                  Tạo lại
                </button>
              )}

              {/* Đánh giá phản hồi — dữ liệu huấn luyện thật (AiFeedback) */}
              {canRate && (
                <>
                  <span className="mx-0.5 h-3 w-px bg-foreground/10" />
                  <button
                    onClick={() => sendFeedback("up")}
                    disabled={!!rated || ratingInFlight}
                    aria-label="Phản hồi tốt"
                    title={rated === "up" ? "Đã đánh giá tốt" : "Đánh giá tốt — góp vào dataset huấn luyện"}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors",
                      rated === "up"
                        ? "text-primary"
                        : "text-muted-foreground hover:bg-foreground/6 hover:text-foreground"
                    )}
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => sendFeedback("down")}
                    disabled={!!rated || ratingInFlight}
                    aria-label="Phản hồi chưa tốt"
                    title={rated === "down" ? "Đã đánh giá chưa tốt" : "Đánh giá chưa tốt"}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors",
                      rated === "down"
                        ? "text-red-400"
                        : "text-muted-foreground hover:bg-foreground/6 hover:text-foreground"
                    )}
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1.5">
      <motion.span
        className="h-1.5 w-1.5 rounded-full bg-primary/70"
        animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
      />
      <motion.span
        className="h-1.5 w-1.5 rounded-full bg-primary/70"
        animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0.15 }}
      />
      <motion.span
        className="h-1.5 w-1.5 rounded-full bg-primary/70"
        animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }}
      />
      <span className="ml-1.5 text-xs text-muted-foreground/60">Đang suy nghĩ…</span>
    </span>
  );
}

export const MessageBubble = memo(function MessageBubble({
  message,
}: {
  message: ChatMessage;
}) {
  return message.role === "user" ? (
    <UserMessage message={message} />
  ) : (
    <AssistantMessage message={message} />
  );
});
