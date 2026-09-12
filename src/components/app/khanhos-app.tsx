// KhanhOS AI — App shell
// SPA đơn trang: Home ↔ Chat transition mượt (không reload).
// Mount: fetch user session, model registry, conversations.
// `initial` cho phép các route riêng (/login, /chat/[id], /settings...)
// render cùng shell này với trạng thái mở đầu tương ứng.

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BackgroundAura } from "./background-aura";
import { EffectsLayer } from "./effects-layer";
import { TopBar } from "./top-bar";
import { HomeHero } from "@/components/home/home-hero";
import { ChatView } from "@/components/chat/chat-view";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { AuthModal } from "@/components/auth/auth-modal";
import { AccountModal } from "@/components/account/account-modal";
import { SettingsModal } from "@/components/settings/settings-modal";
import { AIStudioModal } from "@/components/settings/ai-studio-modal";
import { PlansModal } from "@/components/plans/plans-modal";
import { KnowledgeAdminModal } from "@/components/admin/knowledge-admin-modal";
import { useAuthStore, type AuthModalStep } from "@/store/use-auth-store";
import { useChatStore } from "@/store/use-chat-store";
import { useUIStore } from "@/store/use-ui-store";
import { ThemeSync } from "@/components/theme/theme-sync";

export interface AppInitialState {
  /** Mở modal auth với step tương ứng (route /login, /register, /forgot-password) */
  authModal?: AuthModalStep | null;
  /** Route /reset-password — mở form đặt lại mật khẩu (token tự đọc từ URL) */
  openReset?: boolean;
  /** Mở cuộc hội thoại cụ thể (route /chat/[id]) */
  openConversationId?: string;
  /** Mở modal cài đặt (route /settings) */
  openSettings?: boolean;
  /** Mở modal tài khoản (route /account) */
  openAccount?: boolean;
}

export function KhanhOSApp({ initial }: { initial?: AppInitialState }) {
  const view = useChatStore((s) => s.view);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const router = useRouter();
  const initialApplied = useRef(false);

  // Khởi tạo: session + model registry + conversations
  useEffect(() => {
    const init = async () => {
      await refreshUser();
      await useChatStore.getState().loadModels();
      await useChatStore.getState().loadConversations();

      // ── Áp dụng trạng thái đầu theo route ──
      if (initial && !initialApplied.current) {
        initialApplied.current = true;
        const { user } = useAuthStore.getState();
        const openAuthModal = useAuthStore.getState().openAuthModal;

        // Route auth (/login, /register, /forgot-password):
        // đã đăng nhập rồi → về trang chủ; chưa → mở modal step tương ứng
        if (initial.authModal) {
          if (user) {
            router.replace("/");
          } else {
            openAuthModal(initial.authModal);
          }
        }

        // Route /reset-password?token=... — AuthModal tự đọc token,
        // ở đây chỉ cần mở step "forgot" nếu chưa mở (token có thể tự trigger)
        if (initial.openReset) {
          if (!useAuthStore.getState().authModalOpen) openAuthModal("forgot");
        }

        // Route /chat/[id] — mở hội thoại (bảo vệ: chưa login → modal login)
        if (initial.openConversationId) {
          if (user) {
            useChatStore.getState().openConversation(initial.openConversationId);
          } else {
            openAuthModal("login");
          }
        }

        // Route /settings, /account — yêu cầu đăng nhập
        if (initial.openSettings || initial.openAccount) {
          if (user) {
            if (initial.openSettings) useUIStore.getState().setSettingsModalOpen(true);
            if (initial.openAccount) useUIStore.getState().setAccountModalOpen(true);
          } else {
            openAuthModal("login");
          }
        }
      }
    };
    init();
  }, [refreshUser, initial, router]);

  // Sau khi login/register thành công TRÊN route auth → chuyển về trang chủ
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state, prev) => {
      if (initial?.authModal && !prev.user && state.user) {
        // Nếu có pendingMessage thì để flow tự gửi; else về "/"
        if (!state.pendingMessage) router.replace("/");
      }
    });
    return unsub;
  }, [initial?.authModal, router]);

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <BackgroundAura />
      <EffectsLayer />
      <ThemeSync />

      <TopBar />

      {/* HOME ↔ CHAT transition */}
      <main className="h-full">
        <AnimatePresence mode="wait" initial={false}>
          {view === "home" ? (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98, filter: "blur(6px)" }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="relative h-full overflow-y-auto"
              data-home-scroll="true"
            >
              <HomeHero />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex h-full flex-col pt-16"
            >
              <ChatView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Overlays */}
      <AppSidebar />
      <AuthModal />
      <AccountModal />
      <SettingsModal />
      <AIStudioModal />
      <PlansModal />
      <KnowledgeAdminModal />
    </div>
  );
}
