// KhanhOS AI — Model cục bộ (nguồn sự thật duy nhất sau khi gỡ provider ngoài)
// Frontend vẫn nhận cùng shape PublicModel qua /api/models — UI không đổi.
// Kiến trúc ChatEngine cho phép cắm thêm engine local thật (Ollama...) sau này.

export const DEFAULT_MODEL_ID = "khanhos-core";

export interface LocalModelInfo {
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
}

export const LOCAL_MODELS: LocalModelInfo[] = [
  {
    id: DEFAULT_MODEL_ID,
    name: "KhanhOS Core",
    description:
      "Bộ máy tri thức cục bộ — trả lời từ dữ liệu local, không gọi API ngoài, không cần key.",
    provider: "local-rule",
    capabilities: {
      chat: true,
      code: true,
      webSearch: false,
      vision: false,
      streaming: true,
    },
    badge: "Cục bộ",
    order: 1,
  },
];

export function listModels() {
  return LOCAL_MODELS.map((m) => ({ ...m, available: true }));
}

export function isModelAvailable(id: string): boolean {
  return id === DEFAULT_MODEL_ID;
}
