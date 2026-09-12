// KhanhOS AI — Lệnh chat cục bộ (không cần DB)
// /help /about /status /models /settings /version /knowledge — đọc từ
// data/chatbot/commands.json. /help HIỆN/ẨN mục "chỉ dành cho chủ sở hữu"
// tuỳ role. Lệnh chạm DB (/give, /usage...) nằm ở admin-commands.ts.

import type { ChatbotData, EngineUserContext } from "./types";
import { LOCAL_MODELS } from "@/lib/models";

export interface CommandOutput {
  text: string;
  action?: string;
}

/** Tách "/give plus a@b.c" → { name: "/give", args: ["plus", "a@b.c"], rest: "plus a@b.c" }. */
export function parseCommand(raw: string): { name: string; args: string[]; rest: string } | null {
  const m = raw.trim().match(/^\/([a-zA-Z0-9_-]+)(?:\s+([\s\S]*))?$/);
  if (!m) return null;
  const rest = (m[2] ?? "").trim();
  return {
    name: "/" + m[1].toLowerCase(),
    args: rest ? rest.split(/\s+/) : [],
    rest,
  };
}

function commandList(data: ChatbotData, owner: boolean): Array<[string, string]> {
  return Object.entries(data.commands)
    .filter(([name, def]) => owner || !def.owner_only)
    .map(([name, def]) => [name, def.description] as [string, string]);
}

function helpText(data: ChatbotData, user?: EngineUserContext): string {
  const owner = user?.role === "owner";
  const lines: string[] = [];

  lines.push("Lệnh mình hiểu được:\n");
  for (const [name, desc] of commandList(data, false)) {
    lines.push(`**${name}** — ${desc}`);
  }

  if (owner) {
    lines.push("\n👑 **Lệnh chỉ dành cho chủ sở hữu:**\n");
    for (const [name, def] of Object.entries(data.commands)) {
      if (!def.owner_only) continue;
      const usage = def.usage ? ` \`${def.usage}\`` : "";
      lines.push(`**${name}**${usage} — ${def.description}`);
    }
  }

  lines.push(
    "\nNgoài lệnh, cứ gõ câu hỏi bình thường (tiếng Việt có dấu hoặc không đều được) — mình trả lời từ tri thức local. Gõ **/knowledge** để xem các chủ đề mình biết."
  );
  return lines.join("\n");

}

/** Chạy lệnh KHÔNG cần DB. Trả về text (đã markdown). */
export function runCommand(
  name: string,
  data: ChatbotData,
  user?: EngineUserContext
): CommandOutput | null {
  const def = data.commands[name];
  if (!def) return null;

  switch (name) {
    case "/help":
      return { text: helpText(data, user) };

    case "/status": {
      const st = data.stats;
      return {
        text:
          `Bộ máy **${data.system.engine.name}** v${data.system.engine.version} — chạy 100% cục bộ, không API ngoài.\n\n` +
          `• **${st.intents}** intent • **${st.patterns}** mẫu câu\n` +
          `• **${st.knowledge}** mục tri thức • **${st.faq}** FAQ\n` +
          `• **${st.topics}** chủ đề • **${st.conversations}** kịch bản follow-up\n` +
          (data.warnings.length
            ? `\n⚠ ${data.warnings.length} cảnh báo dữ liệu (xem /api/admin/chatbot)`
            : "\nDữ liệu sạch — không cảnh báo."),
      };
    }

    case "/models": {
      const lines = LOCAL_MODELS.map(
        (m) =>
          `• **${m.name}** (${m.id}) — ${m.description}${m.badge ? ` [${m.badge}]` : ""}`
      );
      return { text: "Bộ máy đang dùng:\n" + lines.join("\n") };
    }

    case "/knowledge": {
      const lines = data.topics.map(
        (t) => `• **${t.name}** — ${t.description ?? ""}`.trim()
      );
      return {
        text: "Các chủ đề trong tri thức local của mình:\n" + lines.join("\n"),
      };
    }

    default: {
      // /about /settings /version... — dùng "response" tĩnh trong data
      if (def.response) return { text: def.response };
      return { text: `**${name}** — ${def.description}` };
    }
  }
}

/** Text khi user gõ lệnh không tồn tại (kể cả lệnh owner khi thiếu quyền). */
export function unknownCommandText(
  name: string,
  data: ChatbotData,
  user?: EngineUserContext
): string {
  const owner = user?.role === "owner";
  const known = commandList(data, owner).map(([n]) => n);
  return (
    `Mình không có lệnh **${name}**.\n\n` +
    `Các lệnh mình biết: ${known.join(", ")}.\n` +
    "Gõ **/help** để xem hướng dẫn chi tiết."
  );
}
