// KhanhOS AI — Top bar
// Trái: nút tròn ☰ (mở sidebar, hover scale + glow)
// Phải: chưa đăng nhập → Đăng nhập/Đăng ký; đã đăng nhập → avatar + menu

"use client";

import { useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { Menu, User, Settings, LogOut, Sun, Moon, Sparkles, Brain } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUIStore } from "@/store/use-ui-store";
import { useAuthStore } from "@/store/use-auth-store";
import { useChatStore } from "@/store/use-chat-store";
import { cn } from "@/lib/utils";

export function TopBar() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setAccountModalOpen = useUIStore((s) => s.setAccountModalOpen);
  const setSettingsModalOpen = useUIStore((s) => s.setSettingsModalOpen);
  const setAiStudioOpen = useUIStore((s) => s.setAiStudioOpen);
  const setPlansModalOpen = useUIStore((s) => s.setPlansModalOpen);

  const user = useAuthStore((s) => s.user);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const logout = useAuthStore((s) => s.logout);
  const view = useChatStore((s) => s.view);

  // Theme toggle (tránh hydration mismatch — chỉ render sau mount)
  // mounted: server=false, client=true qua useSyncExternalStore (không setState trong effect)
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const toggleTheme = () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    // Lưu vào DB nếu đã đăng nhập (fire-and-forget)
    if (user) {
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      }).catch(() => {});
    }
  };

  const handleLogout = async () => {
    await logout();
    useChatStore.getState().reset();
    useChatStore.getState().loadConversations();
  };

  const initials = user?.name
    .split(" ")
    .map((w) => w[0])
    .slice(-2)
    .join("")
    .toUpperCase();

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between px-4 md:px-6 pt-[max(0.5rem,env(safe-area-inset-top))]">
      {/* Trái: nút tròn ☰ */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="kh-icon-btn"
          aria-label="Mở menu điều hướng"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

        {/* Brand nhỏ khi đang chat */}
        <motion.div
          initial={false}
          animate={{ opacity: view === "chat" ? 1 : 0, x: view === "chat" ? 0 : -8 }}
          transition={{ duration: 0.35 }}
          className={cn(
            "flex items-center gap-2 overflow-hidden",
            view === "chat" ? "pointer-events-auto" : "pointer-events-none"
          )}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/25 bg-primary/8">
            <span className="font-display text-xs font-bold text-primary">K</span>
          </div>
          <span className="hidden font-display text-sm font-semibold tracking-tight text-foreground/90 sm:block">
            KhanhOS <span className="text-primary/80">AI</span>
          </span>
        </motion.div>
      </div>

      {/* Phải: theme + auth */}
      <div className="flex items-center gap-2">
        {mounted && (
          <button
            onClick={toggleTheme}
            className="kh-icon-btn h-9 w-9"
            aria-label={resolvedTheme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
            title={resolvedTheme === "dark" ? "Giao diện sáng" : "Giao diện tối"}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        )}
        {/* Khách: xem bảng giá gói dịch vụ */}
        {!user && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setPlansModalOpen(true)}
            className="flex h-9 items-center justify-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 text-[13px] font-medium text-primary transition-all hover:bg-primary/15 hover:kh-glow-sm sm:px-3.5"
            aria-label="Xem gói dịch vụ"
            title="Gói dịch vụ"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Gói dịch vụ</span>
          </motion.button>
        )}
        {!user ? (
          <>
            <button
              onClick={() => openAuthModal("login")}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-foreground/6 hover:text-foreground"
            >
              Đăng nhập
            </button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => openAuthModal("register")}
              className="rounded-full bg-primary/90 px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary hover:kh-glow-sm"
            >
              Đăng ký
            </motion.button>
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.button
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2.5 rounded-full border border-foreground/10 bg-foreground/4 py-1.5 pl-1.5 pr-3.5 transition-all hover:border-primary/30 hover:bg-foreground/8"
                aria-label="Menu tài khoản"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 font-display text-xs font-bold text-primary">
                  {initials || "K"}
                </span>
                <span className="hidden max-w-[120px] truncate text-sm font-medium text-foreground/90 sm:block">
                  {user.name}
                </span>
              </motion.button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="kh-glass-strong w-48 rounded-xl border-foreground/10"
            >
              <DropdownMenuItem
                onClick={() => setAccountModalOpen(true)}
                className="gap-2.5 rounded-lg py-2.5 cursor-pointer"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                Tài khoản
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setPlansModalOpen(true)}
                className="gap-2.5 rounded-lg py-2.5 cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                Gói & Nâng cấp
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setAiStudioOpen(true)}
                className="gap-2.5 rounded-lg py-2.5 cursor-pointer"
              >
                <Brain className="h-4 w-4 text-primary" />
                AI Studio
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSettingsModalOpen(true)}
                className="gap-2.5 rounded-lg py-2.5 cursor-pointer"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                Cài đặt
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-foreground/8" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="gap-2.5 rounded-lg py-2.5 cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
