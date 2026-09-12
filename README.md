# KhanhOS AI

> Nền tảng AI thế hệ mới — chat, tạo, khám phá cùng trí tuệ nhân tạo.

KhanhOS AI là một web app AI hoàn chỉnh **thật** (không mock): chat streaming với markdown & code highlighting, tài khoản thật (đăng ký / đăng nhập / quên mật khẩu / reset), lịch sử hội thoại lưu database, **tích hợp 3 API AI: Cerebras + OpenRouter + Google Gemini**, model registry, dark/light mode, tìm kiếm web tích hợp và kiến trúc provider abstraction sẵn sàng cắm model KhanhOS riêng.

---

## ✨ Tính năng

### Trải nghiệm
- **Landing page hoàn chỉnh** — hero (AI Orb + tagline động + composer), features, CTA, footer; mọi nút đều có tác dụng thật (CTA focus composer, Login mở auth). **Landing chỉ hiển thị cho khách chưa đăng nhập** — đã đăng nhập thì trang chủ chỉ còn khung chat + hiệu ứng (theo yêu cầu owner), hết landing khi logout tự hiện lại.
- **Home tối giản có chiều sâu** — AI Orb (canvas, ~48 hạt, parallax theo chuột có smoothing, tôn trọng `prefers-reduced-motion`), theme-aware (teal đậm hơn ở light mode).
- **Dark / Light mode** — toggle nhanh ở TopBar + chọn trong Settings (Tối / Sáng / Hệ thống), **lưu vào PostgreSQL/DB theo tài khoản**, đồng bộ lại khi đăng nhập ở thiết bị khác.
- **Home → Chat transition mượt** — không reload trang; tin nhắn đầu tiên biến Home thành giao diện chat (framer-motion).
- **Composer** — glass, focus glow, auto-resize, Enter gửi / Shift+Enter xuống dòng.
- **Nút `+`** — mở menu Model / File / Web / Tools (glass, slide-fade, click-outside đóng). Model KHÔNG hiển thị mặc định — đúng theo thiết kế.
- **Streaming thật** — SSE từng token, con trỏ nhấp nháy, nút Stop giữa chừng (lưu phần đã sinh), Regenerate.
- **Markdown + code** — GFM tables, code block syntax highlighting (Prism), language label + nút Copy code, code đọc được trên mobile.
- **Sidebar** — trượt từ trái + overlay: Chat mới, **tìm kiếm hội thoại**, lịch sử từ DB kèm relative timestamp, **đổi tên inline**, xoá, Home, Tài khoản, Cài đặt, Đăng xuất; mobile touch + safe-area.
- **Chưa đăng nhập vẫn gõ được** — bấm gửi → modal "Đăng nhập để bắt đầu trò chuyện"; sau khi login, tin nhắn chờ được **tự động gửi**. Backend cũng chặn anonymous (401).
- **Responsive** — PC / laptop / tablet / Android / iPhone, không horizontal overflow (đã test 390px).

### Tài khoản & Bảo mật
- Đăng ký / đăng nhập / đăng xuất — session server-side (httpOnly cookie; DB chỉ lưu **HMAC-SHA256(token, AUTH_SECRET)**).
- **Chính sách mật khẩu**: tối thiểu **4 ký tự**, tối đa **128 ký tự** — không bắt buộc chữ số/chữ cái/ký tự đặc biệt (theo yêu cầu owner). Áp dụng thống nhất ở server (zod) và client.
- **Phân vai (`User.role`)**: mặc định `user`; owner được gắn `role = "owner"` và hiển thị huy hiệu **Chủ sở hữu** (Crown) trong modal Tài khoản.
- **Quên mật khẩu đầy đủ**: email → token random 32 bytes (hash HMAC, hạn 60 phút, dùng 1 lần) → link `/reset-password?token=...` → mật khẩu mới → mọi session cũ bị vô hiệu hoá.
- Password hash bằng **scrypt** (node:crypto) — không bao giờ lưu plaintext.
- **Authorization mọi route**: user A không đọc/xoá/sửa/đổi-tên hội thoại của user B (check ownership ở tầng query).
- Rate limiting: login, register, password reset, chat (sliding window in-memory; kiến trúc sẵn cho remote store khi scale).
- Validation toàn bộ input (zod) + CSRF same-origin check cho mutating requests.
- Thông báo lỗi chung khi login sai (chống user-email enumeration).
- **ACCOUNT**: trang/modal tài khoản hiển thị tên, email, ngày tham gia, ID + **sửa tên hiển thị thật** (`PATCH /api/user`).

### 💎 Gói dịch vụ & hạn mức (Free / Plus / VIP / Max)
- **4 gói theo yêu cầu chủ sở hữu** (sửa 1 dòng trong `src/lib/plans.ts` — UI + API tự theo):

  | Gói | Hạn mức tín dụng/tháng | Giá | Điểm nổi bật |
  |-----|--------------------------|------|----------------|
  | Free | 25.000 | 0đ | Model KhanhOS Core, lưu hội thoại mãi mãi |
  | Plus | 85.000 | 55.000đ | Mọi model khả dụng, ưu tiên hàng đợi |
  | VIP | 256.000 | 99.000đ | Ưu tiên cao, tệp đính kèm & hội thoại dài |
  | Max | 500.000 | 159.000đ | Ưu tiên tối đa, hỗ trợ từ chủ sở hữu |

