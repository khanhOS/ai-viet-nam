// KhanhOS AI — UI store (sidebar, modals)

"use client";

import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  accountModalOpen: boolean;
  settingsModalOpen: boolean;
  plansModalOpen: boolean;
  adminModalOpen: boolean;
  aiStudioOpen: boolean;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setAccountModalOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setPlansModalOpen: (open: boolean) => void;
  setAdminModalOpen: (open: boolean) => void;
  setAiStudioOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  accountModalOpen: false,
  settingsModalOpen: false,
  plansModalOpen: false,
  adminModalOpen: false,
  aiStudioOpen: false,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setAccountModalOpen: (open) => set({ accountModalOpen: open }),
  setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),
  setPlansModalOpen: (open) => set({ plansModalOpen: open }),
  setAdminModalOpen: (open) => set({ adminModalOpen: open }),
  setAiStudioOpen: (open) => set({ aiStudioOpen: open }),
}));
