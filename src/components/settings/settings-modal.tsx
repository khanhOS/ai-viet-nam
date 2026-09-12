// KhanhOS AI — Settings modal: model mặc định, web search, reduced motion pref

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useUIStore } from "@/store/use-ui-store";
import { useAuthStore } from "@/store/use-auth-store";
import { useChatStore } from "@/store/use-chat-store";
import { useToast } from "@/hooks/use-toast";
import type { UserSettings } from "@/types/chat";
import { Globe, Sparkles, Wand2, Info, Sun, Moon, Monitor, Cpu, CheckCircle2, CircleOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface RuntimeStatusInfo {
  available: boolean;
  runtime: string | null;
  defaultModel: string | null;
  error: string | null;
}

export function SettingsModal() {
  const open = useUIStore((s) => s.settingsModalOpen);
  const setOpen = useUIStore((s) => s.setSettingsModalOpen);
  const user = useAuthStore((s) => s.user);
  const models = useChatStore((s) => s.models);
  const { toast } = useToast();
  const { setTheme } = useTheme();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [runtime, setRuntime] = useState<RuntimeStatusInfo | null>(null);

  // Load settings khi mở
  useEffect(() => {
    if (open && user) {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((d) => setSettings(d?.settings ?? null))
        .catch(() => setSettings(null));
      fetch("/api/models")
        .then((r) => r.json())
        .then((d) => setRuntime(d?.runtime ?? null))
        .catch(() => setRuntime(null));
    }
  }, [open, user]);

  const patch = async (partial: Partial<UserSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...partial };
    setSettings(next);
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (!res.ok) {
        const d = await res.json();
        toast({ title: "Không lưu được cài đặt", description: d?.error, variant: "destructive" });
        return;
      }
      // Sync trạng thái chat store
      if (partial.defaultModelId) {
        useChatStore.getState().setSelectedModelId(partial.defaultModelId);
      }
      if (partial.webSearchEnabled !== undefined) {
        useChatStore.getState().setWebSearchEnabled(partial.webSearchEnabled);
      }
      if (partial.theme) {
        setTheme(partial.theme);
      }
    } catch {
      toast({ title: "Lỗi kết nối khi lưu cài đặt", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const availableModels = models.filter((m) => m.available);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="kh-glass-strong max-w-[420px] max-h-[85dvh] overflow-y-auto rounded-2xl border-foreground/10 p-0">
        <div className="px-6 pb-6 pt-5">
          <DialogHeader className="pb-4 text-left">
            <DialogTitle className="font-display text-lg font-semibold tracking-tight">
              Cài đặt
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              Tuỳ chọn trải nghiệm KhanhOS AI của bạn.
            </DialogDescription>
          </DialogHeader>

          {!user ? (
            <div className="rounded-xl border border-foreground/10 bg-foreground/4 px-4 py-6 text-center text-sm text-muted-foreground">
              Đăng nhập để lưu cài đặt của bạn.
            </div>
          ) : !settings ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-foreground/4" />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Giao diện (dark/light) */}
              <div className="rounded-xl border border-foreground/8 bg-foreground/4 p-4">
                <div className="flex items-center gap-2 pb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Giao diện</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { value: "dark", label: "Tối", icon: Moon },
                    { value: "light", label: "Sáng", icon: Sun },
                    { value: "system", label: "Hệ thống", icon: Monitor },
                  ] as const).map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => patch({ theme: value })}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg py-2.5 text-xs font-medium transition-all",
                        (settings.theme ?? "system") === value
                          ? "border border-primary/30 bg-primary/10 text-primary"
                          : "border border-transparent text-muted-foreground hover:bg-foreground/5"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model mặc định */}
              <div className="rounded-xl border border-foreground/8 bg-foreground/4 p-4">
                <div className="flex items-center gap-2 pb-1">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Model mặc định</span>
                </div>
                <p className="pb-3 text-xs text-muted-foreground">
                  Model dùng khi bắt đầu cuộc trò chuyện mới.
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {availableModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => patch({ defaultModelId: model.id })}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-all",
                        settings.defaultModelId === model.id
                          ? "border border-primary/30 bg-primary/10 text-foreground"
                          : "border border-transparent text-foreground/70 hover:bg-foreground/5"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {model.name}
                        {model.badge && (
                          <span className="rounded-full bg-primary/15 border border-primary/25 px-1.5 py-px text-[10px] text-primary">
                            {model.badge}
                          </span>
                        )}
                      </span>
                      {settings.defaultModelId === model.id && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="h-2 w-2 rounded-full bg-primary"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trạng thái hệ AI cục bộ (sự thật — không fake) */}
              <div className="rounded-xl border border-foreground/8 bg-foreground/4 p-4">
                <div className="flex items-center gap-2 pb-1">
                  <Cpu className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Hệ AI cục bộ</span>
                </div>
                {runtime === null ? (
                  <p className="pt-1 text-xs text-muted-foreground">Đang kiểm tra runtime…</p>
                ) : runtime.available ? (
                  <div className="space-y-1 pt-1 text-xs">
                    <p className="flex items-center gap-1.5 text-foreground/80">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      Model AI thật đang chạy: <span className="font-medium">{runtime.defaultModel ?? "—"}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Runtime: {runtime.runtime === "ollama" ? "Ollama (cục bộ)" : runtime.runtime} — không gọi API ngoài.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 pt-1 text-xs">
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <CircleOff className="h-3.5 w-3.5" />
                      Chưa có model AI cục bộ — đang dùng bộ máy tri thức local.
                    </p>
                    <p className="text-muted-foreground/70">
                      Chạy <code className="rounded bg-foreground/8 px-1 py-px text-[10px]">bash scripts/setup-ollama.sh</code> trên máy chủ để bật model thật.
                    </p>
                  </div>
                )}
              </div>

              {/* Web search mặc định */}
              <div className="flex items-center justify-between rounded-xl border border-foreground/8 bg-foreground/4 p-4">
                <div className="pr-4">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Tự động tìm kiếm web</span>
                  </div>
                  <p className="pt-0.5 text-xs text-muted-foreground">
                    Bật mặc định khi gửi tin nhắn mới.
                  </p>
                </div>
                <Switch
                  checked={settings.webSearchEnabled}
                  onCheckedChange={(v) => patch({ webSearchEnabled: v })}
                  aria-label="Bật tìm kiếm web mặc định"
                />
              </div>

              {/* Motion preference */}
              <div className="rounded-xl border border-foreground/8 bg-foreground/4 p-4">
                <div className="flex items-center gap-2 pb-3">
                  <Wand2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Hiệu ứng chuyển động</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["system", "on", "off"] as const).map((pref) => (
                    <button
                      key={pref}
                      onClick={() => patch({ reducedMotionPref: pref })}
                      className={cn(
                        "rounded-lg py-2 text-xs font-medium transition-all",
                        settings.reducedMotionPref === pref
                          ? "border border-primary/30 bg-primary/10 text-primary"
                          : "border border-transparent text-muted-foreground hover:bg-foreground/5"
                      )}
                    >
                      {pref === "system" ? "Hệ thống" : pref === "on" ? "Giảm" : "Đầy đủ"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground/70">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  “Giảm” áp dụng khi hệ điều hành bật prefers-reduced-motion.
                </p>
              </div>

              {/* Trạng thái lưu */}
              <p className="text-right text-[11px] text-muted-foreground/60">
                {saving ? "Đang lưu…" : "Tự động lưu"}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
