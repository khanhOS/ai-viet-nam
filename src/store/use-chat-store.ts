// KhanhOS AI — Chat store (zustand)
// Quản lý: view home/chat, conversations, messages, model selection, streaming.

"use client";

import { create } from "zustand";
import type {
  ChatMessage,
  ConversationSummary,
  PublicModel,
  Attachment,
  WebSource,
} from "@/types/chat";
import { useAuthStore } from "./use-auth-store";
import { toast } from "@/hooks/use-toast";

type View = "home" | "chat";

interface SSEEvent {
  type: "meta" | "delta" | "done" | "error" | "status" | "tool_call" | "tool_result" | "verification";
  conversationId?: string;
  title?: string;
  modelId?: string;
  sources?: WebSource[];
  delta?: string;
  messageId?: string;
  interrupted?: boolean;
  content?: string;
  message?: string;
  intent?: string | null;
  confidence?: number;
  source?: string;
  suggestions?: string[];
  action?: "clear_chat" | "reset_chat";
  // status pipeline AI thật
  stage?: string;
  label?: string;
  // tool events
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
  ok?: boolean;
  output?: string;
  // verification
  passed?: boolean;
  severity?: string;
  // done metadata
  model?: string | null;
  profile?: string | null;
  metrics?: {
    timeToFirstTokenMs?: number | null;
    totalMs?: number | null;
    tokensPerSecond?: number | null;
    estimated?: boolean;
  };
  verification?: { passed: boolean; severity: string } | null;
}

interface ChatState {
  view: View;
  models: PublicModel[];
  modelsLoaded: boolean;
  selectedModelId: string;
  webSearchEnabled: boolean;

  conversations: ConversationSummary[];
  conversationsLoading: boolean;
  activeConversationId: string | null;

  messages: ChatMessage[];
  streaming: boolean;
  error: string | null;

  abortController: AbortController | null;

  // actions
  loadModels: () => Promise<void>;
  setSelectedModelId: (id: string) => void;
  setWebSearchEnabled: (on: boolean) => void;
  loadConversations: () => Promise<void>;
  openConversation: (id: string) => Promise<void>;
  newChat: () => void;
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>;
  stopGeneration: () => void;
  regenerate: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<boolean>;
  reset: () => void;
}

const DEFAULT_MODEL = "khanhos-core";

