// Kiểm tra nhanh dữ liệu chatbot — chạy: bun scripts/check-chatbot-data.ts
import { getChatbotData } from "../src/lib/local-chat/data-loader";
import { normalizeMessage } from "../src/lib/local-chat/normalize";
import { detectIntents } from "../src/lib/local-chat/intent-engine";

const data = getChatbotData();
console.log("=== STATS ===");
console.log(JSON.stringify(data.stats, null, 2));
console.log("Topics:", data.topics.length, "| Commands:", Object.keys(data.commands).length, "| Conversations:", data.conversations.length);

if (data.warnings.length) {
  console.log("=== WARNINGS ===");
  data.warnings.forEach((w) => console.log("⚠", w));
} else {
  console.log("WARNINGS: none ✔");
}

// Test nhanh vài câu
const cases: Array<[string, string]> = [
  ["AI la gi", "what_is_ai"],
  ["ai là gì vậy bro", "what_is_ai"],
  ["local AI co can api ko", "local_ai_without_api"],
  ["cho t biết trí tuệ nhân tạo là gì", "what_is_ai"],
  ["JS là gì?", "javascript"],
  ["db là gì", "what_is_database"],
  ["làm sao chạy minecraft server?", "minecraft_server"],
  ["geyser dùng làm gì?", "geyser_floodgate"],
  ["KhanhOS là gì?", "what_is_khanhos"],
  ["web động là gì?", "static_vs_dynamic"],
  ["hello", "greeting"],
  ["cảm ơn nha", "thanks"],
  ["what is python", "python"],
  ["máy tính chậm quá", "troubleshooting"],
  ["vps là gì", "vps"],
];

console.log("=== SMOKE TEST ===");
let pass = 0;
for (const [msg, expected] of cases) {
  const norm = normalizeMessage(msg, data.aliases, data.system.engine.max_message_chars);
  const top = detectIntents(norm, null, data)[0];
  const ok = top?.intent.id === expected;
  if (ok) pass++;
  console.log(`${ok ? "✔" : "✘"} "${msg}" → ${top?.intent.id ?? "(none)"} (conf ${top?.confidence.toFixed(2) ?? "-"})${ok ? "" : ` — expected ${expected}`}`);
}
console.log(`\n${pass}/${cases.length} PASS`);
process.exit(pass === cases.length ? 0 : 1);
