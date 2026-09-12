// KhanhOS AI — Account modal: thông tin tài khoản + sửa tên + đăng xuất

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useUIStore } from "@/store/use-ui-store";
import { useAuthStore } from "@/store/use-auth-store";
import { useChatStore } from "@/store/use-chat-store";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Mail, CalendarDays, Hash, Pencil, Check, X, Loader2, Crown, Sparkles, Database } from "lucide-react";
import { PLANS } from "@/lib/plans";

export function AccountModal() {
  const open = useUIStore((s) => s.accountModalOpen);
  const setOpen = useUIStore((s) => s.setAccountModalOpen);
  const setPlansModalOpen = useUIStore((s) => s.setPlansModalOpen);
  const setAdminModalOpen = useUIStore((s) => s.setAdminModalOpen);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  if (!user) return null;

  const startEdit = () => {
    setNameDraft(user.name);
    setEditing(true);
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === user.name) {
      setEditing(false);
      return;
    }
    if (trimmed.length < 1 || trimmed.length > 50) {
      toast({ title: "Tên hiển thị 1–50 ký tự", variant: "destructive" });
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Không lưu được", description: data?.error, variant: "destructive" });
        return;
      }
      setUser(data.user);
      setEditing(false);
      toast({ title: "Đã cập nhật tên hiển thị" });
    } catch {
      toast({ title: "Lỗi kết nối", variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  };

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(-2)
    .join("")
    .toUpperCase();

  const isOwner = user.role === "owner";

  const handleLogout = async () => {
    await logout();
    useChatStore.getState().reset();
    useChatStore.getState().loadConversations();
    setOpen(false);
    toast({ title: "Đã đăng xuất" });
  };

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("vi-VN", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="kh-glass-strong max-w-[380px] rounded-2xl border-foreground/10 p-0 overflow-hidden">
        {/* Avatar + tên */}
        <div className="relative px-6 pb-5 pt-7 text-center">
          <div
            className="absolute inset-x-0 -top-20 h-28 opacity-50"
            style={{
              background:
                "radial-gradient(ellipse 55% 100% at 50% 100%, oklch(0.78 0.13 172 / 30%), transparent)",
            }}
          />
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/25 to-primary/8 font-display text-xl font-bold text-primary kh-glow-sm"
          >
            {initials || "K"}
          </motion.div>
          <DialogHeader className="mt-3 space-y-0.5">
            {editing ? (
              <div className="mx-auto flex w-full max-w-[260px] items-center gap-1.5">
                <Input
                  autoFocus
                  value={nameDraft}
                  maxLength={50}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) saveName();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  className="h-9 rounded-xl border-foreground/10 bg-foreground/4 text-center text-sm focus-visible:border-primary/40"
                  aria-label="Tên hiển thị mới"
                />
                <button
                  onClick={saveName}
                  disabled={savingName}
                  aria-label="Lưu tên"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60"
                >
                  {savingName ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  aria-label="Huỷ"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/4 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <DialogTitle className="font-display text-lg font-semibold tracking-tight">
                <span className="inline-flex items-center gap-2">
                  {user.name}
                  {isOwner && (
                    <span
                      title="Chủ sở hữu KhanhOS AI"
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                    >
                      <Crown className="h-3 w-3" />
                      Chủ sở hữu
                    </span>
                  )}
                  <button
                    onClick={startEdit}
                    aria-label="Sửa tên hiển thị"
                    title="Sửa tên hiển thị"
                    className="rounded-lg p-1 text-muted-foreground/60 transition-colors hover:bg-foreground/8 hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </span>
              </DialogTitle>
            )}
            <DialogDescription className="text-[13px] text-muted-foreground">
              {isOwner ? "Chủ sở hữu KhanhOS AI" : "Tài khoản KhanhOS AI"}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Thông tin */}
        <div className="space-y-1 px-6 pb-4">
          <InfoRow icon={Mail} label="Email" value={user.email} />
          <InfoRow
            icon={Sparkles}
            label="Gói dịch vụ"
            value={
              isOwner
                ? "Chủ sở hữu (miễn phí mãi)"
                : (PLANS.find((p) => p.id === user.plan)?.name ?? "Free")
            }
          />
          <button
            onClick={() => {
              setOpen(false);
              setPlansModalOpen(true);
            }}
            className="flex w-full items-center justify-between rounded-xl border border-primary/25 bg-primary/8 px-3.5 py-2.5 text-left transition-colors hover:bg-primary/12"
          >
            <span className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-xs text-muted-foreground">Tín dụng & nâng cấp gói</span>
            </span>
            <span className="text-[13px] font-medium text-primary">Xem →</span>
          </button>
          {isOwner && (
            <button
              onClick={() => {
                setOpen(false);
                setAdminModalOpen(true);
              }}
              className="flex w-full items-center justify-between rounded-xl border border-foreground/12 bg-foreground/5 px-3.5 py-2.5 text-left transition-colors hover:bg-foreground/10"
            >
              <span className="flex items-center gap-3">
                <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Quản trị tri thức bot</span>
              </span>
              <span className="text-[13px] font-medium text-foreground">Mở →</span>
            </button>
          )}
          {memberSince && (
            <InfoRow icon={CalendarDays} label="Thành viên từ" value={memberSince} />
          )}
          <InfoRow icon={Hash} label="ID" value={user.id.slice(0, 12)} mono />
        </div>

        {/* Đăng xuất */}
        <div className="border-t border-foreground/8 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-destructive/25 bg-destructive/8 font-medium text-destructive transition-all hover:bg-destructive/15"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </motion.button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-foreground/4 border border-foreground/8 px-3.5 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span
        className={`min-w-0 flex-1 truncate text-right text-[13px] text-foreground/90 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
