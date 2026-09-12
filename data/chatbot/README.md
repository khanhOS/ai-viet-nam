# data/chatbot — Dữ liệu bộ máy chat cục bộ KhanhOS AI

Toàn bộ "trí tuệ" của chatbot nằm ở đây — **thêm/sửa kiến thức không đụng code**.
Engine (`src/lib/local-chat/`) đọc các file JSON này, cache trong RAM theo mtime:
sửa file → engine tự nạp lại **không cần restart server**.

> KHÔNG gọi API AI ngoài. KHÔNG cần API key. Mọi câu trả lời chỉ đến từ các file này —
> engine không biết thì nói thẳng "chưa có kiến thức local", không bịa.

## Cấu trúc

```
data/chatbot/
├── README.md                  # file này
├── system.json                # cấu hình engine: ngưỡng match, điểm scoring,
│                              #   context window, câu fallback, model_info
├── commands.json              # lệnh chat (/help, /clear...) + owner_only
├── topics.json                # danh sách chủ đề (hiện trong /knowledge)
├── aliases.json               # chuẩn hoá slang + thuật ngữ (ko→không, js→javascript)
├── faq.json                   # câu hỏi thường gặp match nhanh
├── conversations.json         # ví dụ hội thoại multi-turn (dữ liệu tham chiếu)
├── intents/                   # intent theo nhóm — mỗi file là MẢNG intent
│   ├── general.json           #   chào hỏi, cảm ơn, identity bot...
│   ├── ai.json                #   AI, local AI, Ollama, LLM...
│   ├── programming.json       #   ngôn ngữ, web, code...
│   ├── database-auth.json     #   SQLite, Prisma, đăng nhập, session...
│   ├── webdev-khanhos.json    #   Next.js, React + tính năng KhanhOS thật
│   └── computer-minecraft-cloud.json
├── responses/                 # câu trả lời theo response_id — nhiều biến thể,
│   └── ... (theo nhóm)        #   engine xoay vòng tránh lặp lại
└── knowledge/                 # tri thức mở rộng: định nghĩa + giải thích đơn giản
    ├── ai.json                #   + ví dụ + chủ đề liên quan (dùng cho follow-up
    ├── programming.json       #   "giải thích thêm", "cho ví dụ", "đơn giản hơn")
    ├── tech.json
    └── web.json
```

## Intent (mẫu câu → chủ đề)

Mỗi intent trong `intents/*.json`:

```json
{
  "id": "what_is_ai",
  "topic": "ai",
  "patterns": ["ai la gi", "artificial intelligence la gi", "ai是什么"],
  "keywords": ["ai", "artificial intelligence", "tri tue nhan tao"],
  "aliases": ["a.i"],
  "examples": ["AI là gì?"],
  "response_id": "what_is_ai",
  "knowledge_ref": "ai_overview",
  "confidence_threshold": 0.6
}
```

- `patterns` nên viết **không dấu, viết thường** — engine chuẩn hoá input về dạng
  này trước khi match (bỏ dấu tiếng Việt, slang `ko/được/j/vs` → `không/được/gì/với`).
- `response_id` trỏ tới bộ biến thể câu trả lời trong `responses/*.json`.
- `knowledge_ref` (tuỳ chọn) trỏ tới entry trong `knowledge/*.json` — dùng cho
  các câu follow-up ("giải thích thêm", "cho ví dụ đi").

## Câu trả lời

`responses/<nhóm>.json` — mỗi `response_id` có nhiều biến thể tiếng Việt
(thêm `en` nếu muốn trả lời tiếng Anh):

```json
{
  "what_is_ai": {
    "vi": ["AI là ...", "Trí tuệ nhân tạo là ..."],
    "en": ["AI is ..."]
  }
}
```

## Lệnh chat (`commands.json`)

| Lệnh | Ai dùng | Tác dụng |
|------|---------|----------|
| `/help` `/about` `/status` `/models` `/version` `/knowledge` `/settings` `/usage` | mọi người | xem hướng dẫn, trạng thái engine, mức dùng tín dụng |
| `/clear` `/reset` | mọi người | xoá tin nhắn hội thoại (reset cả trí nhớ bot) |
| `/give <gói> <email hoặc ID>` | **chủ sở hữu** | gán gói free/plus/vip/max cho user |
| `/user <email hoặc ID>` | **chủ sở hữu** | xem thông tin user (gói, mức dùng) |
| `/pending` | **chủ sở hữu** | danh sách yêu cầu nâng cấp chờ duyệt |
| `/approve <id>` / `/deny <id>` | **chủ sở hữu** | duyệt / từ chối yêu cầu (chấp nhận ID viết tắt ≥4 ký tự) |

Lệnh đánh dấu `"owner_only": true` **không hiện** trong `/help` của user thường;
user thường gõ sẽ nhận "chỉ dành cho chủ sở hữu". Thêm lệnh mới = thêm 1 entry
(lệnh thuần dữ liệu), lệnh cần đọc/ghi DB thì code thêm handler trong
`src/lib/local-chat/admin-commands.ts`.

## Sửa dữ liệu an toàn

- **Qua API owner** (khuyến nghị): `GET /api/admin/chatbot` (stats + danh sách file),
  `GET ?file=intents/ai.json` (đọc), `PUT` (ghi — tự validate JSON + schema tối thiểu,
  chặn path traversal, ghi atomic). Test thử câu: `POST /api/admin/chatbot/test`.
- **Sửa tay file**: lưu UTF-8, giữ nguyên cấu trúc mảng/object — engine tự nạp lại.
- Mọi file intents/responses/knowledge phải là mảng/object JSON hợp lệ; engine
  ghi cảnh báo vào `/api/admin/chatbot` (`warnings`) nếu file hỏng mà vẫn đọc được.

## Vận hành

- Engine giữ cache in-memory + chỉ số tìm kiếm — chạy được máy yếu.
- Sau khi **đổi code engine** (không phải data): restart dev server — instance
  engine được cache trong globalThis của process.
- Kiểm tra nhanh: `bash scripts/test-local-chat.sh` (47 checks qua HTTP thật).
