// KhanhOS AI — Auth store (zustand)

"use client";

import { create } from "zustand";
import type { SessionUser } from "@/types/chat";

export type AuthModalStep = "login" | "register" | "forgot";

interface AuthState {
  user: SessionUser | null;
  ready: boolean; // đã fetch /api/auth/me lần đầu
  authModalOpen: boolean;
  authModalStep: AuthModalStep;
  pendingMessage: string | null; // tin nhắn chờ đăng nhập rồi gửi tiếp

  setUser: (user: SessionUser | null) => void;
  setReady: (ready: boolean) => void;
  openAuthModal: (step: AuthModalStep, pendingMessage?: string) => void;
  closeAuthModal: () => void;
  setAuthModalStep: (step: AuthModalStep) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  ready: false,
  authModalOpen: false,
  authModalStep: "login",
  pendingMessage: null,

  setUser: (user) => set({ user }),

  setReady: (ready) => set({ ready }),

  openAuthModal: (step, pendingMessage) =>
    set({ authModalOpen: true, authModalStep: step, pendingMessage: pendingMessage ?? null }),

  closeAuthModal: () =>
    set({ authModalOpen: false, pendingMessage: null }),

  setAuthModalStep: (step) => set({ authModalStep: step }),

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors
    }
    set({ user: null });
  },

  refreshUser: async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      set({ user: data?.user ?? null, ready: true });
    } catch {
      set({ user: null, ready: true });
    }
  },
}));
