// KhanhOS AI — Client-side types (khớp với API responses)

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role?: string; // "user" | "owner"
  plan?: string; // "free" | "plus" | "vip" | "max"
  avatarSeed: string | null;
  createdAt?: string;
}

export interface PublicModel {
  id: string;
  name: string;
  description: string;
  provider: string;
  capabilities: {
    chat: boolean;
    code: boolean;
    webSearch: boolean;
    vision: boolean;
    streaming: boolean;
  };
  badge?: string;
  order: number;
  available: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  modelId: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface Attachment {
  name: string;
  size: number;
  type: string;
  textContent?: string;
}

export interface WebSource {
  title: string;
  url: string;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId?: string | null;
  attachments?: Attachment[];
  sources?: WebSource[];
  createdAt?: string;
  /** Trạng thái local khi đang stream */
  streaming?: boolean;
  /** Status pipeline AI thật (vd "Đang phân tích câu hỏi…") — chỉ khi streaming */
  status?: string;
  /** Metadata model cục bộ sau khi done (model thật, tốc độ đo được) */
  meta?: {
    source: "local-model" | "local-rules";
    model?: string | null;
    profile?: string | null;
    metrics?: {
      timeToFirstTokenMs?: number | null;
      totalMs?: number | null;
      tokensPerSecond?: number | null;
      estimated?: boolean;
    };
    verification?: { passed: boolean; severity: string } | null;
  };
}

export interface UserSettings {
  defaultModelId: string;
  webSearchEnabled: boolean;
  reducedMotionPref: "system" | "on" | "off";
  theme: "dark" | "light" | "system";
}