- **UI KHÔNG hiển thị chữ "token"** — hạn mức hiển thị dưới dạng **"tín dụng"** (25.000 tín dụng mỗi tháng…), kể cả thông báo hết hạn mức khi chat. (VIP từng được owner nói 2 số 128k/256k — bản chốt lấy 256k, đổi 1 dòng nếu cần.)
- **Hạn mức chặn chat thật**: dùng hết tháng → `402` + thông báo "Bạn đã dùng hết … tín dụng của gói … — Mở menu ≡ → Gói & Nâng cấp". Làm mới mùng 1 mỗi tháng (calendar month). **Chủ sở hữu không bị giới hạn.** Mức dùng = ước lượng phản hồi + ngữ cảnh (≈4 ký tự/đơn vị, lưu `Message.tokens`).
- **Luồng nâng cấp thủ công qua MoMo / chuyển khoản**: chọn gói → form thu **SĐT + số MoMo + Gmail + ghi chú** → chủ TK **HOANG BAO KHANH**, STK **`000000`** (placeholder — owner chưa có STK; đổi qua env `PAYMENT_ACCOUNT_NAME` / `PAYMENT_ACCOUNT_NUMBER`) → chủ sở hữu duyệt trong modal Gói → `user.plan` đổi ngay.
- API: `GET /api/plans` (công khai + usage cá nhân) • `POST /api/plan-requests` (rate limit 3/10'/IP, 1 yêu cầu chờ/user) • `GET /api/plan-requests` + `PATCH /api/plan-requests/[id]` (owner duyệt/từ chối).
- Entry UI: menu tài khoản + sidebar + modal Tài khoản ("Gói & Nâng cấp") + **nút "Gói dịch vụ" trên top bar cho khách** (mở form đăng ký khi bấm chọn gói).

### 🤖 Bộ máy chat 100% cục bộ (Local Chat Engine)
- **KHÔNG gọi API AI bên ngoài** (Cerebras/OpenRouter/Gemini/OpenAI/Anthropic đã gỡ hoàn toàn) — **không cần API key**, không gửi dữ liệu user đi đâu. Mọi câu trả lời đến từ `data/chatbot/*.json` — thêm/sửa kiến thức không đụng code (xem `data/chatbot/README.md`).
- **Pipeline**: chuẩn hoá (bỏ dấu tiếng Việt, slang `ko→không`, `dc→được`, `j→gì`, `vs→với`…) → phát hiện ngôn ngữ (VN chính / EN phụ / mixed) → phát hiện intent (pattern + keyword + alias, có context hội thoại multi-turn) → tìm tri thức local → **chấm điểm** (exact +100, chứa pattern +90, keyword +20/cái, alias +15, context +25; ngưỡng ~0,60) — thấp hơn ngưỡng thì chuyển sang MODEL AI cục bộ (nếu có runtime) hoặc nói thẳng **"chưa có kiến thức local"**, KHÔNG bịa.
- **Trí nhớ hội thoại giới hạn**: intent/chủ đề/từ khoá của lượt gần nhất → trả lời được các câu bám ngữ cảnh ("AI là gì?" → "thế local AI?" → "có cần API không?").
- **Lệnh chat**: `/help /about /status /models /version /knowledge /settings /usage /clear /reset` cho mọi người — xem đầy đủ trong bảng lệnh ở `data/chatbot/README.md`.
- **Lệnh chỉ dành cho chủ sở hữu** (user thường không thấy trong `/help`, gõ sẽ bị chặn):
  - `/give <free|plus|vip|max> <email hoặc ID>` — gán gói trực tiếp (email không phân biệt hoa/thường)
  - `/user <email hoặc ID>` — xem gói + mức dùng + ngày tham gia của user
  - `/pending` → `/approve <id>` / `/deny <id>` — duyệt yêu cầu nâng cấp ngay trong chat (chấp nhận ID viết tắt)
- Response API kèm `source: "local-rules" | "local-model"`, `intent`, `confidence`, `metrics` (đo thật) — minh bạch về nguồn trả lời.

### 🧠 HỆ AI CỤC BỘ THẬT (src/ai/) — model suy luận thật, vẫn không API ngoài
- **2 lớp:** (1) **Bộ máy tri thức** `src/lib/local-chat/` trả lời tức thì cho lệnh/FAQ/intent khớp; (2) **Model AI cục bộ** qua `src/ai/` suy luận TỰ DO cho câu hỏi ngoài tri thức — chạy bằng **Ollama / llama.cpp / vLLM local** (chỉ chấp nhận endpoint loopback, xem `AI_ALLOW_REMOTE`).
- **Bật model thật:** `bash scripts/setup-ollama.sh` — tải Ollama + pull `qwen2.5:0.5b` (mặc định, vừa RAM 4GB) + daemon hoá + verify inference. Không có runtime? App tự dùng lớp tri thức và nói rõ điều đó trong fallback — **không fake suy luận**.
- **Pipeline suy luận thật** (`ReasoningEngine`): làm sạch input (che secret) → phân loại nhiệm vụ + độ phức tạp (`ModelRouter`: TRIVIAL→FAST, code→CODING, phân tích→REASONING…) → thu thập ngữ cảnh (memory nhiều lớp + tri thức local làm RAG-lite) → **tool calculator chạy thật** khi câu có phép tính → **stream model thật** (TTFT/tok-s đo thật) → **tự kiểm tra** (VerifierEngine: rỗng/cắt giữa chừng/sai ngôn ngữ/mirror/lộ secret) → tự sửa nếu fail (giới hạn vòng) → làm sạch output.
- **Status UI thật**: "Đang phân tích câu hỏi…", "Đang chạy công cụ…", "Đang kiểm tra kết quả…" — tương ứng giai đoạn đang chạy thật, KHÔNG lộ chain-of-thought riêng tư.
- **Model abstraction** (`ModelAdapter`): `OllamaAdapter` (native) + `OpenAICompatAdapter` (llama.cpp/vLLM/LM Studio) — thêm runtime mới không đụng UI. Model profiles: GENERAL / REASONING / CODING / FAST / LONG_CONTEXT / AGENT.
- **Memory nhiều lớp**: conversation (DB) + session (TTL 6h) + long-term (`AiMemory` bảng mới — lệnh "hãy ghi nhớ rằng…") + project (`data/ai/project-memory.json`, sửa không đụng code) — luôn rank theo liên quan trước khi đưa vào prompt.
- **Tool system** (`src/ai/tools/`): calculator (tokenizer riêng an toàn, KHÔNG eval), datetime, json_parser, text_processor, random (crypto) — permission levels, timeout, log DB (`AiToolExecution`). Tool ghi file/terminal CHƯA bật mặc định (`AI_ENABLE_UNSAFE_TOOLS=false`).
- **Safety**: che secret ở input VÀ output, chống prompt-injection cơ bản, chặn path traversal, bảo vệ env. Diagnostics owner: `GET /api/admin/ai` (latency, tok/s, tool logs, verification — không lộ secret).

### 🚀 HỆ AI NÂNG CAO (RAG thật + Huấn luyện + Trí nhớ + Persona)
- **RAG thật 100% local** (`src/ai/knowledge/`): user nạp tài liệu → cắt chunk theo ranh giới câu → **nhúng vector thật bằng model embedding local** (`nomic-embed-text`, 768 chiều, qua Ollama) → lưu `KnowledgeDocument`/`KnowledgeChunk` → truy vấn = nhúng câu hỏi + **cosine similarity** → top-k làm ngữ cảnh cho model. Test UI: AI Studio → Tri thức.
- **Vòng lặp học từ phản hồi** (EVALUATION → FEEDBACK → TRAINING DATASET): nút 👍/👎 dưới mỗi câu trả lời → bảng `AiFeedback` (snapshot hỏi–đáp) → comment có tính chất góp ý vào long-term memory → owner **xuất dataset JSONL** (định dạng Alpaca/ShareGPT) từ các phản hồi 👍 → dữ liệu huấn luyện THẬT, nguồn gốc rõ ràng.
- **Huấn luyện LoRA/QLoRA** (`src/ai/training/`): owner tạo job → hệ sinh **bộ script Python thật** (`train_lora.py` dùng transformers + peft + bitsandbytes, `merge_and_export.py`, `Modelfile`, `requirements.txt`) trong `data/ai/training/jobs/<id>/`. Server không có Python+torch → job ở trạng thái **"chờ runtime"** (trung thực — KHÔNG fake kết quả huấn luyện); chạy bộ script trên máy có GPU để có adapter thật.
- **Model registry cấu hình được**: `data/ai/models.json` + env `MODEL_PATH` / `MODEL_TYPE` / `MODEL_FORMAT` (gguf|transformers|gptq|awq|bnb) / `CONTEXT_LENGTH` — khai báo model không sửa code; `/api/models` trả kèm trạng thái model embedding + registry.
- **Persona thích ứng "Astra"** (`data/ai/personality.json`): theo chỉ thị chủ sở hữu — persona giỏi code, phong cách assistant thế hệ mới. TRUNG THỰC: đây là lớp cấu hình prompt-level (không phải neural training); muốn đổi weights thật → dùng hệ Training ở trên.
- **Routing thông minh hơn**: yêu cầu TẠO TÁC (viết hàm/code, fix bug…) luôn đi model suy luận kể cả khi tri thức khớp — tri thức chỉ giải thích ngôn ngữ, không viết code giúp user.
- **API nội bộ mới**: `/api/knowledge` (+`/search`), `/api/feedback`, `/api/memory` (GET/PATCH/DELETE), `/api/training` (owner-only) — tất cả gọi model/local, không proxy ra ngoài.

### Routes
| Trang | Mô tả |
|-------|-------|
| `/` | Landing + Home (composer, chưa login vẫn gõ được) + **effects layer** (particle network, beams, spotlight, grain) |
| `/login` `/register` `/forgot-password` | Trang auth riêng (SEO + deep-link) |
| `/reset-password` | Nhập mật khẩu mới (`?token=` từ email) |
| `/chat` | Giao diện chat |
| `/chat/[id]` | Mở hội thoại cụ thể (deep-link, có authorization) |
| `/settings` | Cài đặt (yêu cầu login — tự mở modal login nếu chưa) |
| `/account` | Tài khoản (yêu cầu login) |

### 🖤 IRON FORGE — thương hiệu phòng tập cao cấp
> **ĐÃ GỦ KHỎI TRANG CHỦ theo yêu cầu chủ sở hữu** (component giữ trong `src/components/fitness/` — gắn lại bằng 1 dòng `<FitnessSite />` trong `home-hero.tsx` khi cần). Các test dưới đây được ghi nhận khi section còn hoạt động.

Thiết kế "Obsidian hardcore": đen thuần + cam neon `#ff5c1a` + bạc kim loại, ảnh đen trắng tương phản cao (người là chủ thể), typography đậm uppercase, mật độ thông tin cao.

- **Hero**: reel slow-motion đen trắng tự chạy (Ken Burns, crossfade), **bấm "Bật âm" → voiceover thật phát** (TTS), brand attitude + stats + dải HLV.
- **Curriculum**: 3 lộ trình theo mục tiêu (Tăng cơ / Giảm mỡ / Thể lực) — giai đoạn, tần suất, đo lường, giá.
- **Coaches**: 4 thẻ HLV **lật 3D** (hover/tap) → chứng chỉ quốc tế, background, bài tập chữ ký.
- **Member Stories**: carousel **tự chạy + kéo- kéo- thả có rubber-band** (framer-motion drag + elastic), số liệu chuyển hoá thật.
- **Booking**: CTA pulse + **sticky bottom bar** khi cuộn qua; form đặt lịch **lưu thật DB** (`POST /api/trial-booking`, zod + rate limit 3/10'/IP, SĐT VN chuẩn hoá `+84→0`).
- **Micro-interactions**: scroll reveal stagger, marquee brand strip, grain texture parallax — toàn bộ tôn trọng `prefers-reduced-motion`.
- Ảnh thật từ image-search (đã VLM lọc watermark), đặt tại `public/fitness/`.

---

## 🏗 Kiến trúc

```
Frontend (Next.js 16, App Router)
        ↓  fetch + SSE
API Routes (/api/auth/*, /api/chat, /api/chats/*, /api/models, /api/settings, /api/user,
            /api/plans, /api/plan-requests, /api/admin/chatbot, /api/admin/ai)
        ↓
Authentication (session cookie) → Authorization (ownership checks)
        ↓
ĐỊNH TUYẾN /api/chat:
  ├─ Lệnh /xxx            → Local Chat Engine (deterministic, không tốn model)
  ├─ Intent khớp ≥ 0.60    → Local Chat Engine (fast path — tri thức đảm bảo đúng)
  └─ Còn lại (câu tự do)   → src/ai/ ReasoningEngine (model cục bộ THẬT)

Local Chat Engine (src/lib/local-chat/)
        ├── IntentEngine     — pattern/keyword/alias + context multi-turn
        ├── KnowledgeEngine  — tìm + soạn câu trả lời từ tri thức local
        ├── CommandEngine    — lệnh /help /clear... (phân quyền owner_only)
        ├── AdminCommands    — /give /user /pending /approve /deny (DB)
        ├── ContextEngine    — trí nhớ hội thoại (TTL 6h)
        └── data/chatbot/*.json — intents/responses/knowledge/commands/aliases

HỆ AI CỤC BỘ (src/ai/)
        ├── core/            — types + config + TokenManager (ước lượng trung thực)
        ├── inference/       — ModelAdapter (Ollama native + OpenAI-compat local)
        │                       + RuntimeDetector (probe + cache) + InferenceEngine
        │                       (streaming thật, retry, abort, TTFT/tok-s đo thật)
        ├── models/          — profiles (GENERAL/REASONING/CODING/FAST/…) + ModelRouter
        ├── reasoning/       — pipeline đa giai đoạn + VerifierEngine (tự kiểm tra)
        ├── context/         — ContextManager (ngân sách, cắt lịch sử cũ trước)
        ├── memory/          — conversation + session + long-term (DB) + project (JSON)
        ├── tools/           — calculator/datetime/json/text/random + permission + log DB
        ├── prompts/         — module hoá: base/mode/tool/memory/safety + compose
        ├── safety/          — che secret 2 chiều, chống injection, path traversal
        └── observability/   — diagnostics (latency, tok/s, tool, verification)
        ↓
Runtime model local (Ollama 127.0.0.1:11434 / llama.cpp — CHỈ loopback)
        ↓
Prisma ORM → Database (SQLite dev / PostgreSQL production)
```

**Đổi model / runtime:** sửa `AI_MODEL`/`OLLAMA_BASE_URL` trong `.env` (hoặc chạy
`bash scripts/setup-ollama.sh`) — UI + API + tri thức không đổi. Muốn model mạnh hơn
(GPT-OSS/Qwen lớn/DeepSeek/GLM): cài vào Ollama rồi đổi `AI_MODEL` — phần còn lại tự thích ứng.

### Cấu trúc thư mục

```
khanhos-ai/
├── prisma/
│   ├── schema.prisma            # SQLite (dev/sandbox) — users, sessions, conversations,
│   │                            #   messages, user_settings (kèm theme), password_reset_tokens
│   ├── schema.postgres.prisma   # PostgreSQL (production) — cùng model
│   └── postgres-migration.sql   # DDL sinh sẵn để áp PostgreSQL
├── scripts/switch-to-postgres.sh  # chuyển provider + generate (xem mục Database)
├── data/chatbot/                 # DỮ LIỆU bộ máy chat (xem data/chatbot/README.md):
│   │                             #   intents/ responses/ knowledge/ faq/ commands
│   │                             #   aliases/ topics/ system.json — sửa file = sửa tri thức bot
├── db/                            # SQLite database (dev)
├── public/icon.svg                # favicon KhanhOS
├── src/
│   ├── app/
│   │   ├── page.tsx               # SPA root (Home ↔ Chat, không reload)
│   │   ├── login|register|forgot-password|reset-password/   # trang auth riêng
│   │   ├── chat/[id]/             # deep-link hội thoại
│   │   ├── settings/ account/     # trang bảo vệ (mở modal tương ứng)
│   │   ├── layout.tsx             # fonts + ThemeProvider (next-themes)
│   │   ├── globals.css            # design system: Obsidian (dark) + Porcelain (light)
│   │   └── api/
│   │       ├── auth/              # register, login, logout, me, forgot-password, reset-password
│   │       ├── chat/              # POST streaming SSE
│   │       ├── chats/             # CRUD + [id] ownership check + rename
│   │       ├── models/            # model registry public
│   │       ├── settings/          # user settings (theme, model, web search, motion)
│   │       └── user/              # profile (GET/PATCH name)
│   ├── components/
│   │   ├── app/                   # KhanhOSApp, TopBar (theme toggle), AIOrb, BackgroundAura
│   │   ├── home/                  # HomeHero, LandingSections (features/CTA/footer)
│   │   ├── composer/              # ChatComposer, PlusMenu, ModelSelector
│   │   ├── chat/                  # ChatView, MessageBubble, MarkdownContent
│   │   ├── sidebar/               # AppSidebar (search + rename inline)
│   │   ├── auth/                  # AuthModal, Login/Register/Forgot forms
│   │   ├── account/               # AccountModal (sửa tên)
│   │   ├── settings/              # SettingsModal (giao diện/model/web/motion)
│   │   ├── theme/                 # ThemeProvider, ThemeSync
│   │   └── ui/                    # shadcn/ui components
│   ├── hooks/                     # useMouseParallax (lerp), use-toast, use-mobile
│   ├── lib/
│   │   ├── auth/                  # password (scrypt), session, reset-token, pepper (AUTH_SECRET)
│   │   ├── security/              # rate-limit, origin (CSRF), validation (zod)
│   │   ├── local-chat/           # BỘ MÁY CHAT CỤC BỘ: chat-engine (abstraction),
│   │   │                         #   local-rule-engine, intent/knowledge/context/
│   │   │                         #   response/command engine, admin-commands (/give...)
│   │   ├── email/                 # EmailService abstraction (dev log / Resend)
│   │   ├── api-helpers.ts         # guard() dùng chung mọi route
│   │   └── db.ts                  # Prisma client
│   ├── store/                     # zustand: auth, chat (SSE client), ui
│   └── types/chat.ts              # shared client types
└── .env.example
```

---

## 🛠 Tech Stack

| Tầng | Công nghệ |
|------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Ngôn ngữ | TypeScript 5 (strict) |
| UI | Tailwind CSS 4, shadcn/ui, framer-motion, lucide-react, next-themes |
| State | Zustand |
| Database | Prisma ORM — **SQLite** (dev/sandbox) ↔ **PostgreSQL** (production, Supabase/Neon) |
| Auth | Session tự viết: scrypt + httpOnly cookie + DB sessions (HMAC với AUTH_SECRET) |
| AI | **Local Chat Engine** — intent + tri thức từ `data/chatbot/*.json`, không API ngoài, không cần key |
| Validation | Zod |

---

## 🚀 Chạy local

```bash
# 1. Cài dependencies
bun install        # hoặc npm install

# 2. Cấu hình môi trường
cp .env.example .env
#   (mặc định đã chạy được: SQLite + model khanhos qua SDK)

# 3. Khởi tạo database
bun run db:push

# 4. Chạy dev
bun run dev        # hoặc npm run dev → http://localhost:3000

# 5. Kiểm tra chất lượng
bun run lint       # ESLint (sạch)
bunx tsc --noEmit  # TypeScript (sạch)

# 6. Test backend đầy đủ
bash scripts/test-local-chat.sh       # Local chat engine + lệnh owner (47 checks)
bash scripts/test-owner-register.sh   # Chính sách owner 2 email (19 checks)
bash scripts/test-plans.sh            # Gói dịch vụ + quota (34 checks)
bash scripts/test-ai-advanced.sh       # RAG + feedback + training + memory (25 checks)

# 7. Build production (khi deploy)
bun run build && bun run start
```

### Tài khoản owner (đã seed sẵn)

| Email | Mật khẩu | Vai trò |
|-------|----------|---------|
| `hoangbaokhanhhehe@gmail.com` | `khanh0712014@#` | **owner** (Chủ sở hữu) |
| `haongbaokhanhhehe@gmail.com` | `khanh0712014@#` | **owner** (Chủ sở hữu) |

> Hai email là hai cách viết của cùng một người chủ (hoang/haong). Owner **không bị giới hạn mức dùng** (vô hạn — modal hiển thị "Chủ sở hữu (không giới hạn)"), và là người duyệt yêu cầu nâng cấp gói. Khi biết chắc email thật: sửa `OWNER_EMAIL` trong `.env`, xoá email sai, chạy lại seed — không cần sửa code.

Tạo lại / reset bất cứ lúc nào (idempotent, seed TẤT CẢ email trong OWNER_EMAIL):

```bash
bun run db:seed-owner
```

> `OWNER_EMAIL` nhận **nhiều email cách nhau bằng dấu phẩy**. Production nên override bằng env `OWNER_EMAIL` / `OWNER_PASSWORD` / `OWNER_NAME` rồi chạy seed 1 lần, sau đó đổi mật khẩu qua flow quên mật khẩu. Gặp lỗi "Email hoặc mật khẩu không đúng" bất thường (DB sandbox thỉnh thoảng bị reset) → chạy lại `bun run db:seed-owner`.

---

## 🐘 Database: SQLite (dev) ↔ PostgreSQL (production)

Sandbox không chạy được PostgreSQL nên demo dùng SQLite — nhưng **cùng một Prisma schema và cùng code client**. Khi deploy lên Vercel:

1. Tạo PostgreSQL: **Supabase** / **Neon** / Vercel Postgres → copy connection string.
2. Sửa `.env`:
   ```env
   DATABASE_URL="postgresql://user:pass@host:5432/khanhos?schema=public"
   ```
3. Chạy:
   ```bash
   ./scripts/switch-to-postgres.sh        # đổi schema + prisma generate
   bunx prisma migrate dev --name init   # tạo bảng
   ```
   (hoặc áp SQL thủ công từ `prisma/postgres-migration.sql` qua SQL editor của Supabase/Neon)
4. Build & deploy. **Code ứng dụng không đổi dòng nào.**

> App không phụ thuộc máy cá nhân online — database là dịch vụ remote, app chạy trên Vercel.

---

## 🔐 Biến môi trường

Xem đầy đủ trong [`.env.example`](./.env.example). Tóm tắt:

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `DATABASE_URL` | ✅ | SQLite dev / PostgreSQL production |
| `CHAT_ENGINE` | ⬜ | Engine chat (mặc định `local-rule`; tương lai `ollama`/`llama-cpp`) |
| `AUTH_SECRET` | ⬜ | Pepper HMAC cho session/reset token (production NÊN đặt; đổi = logout toàn bộ) |
| `APP_URL` | ⬜ | Domain thật để sinh link reset mật khẩu |
| `OWNER_EMAIL` | ⬜ | Email chủ sở hữu (nhiều email cách phẩy) — seed + tự nhận role owner khi đăng ký |
| `EMAIL_PROVIDER` / `RESEND_API_KEY` | ⬜ | Gửi email reset thật (mặc định `dev` — log ra console + `email-outbox.log`) |
| `PAYMENT_ACCOUNT_NAME` / `PAYMENT_ACCOUNT_NUMBER` | ⬜ | Chủ TK + STK thanh toán gói (mặc định HOANG BAO KHANH / 000000) |

**Lưu ý**: KHÔNG cần bất kỳ API key AI nào (Cerebras/OpenRouter/Gemini/OpenAI/Anthropic đã gỡ hoàn toàn theo yêu cầu chủ sở hữu).

---

## 📊 Database Schema

```
User 1─1 UserSettings            (defaultModelId, webSearchEnabled, reducedMotionPref, theme)
User 1─* Session                  (id = HMAC-SHA256(token, AUTH_SECRET), expiresAt)
User 1─* Conversation 1─* Message (role, content, modelId, attachments JSON, sources JSON)
User 1─* PasswordResetToken       (id = HMAC hash, expiresAt 60', usedAt — one-time)
```

Mọi truy vấn conversation đều lọc `userId` — authorization ở tầng query, không chỉ ở UI.

---

## 🧪 Đã kiểm thử

- **Backend (curl, 29/29 PASS)**: register (validation + duplicate) → session persist → login sai/đúng → **chat SSE stream (meta/delta/done + lưu DB)** → chats CRUD + **rename** → **IDOR: user B không đọc/xoá được chat user A** → anonymous bị 401 → model thiếu key bị chặn kèm hướng dẫn CEREBRAS_API_KEY → **theme lưu/đọc DB + chặn giá trị sai** → **PATCH /api/user đổi tên** → forgot → **reset link `/reset-password?token=`** → mật khẩu mới login được, cũ bị vô hiệu → logout huỷ session → rate limit 429.
- **Backend mới (curl, 13/13 PASS — `scripts/test-owner-policy.sh`)**: chính sách mật khẩu 4–128 (3 ký tự bị chặn, 4 ký tự chỉ chữ OK, 128 chỉ số OK, 129 bị chặn) → **login owner + role=owner** → sai pass 401 → me trả role → guard với SessionUser mới → logout → rate limit 429.
- **Multi-provider (44/44 + 12/12 PASS)**: `scripts/test-provider-routing.ts` chạy fake SSE server local, xoay env 7 case — chứng minh định tuyến Cerebras/OpenRouter/Gemini/direct đúng thứ tự ưu tiên, badge động, hint key, header OpenRouter (X-Title/HTTP-Referer), parse SSE bỏ comment `: OPENROUTER PROCESSING`. `scripts/test-multi-provider.sh`: guard chat hiện đúng tên key cần thêm (claude→OPENROUTER, gemini→GEMINI, qwen→CEREBRAS), model lạ 404, streaming khanhos-core thật, /api/models 10 model + badge.
- **Browser (agent-browser + VLM)**: Home render (VLM review tốt), dark/light toggle (VLM xác nhận tương phản đạt), đăng ký → streaming chat VN + code block + copy, sidebar (lịch sử + **rename inline** + timestamp), **Settings đổi theme lưu DB**, **deep-link `/chat/[id]` mở đúng hội thoại**, `/login` redirect khi đã login, `/settings` mở modal, **CTA landing focus composer**, mobile 390px không tràn ngang, console 0 lỗi (đã fix hydration mismatch).
- **Browser mới (owner E2E)**: login `hoangbaokhanhhehe@gmail.com` → redirect Home → **modal Tài khoản hiện huy hiệu CHỦ SỞ HỮU** → chat streaming thật ("2+2 = 4") → form đăng ký chặn 3 ký tự + **đăng ký thành công với mật khẩu 4 ký tự chỉ chữ** → console 0 lỗi.
- **Origin/CSRF (5 kịch bản curl)**: qua proxy preview, browser thật gửi `Sec-Fetch-Site: same-origin` → 200 (fix lỗi "Yêu cầu không hợp lệ (origin)" khi login qua preview link); `cross-site` → 403; giả mạo `X-Forwarded-Host` qua gateway → 403 (Caddy sanitize); curl thuần → không bị chặn. Lớp 1 dùng Fetch Metadata (browser tự sinh, không spoof được), lớp 2 fallback so khớp Host + X-Forwarded-Host.
- **IRON FORGE (curl 9/9 PASS — `scripts/fitness/test-trial-booking.sh`)** *(khi còn gắn)*: booking hợp lệ 200 + id, **SĐT +84/84 → chuẩn hoá về 0**, SĐT sai 400, goal lạ 400, tên ngắn 400, **CSRF cross-site 403**, **rate limit 429 (3 lần/10'/IP)**, lưu DB thật (Prisma).
- **IRON FORGE (browser E2E + VLM)**: hero reel đen trắng tự chuyển cảnh (hero-5 → hero-6) + **âm thanh thật phát khi bấm "Bật âm"** (voiceover TTS, replay-able); scroll reveal stagger; **thẻ HLV lật 3D** (rotateY 180°, hiện chứng chỉ); **carousel kéo- kéo- thả + rubber-band** (kéo 900px vượt mép → đàn hồi nén còn +88px, thả ra snap về 0) + auto-advance 5.5s (pause khi hover); **sticky bottom bar** đúng logic (ẩn trên landing → hiện trong fitness → ẩn tại booking); **form đặt lịch gửi → lưu DB → state thành công**; 23/23 ảnh load; mobile 390px không tràn ngang; VLM review 4 screenshot: "bố cục chặt, typography mạnh, hardcore-luxury, không lỗi hiển thị"; console 0 lỗi sau khi fix hydration mismatch (portal render sau mount bằng useSyncExternalStore).
- **Chat sau origin fix**: browser gửi tin nhắn → stream "1 + 1 = 2" OK (POST /api/chat đi qua lớp kiểm tra origin mới).
- **Effects layer (E2E browser)**: IRON FORGE gỡ khỏi trang chủ (DOM verify: không còn "RÈN THÉP"/booking); particle network canvas + 4 tia sáng + grain + shimmer + 7 card glow render đủ; **spotlight bám chuột** (opacity 1, translate3d theo lerp); **chiều sâu scroll** (scroll 1000px → hero opacity 0.2 + scale 0.94 + translateY -48px); reveal landing có blur; mobile 390px không tràn ngang; light mode đổi màu hiệu ứng theo theme; chat streaming vẫn chạy với effects; console 0 lỗi sau khi fix (1) parse lỗi trung gian HMR, (2) useScroll theo window → đổi sang listener trực tiếp container `[data-home-scroll]` + motion value.
- **Gói dịch vụ (34/34 PASS — `scripts/test-plans.sh`)**: /api/plans công khai đúng 4 gói + giá + hạn mức + **KHÔNG chứa chữ "token"** → đăng ký ⇒ plan=free (limit 25.000) → form nâng cấp **bắt buộc SĐT + MoMo + Gmail** (thiếu MoMo 400, sai định dạng 400, trùng pending 409, DB lưu MoMo) → owner duyệt ⇒ user.plan=plus + limit 85.000 (duyệt lại 409, yêu cầu gói đang dùng 400) → **chat 402 khi hết hạn mức** (thông báo dùng chữ "tín dụng", không chữ "token") → chat thật ghi mức dùng > 0 → owner chat không bị chặn dù vượt hạn mức. Regression `test-owner-register.sh` 13/13 PASS lại.
- **Gói dịch vụ (browser E2E)**: khách thấy nút "Gói dịch vụ" top bar → modal 4 gói + giá 55.000đ/99.000đ/159.000đ + "tín dụng" + thanh toán HOANG BAO KHANH/000000 (body KHÔNG có chữ token/demo) → login user → usage bar "0 / 25.000 tín dụng" → form Plus: SĐT + **MoMo** + Gmail + note → "ĐÃ GHI NHẬN!" → banner "đang chờ duyệt" → **owner duyệt trong modal** → badge "ĐÃ DUYỆT" + DB `user.plan=plus` → chat regression "2+2 = 4" → mobile 390px không tràn → console 0 lỗi.
- **Local Chat Engine + lệnh owner (47/47 PASS — `scripts/test-local-chat.sh`)**: đăng ký → chat SSE `intent/confidence/source` đúng ("AI la gi" → `what_is_ai` conf 1) → **follow-up multi-turn** ("thế local AI?" → `what_is_local_ai`, "có cần api không?" → `local_ai_without_api`) → từ bịa → **fallback null + nói thẳng không có dữ liệu** (khi không có model runtime) → `/knowledge` → `/clear` **xoá sạch DB (0 message)** → regenerate đổi biến thể → **chat 402 khi hết hạn mức (dùng chữ "tín dụng")** → admin tri thức owner-only (user 403, JSON hỏng 400, path traversal 400) → **round-trip sửa file data** → **lệnh owner đầy đủ** (xem mục trên).
- **Local Chat Engine (browser E2E)**: owner login → gõ `/help` trong chat → hiện mục "Lệnh chỉ dành cho chủ sở hữu" → `/give plus <email user>` qua chat UI → DB `user.plan=plus` ngay → console 0 lỗi.
- **HỆ AI CỤC BỘ (25/25 PASS — `scripts/test-ai-engine.sh`, cần Ollama chạy)**: `/api/models` hiện runtime model thật (badge "Model cục bộ") → câu tự do ("có thể suy nghĩ giống chatgpt ko") **đi qua model thật** — `source:"local-model"` + status pipeline (Đang phân tích/Đang kiểm tra) + **metrics thật** (TTFT, totalMs, tok/s từ Ollama) → chọn model `runtime:qwen2.5:0.5b` trực tiếp → intent khớp cao vẫn trả bằng tri thức (fast path, không tốn model) → lệnh `/help` vẫn chạy khi model bật → **tool calculator chạy thật** "(128*46)+99 = 5987" + log DB `AiToolExecution` → **lệnh "hãy ghi nhớ rằng…" lưu AiMemory** → verification event + abort giữa stream không sập server → `/api/admin/ai` owner-only (user 403) + không lộ secret → **API key nhét vào input bị che, không lọt output**.
- **HỆ AI NÂNG CAO (25/25 PASS — `scripts/test-ai-advanced.sh`, cần Ollama + nomic-embed-text)**: `/api/models` trả embedding status (dim 768) + model registry → nạp tài liệu → **DB lưu vector thật 768 chiều** → truy vấn "giám đốc"/**"doanh thu 2025"** → đúng chunk (cosine > 0.3) → chat hỏi về tài liệu đã nạp chạy RAG không crash → **feedback 👍** lưu AiFeedback + stats (message lạ 400, rating sai 400) → comment góp ý vào trí nhớ dài hạn → `/api/memory` list + xoá → `/api/training` user thường 403 / owner **export JSONL** (instruction+output mỗi dòng) → **tạo job LoRA** sinh `train_lora.py` (chứa peft thật) + status trung thực (created|pending_runtime) → dọn dữ liệu test sạch.
- **HỆ AI CỤC BỘ (browser E2E)**: model selector hiện 2 model (KhanhOS Core + KhanhOS qwen2.5 494M "Model cục bộ") → chat "có thể suy nghĩ giống chatgpt ko" hiển thị **status thật đang chạy** → meta cuối bubble: `qwen2.5:0.5b · 31.2s · sinh 4.1/giây · đã kiểm tra` (đo thật) → tính "(128 * 46) + 99" qua UI → tool chạy → **5987 đúng** → Settings có panel "Hệ AI cục bộ" (model đang chạy/Ollama) → mobile 390px không tràn → console 0 lỗi → body KHÔNG có chữ token/demo.
- **HỆ AI NÂNG CAO (browser E2E)**: menu tài khoản → **AI Studio** mở 3 tab (Tri thức/Trí nhớ/Huấn luyện — tab Huấn luyện chỉ owner thấy) → nạp "Sổ tay KhanhOS" → hiện "1 đoạn · nhúng nomic-embed-text" → truy vấn "mã sản phẩm nội bộ" → **khớp 66% + đúng nội dung KH-2026-ALPHA** → tab Huấn luyện hiện runtime trung thực ("Chưa có Python+torch — job chờ runtime, KHÔNG fake") → chat "viết hàm javascript tính tổng số chẵn" → **model viết code thật** (source local-model, hàm `sumEvenNumbers` đúng logic) → bấm 👍 → "Đã ghi nhận — góp vào tập dữ liệu huấn luyện" → mobile 390px no-overflow → console 0 lỗi.
- **Chất lượng code**: ESLint sạch, `tsc --noEmit` sạch, `bun run build` PASS.

## ⚠️ Phần chưa kết nối dịch vụ thật (minh bạch)

1. **Model AI local** — ĐÃ CÓ (`src/ai/` + Ollama `qwen2.5:0.5b`): model thật suy luận mọi câu tự do. **Giới hạn phần cứng sandbox (2 CPU / 4GB RAM)**: model 0.5B chạy ~4-10 giây/câu, chất lượng câu dài chưa bằng model lớn — muốn mạnh hơn thì cài model to hơn vào Ollama rồi đổi `AI_MODEL` (kiến trúc giữ nguyên). Khi sandbox restart, chạy lại `bash scripts/setup-ollama.sh` + `bun run db:seed-owner`.
2. **Email** — EmailService đang ở `dev` provider (log + file). Cấu hình `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` để gửi thật. Khi chưa có, link reset hiện trong response **chỉ ở môi trường dev** để test flow.
3. **Upload file nhị phân/ảnh** — file text được đọc & đưa vào context; ảnh/pdf hiện chỉ lưu metadata (đính kèm hiển thị đúng, đọc nội dung chưa hỗ trợ).
4. **Rate limiting in-memory** — đủ cho single-instance; khi chạy multi-instance trên Vercel nên cắm Upstash Redis vào `lib/security/rate-limit.ts` (interface đã tách sẵn).
5. **Kiến thức bot theo phạm vi dữ liệu** — câu khớp tri thức JSON trả lời tức thì & chính xác; câu ngoài phạm vi do model AI cục bộ suy luận (nếu Ollama tắt thì bot nói thẳng "chưa có kiến thức local" + hướng dẫn bật — cố ý, không bịa).

## 🗺 Deploy lên Vercel

1. **Code**: push repo lên GitHub → import vào Vercel (framework Next.js, build `bun run build`).
2. **Database**: tạo PostgreSQL ở Supabase/Neon → chạy `./scripts/switch-to-postgres.sh` + `prisma migrate dev` (xem mục Database).
3. **Env vars trên Vercel** (Project → Settings → Environment Variables):
   - `DATABASE_URL` = chuỗi PostgreSQL (nên dùng connection pooler)
   - `AUTH_SECRET` = chuỗi ngẫu nhiên dài (`openssl rand -hex 32`)
   - `APP_URL` = `https://your-domain.vercel.app`
   - (tuỳ chọn) `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`
   - ⚠️ Thư mục `data/chatbot/` phải đi kèm deploy (đọc file lúc runtime) — Vercel Serverless mặc định đã bundle theo repo; nếu dùng Docker/self-host thì giữ nguyên cây thư mục.
4. **Deploy**. Migratе DB đã chạy ở bước 2 — mọi route hoạt động ngay.

**Troubleshooting**: lỗi `500 /api/*` sau khi đổi provider → chạy lại `bunx prisma generate` rồi redeploy; session mất sau mỗi deploy → kiểm tra `AUTH_SECRET` đã set cố định (không để trống).

## 📄 License

Dự án cá nhân — KhanhOS AI.
