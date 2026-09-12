// KhanhOS AI — Model selector panel (dữ liệu từ ModelRegistry qua /api/models)
// KHÔNG hard-code model trong UI.

"use client";

import { motion } from "framer-motion";
import { Check, ChevronLeft, Sparkles, Zap, Code2, Globe } from "lucide-react";
import { useChatStore } from "@/store/use-chat-store";
import type { PublicModel } from "@/types/chat";
import { cn } from "@/lib/utils";

function modelIcon(model: PublicModel) {
  if (model.id.includes("code") || model.capabilities.code && model.badge === "Code")
    return <Code2 className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
}

export function ModelSelectorPanel({ onBack }: { onBack?: () => void }) {
  const models = useChatStore((s) => s.models);
  const selectedModelId = useChatStore((s) => s.selectedModelId);
  const setSelectedModelId = useChatStore((s) => s.setSelectedModelId);

  const available = models.filter((m) => m.available);
  const unavailable = models.filter((m) => !m.available);

  return (
    <motion.div
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 14 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="w-[290px] max-h-[340px] overflow-y-auto"
    >
      <div className="flex items-center gap-2 px-2 pb-2 pt-1">
        {onBack && (
          <button
            onClick={onBack}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
            aria-label="Quay lại"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Chọn model
        </span>
      </div>

      <div className="space-y-1">
        {available.map((model) => {
          const selected = model.id === selectedModelId;
          return (
            <button
              key={model.id}
              onClick={() => setSelectedModelId(model.id)}
              className={cn(
                "group w-full rounded-xl px-3 py-2.5 text-left transition-all duration-200",
                selected
                  ? "bg-primary/12 border border-primary/30"
                  : "border border-transparent hover:bg-foreground/5 hover:border-foreground/10"
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                    selected
                      ? "bg-primary/20 text-primary"
                      : "bg-foreground/5 text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  {modelIcon(model)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">
                      {model.name}
                    </span>
                    {model.badge && (
                      <span className="shrink-0 rounded-full bg-primary/15 border border-primary/25 px-1.5 py-px text-[10px] font-medium text-primary">
                        {model.badge}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground mt-0.5">
                    {model.description}
                  </p>
                </div>
                {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </div>
            </button>
          );
        })}

        {unavailable.length > 0 && (
          <div className="pt-2">
            <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Không khả dụng bây giờ
            </p>
            {unavailable.map((model) => (
              <div
                key={model.id}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 opacity-45 cursor-not-allowed"
                title={model.description}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground/5 text-muted-foreground">
                  {modelIcon(model)}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground/70">{model.name}</div>
                  <p className="truncate text-xs text-muted-foreground/70">{model.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