export const useChatStore = create<ChatState>((set, get) => ({
  view: "home",
  models: [],
  modelsLoaded: false,
  selectedModelId: DEFAULT_MODEL,
  webSearchEnabled: false,

  conversations: [],
  conversationsLoading: false,
  activeConversationId: null,

  messages: [],
  streaming: false,
  error: null,
  abortController: null,

  // ── Model registry ──────────────────────────
  loadModels: async () => {
    try {
      const res = await fetch("/api/models");
      const data = await res.json();
      const models: PublicModel[] = data?.models ?? [];
      set({ models, modelsLoaded: true });

      // Ưu tiên default từ settings user nếu đã đăng nhập
      const auth = useAuthStore.getState();
      if (auth.user) {
        try {
          const sRes = await fetch("/api/settings");
          const sData = await sRes.json();
          const preferred: string | undefined = sData?.settings?.defaultModelId;
          if (preferred && models.find((m) => m.id === preferred && m.available)) {
            set({ selectedModelId: preferred, webSearchEnabled: !!sData?.settings?.webSearchEnabled });
          }
          // Đồng bộ theme đã lưu trong DB (dark/light/system)
          // — qua event, ThemeSync (client component) sẽ gọi setTheme của next-themes
          const savedTheme = sData?.settings?.theme;
          if (savedTheme === "dark" || savedTheme === "light" || savedTheme === "system") {
            window.dispatchEvent(
              new CustomEvent("kh:apply-theme", { detail: savedTheme })
            );
          }
        } catch {
          // settings không bắt buộc
        }
      }
    } catch {
      set({ modelsLoaded: true });
    }
  },

  setSelectedModelId: (id) => {
    set({ selectedModelId: id });
    // Lưu preference nếu đã đăng nhập (fire and forget)
    const auth = useAuthStore.getState();
    if (auth.user) {
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultModelId: id }),
      }).catch(() => {});
    }
  },

  setWebSearchEnabled: (on) => {
    set({ webSearchEnabled: on });
    const auth = useAuthStore.getState();
    if (auth.user) {
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webSearchEnabled: on }),
      }).catch(() => {});
    }
  },

  // ── Conversations ───────────────────────────
  loadConversations: async () => {
    const auth = useAuthStore.getState();
    if (!auth.user) {
      set({ conversations: [] });
      return;
    }
    set({ conversationsLoading: true });
    try {
      const res = await fetch("/api/chats");
      const data = await res.json();
      set({ conversations: data?.conversations ?? [], conversationsLoading: false });
    } catch {
      set({ conversationsLoading: false });
    }
  },

  openConversation: async (id) => {
    // Nếu đang stream thì dừng
    get().stopGeneration();
    set({ view: "chat", activeConversationId: id, messages: [], error: null });
    try {
      const res = await fetch(`/api/chats/${id}`);
      if (!res.ok) throw new Error("load");
      const data = await res.json();
      const messages: ChatMessage[] = (data?.messages ?? []).map(
        (m: ChatMessage) => ({ ...m, streaming: false })
      );
      set({ messages });
      const modelId = data?.conversation?.modelId;
      if (modelId && get().models.find((m) => m.id === modelId && m.available)) {
        set({ selectedModelId: modelId });
      }
    } catch {
      set({ error: "Không tải được cuộc trò chuyện" });
    }
  },

  newChat: () => {
    get().stopGeneration();
    set({
      view: "home",
      activeConversationId: null,
      messages: [],
      error: null,
    });
  },

  // ── Gửi tin nhắn (streaming SSE) ────────────
  sendMessage: async (content, attachments) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      // Chưa đăng nhập → mở modal, giữ tin nhắn chờ
      useAuthStore.getState().openAuthModal("login", content);
      return;
    }

    const state = get();
    if (state.streaming) return;

    const trimmed = content.trim();
    if (!trimmed) return;

    // HOME → CHAT transition (không reload trang)
    set({ view: "chat", error: null });

    // Optimistic: user message + assistant placeholder
    const userMsg: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: trimmed,
      attachments,
    };
    const assistantMsg: ChatMessage = {
      id: `local-assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      modelId: state.selectedModelId,
      streaming: true,
    };
    set({ messages: [...state.messages, userMsg, assistantMsg], streaming: true });

    await runStream(
      get,
      set,
      {
        conversationId: state.activeConversationId ?? undefined,
        content: trimmed,
        modelId: state.selectedModelId,
        webSearch: state.webSearchEnabled,
        regenerate: false,
        attachments,
      },
      assistantMsg.id
    );
  },

  // ── Stop generation ─────────────────────────
  stopGeneration: () => {
    const controller = get().abortController;
    if (controller) {
      controller.abort();
    }
  },

  // ── Regenerate ──────────────────────────────
  regenerate: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const state = get();
    if (state.streaming || !state.activeConversationId) return;
    if (!state.messages.some((m) => m.role === "assistant")) return;

    set({ streaming: true, error: null });

    // Xoá assistant message cuối phía client (server cũng xoá) + thêm placeholder mới
    const messages = [...state.messages];
    while (messages.length && messages[messages.length - 1].role === "assistant") {
      messages.pop();
    }
    const assistantMsg: ChatMessage = {
      id: `local-assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      modelId: state.selectedModelId,
      streaming: true,
    };
    set({ messages: [...messages, assistantMsg] });

    await runStream(
      get,
      set,
      {
        conversationId: state.activeConversationId,
        modelId: state.selectedModelId,
        webSearch: state.webSearchEnabled,
        regenerate: true,
      },
      assistantMsg.id
    );
  },

  deleteConversation: async (id) => {
    try {
      await fetch(`/api/chats/${id}`, { method: "DELETE" });
      const { conversations, activeConversationId } = get();
      set({ conversations: conversations.filter((c) => c.id !== id) });
      if (activeConversationId === id) {
        get().newChat();
      }
    } catch {
      toast({ title: "Không xoá được cuộc trò chuyện", variant: "destructive" });
    }
  },

  renameConversation: async (id, title) => {
    const trimmed = title.trim();
    if (!trimmed) return false;
    try {
      const res = await fetch(`/api/chats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed.slice(0, 120) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        toast({ title: "Không đổi được tên", description: d?.error, variant: "destructive" });
        return false;
      }
      const { conversations } = get();
      set({
        conversations: conversations.map((c) =>
          c.id === id ? { ...c, title: trimmed.slice(0, 120) } : c
        ),
      });
      return true;
    } catch {
      toast({ title: "Lỗi kết nối khi đổi tên", variant: "destructive" });
      return false;
    }
  },

  reset: () => {
    get().stopGeneration();
    set({
      view: "home",
      activeConversationId: null,
      messages: [],
      streaming: false,
      error: null,
    });
  },
}));

// ═══════════════════════════════════════════
// SSE STREAM RUNNER — dùng chung send/regenerate
// ═══════════════════════════════════════════

interface StreamInput {
  conversationId?: string;
  content?: string;
  modelId: string;
  webSearch?: boolean;
  regenerate?: boolean;
  attachments?: Attachment[];
}

async function runStream(
  get: () => ChatState,
  set: (partial: Partial<ChatState>) => void,
  input: StreamInput,
  assistantId: string
): Promise<void> {
  const controller = new AbortController();
  set({ abortController: controller });

  let full = "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => null);
      const message =
        data?.error ??
        (res.status === 401 ? "Chưa đăng nhập" : `Lỗi ${res.status}`);
      throw new Error(message);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // Throttle re-render: flush tối đa mỗi ~40ms
    let lastFlush = 0;
    const flush = (force = false) => {
      const now = Date.now();
      if (force || now - lastFlush > 40) {
        lastFlush = now;
        const messages = get().messages;
        const idx = messages.findIndex((m) => m.id === assistantId);
        if (idx >= 0) {
          const next = [...messages];
          next[idx] = { ...next[idx], content: full };
          set({ messages: next });
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;

        let event: SSEEvent;
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }

        if (event.type === "meta") {
          // Set conversation id nếu tạo mới; gắn sources vào assistant msg
          if (event.conversationId) {
            set({ activeConversationId: event.conversationId });
          }
          const messages = get().messages;
          const idx = messages.findIndex((m) => m.id === assistantId);
          if (idx >= 0 && event.sources?.length) {
            const next = [...messages];
            next[idx] = { ...next[idx], sources: event.sources };
            set({ messages: next });
          }
        } else if (event.type === "status" && event.label) {
          // Status pipeline THẬT (phân tích/lập kế hoạch/chạy tool/kiểm tra…)
          const messages = get().messages;
          const idx = messages.findIndex((m) => m.id === assistantId);
          if (idx >= 0) {
            const next = [...messages];
            // Model viết lại bản trả lời → xóa text cũ khỏi màn hình để
            // stream bản mới thay thế liền mạch (không nối dồn 2 bản)
            if (event.stage === "revising") {
              full = "";
              next[idx] = { ...next[idx], content: "", status: event.label };
            } else {
              next[idx] = { ...next[idx], status: event.label };
            }
            set({ messages: next });
          }
        } else if (event.type === "tool_call" && event.name) {
          const messages = get().messages;
          const idx = messages.findIndex((m) => m.id === assistantId);
          if (idx >= 0) {
            const next = [...messages];
            next[idx] = {
              ...next[idx],
              status: `Đang chạy công cụ ${event.name}…`,
            };
            set({ messages: next });
          }
        } else if (event.type === "tool_result" && event.name) {
          const messages = get().messages;
          const idx = messages.findIndex((m) => m.id === assistantId);
          if (idx >= 0) {
            const next = [...messages];
            next[idx] = {
              ...next[idx],
              status: event.ok ? `Công cụ ${event.name}: ${event.output ?? "xong"}`.slice(0, 80) : `Công cụ ${event.name} lỗi`,
            };
            set({ messages: next });
          }
        } else if (event.type === "verification") {
          const messages = get().messages;
          const idx = messages.findIndex((m) => m.id === assistantId);
          if (idx >= 0) {
            const next = [...messages];
            next[idx] = {
              ...next[idx],
              status: event.passed ? "Đã kiểm tra kết quả ✓" : "Đang hoàn thiện lại…",
            };
            set({ messages: next });
          }
        } else if (event.type === "delta" && event.delta) {
          full += event.delta;
          flush();
        } else if (event.type === "done") {
          if (event.messageId && assistantId) {
            const messages = get().messages;
            const idx = messages.findIndex((m) => m.id === assistantId);
            if (idx >= 0) {
              const next = [...messages];
              next[idx] = {
                ...next[idx],
                id: event.messageId,
                content: event.content ?? full,
                streaming: false,
                status: undefined,
                meta: {
                  source: event.source === "local-model" ? "local-model" : "local-rules",
                  model: event.model ?? null,
                  profile: event.profile ?? null,
                  metrics: event.metrics ?? undefined,
                  verification: event.verification ?? null,
                },
              };
              set({ messages: next });
            }
          }
          // Lệnh /clear, /reset — dọn màn hình (server đã xoá DB),
          // chỉ giữ lại dòng xác nhận của bot
          if (event.action === "clear_chat" || event.action === "reset_chat") {
            const messages = get().messages;
            const kept = messages.filter(
              (m) => m.id === event.messageId || (event.messageId === undefined && m.id === assistantId)
            );
            set({ messages: kept, activeConversationId: event.conversationId ?? get().activeConversationId });
          }
        } else if (event.type === "error") {
          set({ error: event.message ?? "Lỗi sinh phản hồi" });
          toast({
            title: "Lỗi AI",
            description: event.message ?? "Không sinh được phản hồi",
            variant: "destructive",
          });
        }
      }
    }
    flush(true);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      // Người dùng nhấn Stop — giữ phần đã sinh
      const messages = get().messages;
      const idx = messages.findIndex((m) => m.id === assistantId);
      if (idx >= 0) {
        const next = [...messages];
        next[idx] = {
          ...next[idx],
          content: next[idx].content || full || "_[đã dừng]_",
          streaming: false,
        };
        set({ messages: next });
      }
    } else {
      const message = e instanceof Error ? e.message : "Lỗi kết nối";
      set({ error: message });
      const messages = get().messages;
      const idx = messages.findIndex((m) => m.id === assistantId);
      if (idx >= 0) {
        const next = [...messages];
        next[idx] = { ...next[idx], streaming: false };
        set({ messages: next });
      }
      toast({ title: "Không gửi được", description: message, variant: "destructive" });
    }
  } finally {
    // Dọn assistant placeholder nếu chưa có nội dung gì
    const messages = get().messages;
    const idx = messages.findIndex((m) => m.id === assistantId);
    if (idx >= 0 && !messages[idx].content && !full) {
      const next = messages.filter((m) => m.id !== assistantId);
      set({ messages: next });
    } else if (idx >= 0 && messages[idx].streaming) {
      // stream kết thúc mà chưa nhận done (vd abort) → dọn status
      const next = [...messages];
      next[idx] = { ...next[idx], streaming: false, status: undefined };
      set({ messages: next });
    }
    set({ streaming: false, abortController: null });
    // Refresh sidebar conversation list (tiêu đề mới, updatedAt)
    const auth = useAuthStore.getState();
    if (auth.user) {
      get().loadConversations();
    }
  }
}
