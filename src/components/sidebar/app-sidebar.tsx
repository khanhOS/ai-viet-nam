// KhanhOS AI — Sidebar: brand, chat mới, tìm kiếm, lịch sử (đổi tên/xoá), nav, logout
// Trượt từ trái + overlay. Scroll được. Mobile friendly (touch, safe-area).

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Home, User, Settings, LogOut, MessageSquare, X, Trash2, Clock, Search, Pencil, Check, Sparkles } from "lucide-react";
import { useUIStore } from "@/store/use-ui-store";
import { useAuthStore } from "@/store/use-auth-store";
import { useChatStore } from "@/store/use-chat-store";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN", { day: "numeric", month: "short" });
}

export function AppSidebar() {
  const open = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const setAccountModalOpen = useUIStore((s) => s.setAccountModalOpen);
  const setSettingsModalOpen = useUIStore((s) => s.setSettingsModalOpen);
  const setPlansModalOpen = useUIStore((s) => s.setPlansModalOpen);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const conversations = useChatStore((s) => s.conversations);
  const conversationsLoading = useChatStore((s) => s.conversationsLoading);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const view = useChatStore((s) => s.view);
  const newChat = useChatStore((s) => s.newChat);
  const openConversation = useChatStore((s) => s.openConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const renameConversation = useChatStore((s) => s.renameConversation);

  // Tìm kiếm + đổi tên inline
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const close = () => setSidebarOpen(false);

  const filtered = search.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(search.trim().toLowerCase())
      )
    : conversations;

  const commitRename = async (id: string) => {
    const ok = await renameConversation(id, renameDraft);
    if (ok) setRenamingId(null);
  };

  const handleLogout = async () => {
    await logout();
    useChatStore.getState().reset();
    useChatStore.getState().loadConversations();
    close();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay nhẹ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={close}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          {/* Sidebar panel */}
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            className="fixed left-0 top-0 z-50 flex h-dvh w-[290px] flex-col border-r border-foreground/8 bg-sidebar/95 backdrop-blur-2xl shadow-2xl shadow-black/20"
            role="dialog"
            aria-label="Thanh điều hướng"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                  <span className="font-display text-sm font-bold text-primary">K</span>
                </div>
                <span className="font-display text-[15px] font-semibold tracking-tight text-foreground">
                  KhanhOS <span className="text-primary">AI</span>
                </span>
              </div>
              <button
                onClick={close}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
                aria-label="Đóng sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Chat mới */}
            <div className="px-3 pt-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  newChat();
                  close();
                }}
                className="group flex w-full items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-2.5 text-sm font-medium text-primary transition-all hover:bg-primary/15 hover:kh-glow-sm"
              >
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                Chat mới
              </motion.button>
            </div>

            {/* Tìm kiếm hội thoại */}
            {conversations.length > 3 && (
              <div className="px-3 pt-2.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm cuộc trò chuyện…"
                    aria-label="Tìm kiếm cuộc trò chuyện"
                    className="h-9 w-full rounded-lg border border-foreground/10 bg-foreground/4 pl-8.5 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/30 focus:outline-none"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      aria-label="Xoá tìm kiếm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground/60 hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Lịch sử hội thoại (scroll) */}
            <div className="mt-4 flex min-h-0 flex-1 flex-col">
              <p className="flex items-center gap-1.5 px-5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                <Clock className="h-3 w-3" />
                Lịch sử
              </p>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
                {conversationsLoading && conversations.length === 0 ? (
                  <div className="space-y-2 px-2 pt-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-9 animate-pulse rounded-lg bg-foreground/4" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <MessageSquare className="mx-auto h-5 w-5 text-muted-foreground/30" />
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground/60">
                      {search.trim()
                        ? "Không tìm thấy cuộc trò chuyện nào."
                        : user
                          ? "Chưa có cuộc trò chuyện nào. Bắt đầu chat mới!"
                          : "Đăng nhập để lưu lịch sử trò chuyện."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filtered.map((conv) => (
                      <div
                        key={conv.id}
                        className={cn(
                          "group relative flex items-center rounded-lg transition-colors",
                          activeConversationId === conv.id
                            ? "bg-primary/12 border border-primary/20"
                            : "border border-transparent hover:bg-foreground/5"
                        )}
                      >
                        {renamingId === conv.id ? (
                          <div className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1.5">
                            <input
                              autoFocus
                              value={renameDraft}
                              maxLength={120}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.nativeEvent.isComposing) commitRename(conv.id);
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              className="h-7 min-w-0 flex-1 rounded-md border border-primary/30 bg-foreground/4 px-2 text-[13px] text-foreground focus:outline-none"
                              aria-label="Tên mới"
                            />
                            <button
                              onClick={() => commitRename(conv.id)}
                              aria-label="Lưu tên"
                              className="shrink-0 rounded-md p-1 text-primary hover:bg-primary/10"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setRenamingId(null)}
                              aria-label="Huỷ đổi tên"
                              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-foreground/8"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                openConversation(conv.id);
                                close();
                              }}
                              className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left"
                              title={conv.title}
                            >
                              <MessageSquare
                                className={cn(
                                  "h-3.5 w-3.5 shrink-0",
                                  activeConversationId === conv.id
                                    ? "text-primary"
                                    : "text-muted-foreground/50"
                                )}
                              />
                              <span className="min-w-0 flex-1">
                                <span
                                  className={cn(
                                    "block truncate text-[13px]",
                                    activeConversationId === conv.id
                                      ? "text-foreground"
                                      : "text-foreground/70"
                                  )}
                                >
                                  {conv.title}
                                </span>
                                <span className="block truncate text-[10.5px] text-muted-foreground/50">
                                  {timeAgo(conv.updatedAt)}
                                </span>
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setRenamingId(conv.id);
                                setRenameDraft(conv.title);
                              }}
                              aria-label={`Đổi tên ${conv.title}`}
                              className="mr-0.5 hidden shrink-0 rounded-md p-1.5 text-muted-foreground/50 transition-all hover:bg-primary/15 hover:text-primary group-hover:block"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => deleteConversation(conv.id)}
                              aria-label={`Xoá ${conv.title}`}
                              className="mr-1.5 hidden shrink-0 rounded-md p-1.5 text-muted-foreground/50 transition-all hover:bg-destructive/15 hover:text-destructive group-hover:block"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Divider + Nav dưới */}
            <div className="mt-auto border-t border-foreground/8 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
              <div className="space-y-0.5 px-3">
                <SidebarNavItem
                  icon={Home}
                  label="Home"
                  active={view === "home"}
                  onClick={() => {
                    newChat();
                    close();
                  }}
                />
                {user && (
                  <SidebarNavItem
                    icon={Sparkles}
                    label="Gói & Nâng cấp"
                    onClick={() => {
                      close();
                      setPlansModalOpen(true);
                    }}
                  />
                )}
                <SidebarNavItem
                  icon={User}
                  label="Tài khoản"
                  onClick={() => {
                    close();
                    setAccountModalOpen(true);
                  }}
                />
                <SidebarNavItem
                  icon={Settings}
                  label="Cài đặt"
                  onClick={() => {
                    close();
                    setSettingsModalOpen(true);
                  }}
                />
                {user && (
                  <SidebarNavItem
                    icon={LogOut}
                    label="Đăng xuất"
                    onClick={handleLogout}
                    danger
                  />
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function SidebarNavItem({
  icon: Icon,
  label,
  onClick,
  active,
  danger,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-foreground/6 text-foreground"
          : danger
            ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
