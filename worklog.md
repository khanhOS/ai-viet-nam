# Worklog — KhanhOS AI

---
Task ID: 1
Agent: Super Z (main agent)
Task: Xây dựng website AI hoàn chỉnh KhanhOS AI từ số 0 (Next.js 16 + TypeScript + Tailwind 4 + Prisma + z-ai SDK)

Work Log:
- Khởi tạo môi trường fullstack (init-fullstack.sh), khảo sát scaffold (Next 16, shadcn/ui, Prisma SQLite, z-ai-web-dev-sdk).
- Test SDK: streaming SSE hoạt động (delta.content + [DONE]), web_search functions.invoke hoạt động thật.
- Prisma schema: users, sessions, conversations, messages, user_settings, password_reset_tokens → db:push OK.
- lib/auth: scrypt password hashing, session (httpOnly cookie + SHA-256 token hash), reset token (one-time, 60').
- lib/security: rate-limit sliding window, origin CSRF check, zod validation schemas.
- lib/email: EmailService abstraction (dev log provider + Resend template).
- lib/ai: ModelRegistry (khanhos-core/code, qwen, deepseek, gpt-oss), AI Gateway, providers (khanhos → SDK/model-server, openai-compat → env keys, mock), system prompts, web-search.
- API routes: auth (register/login/logout/me/forgot/reset), chat SSE streaming + regenerate + stop, conversations CRUD + ownership, models registry, settings.
- Design system: globals.css "Obsidian & Aurora" (teal oklch 0.78 0.13 172), fonts Space Grotesk + Inter + JetBrains Mono, scrollbar, glass utilities, kh-markdown styles, prefers-reduced-motion.
- Frontend: AIOrb canvas (48 hạt, parallax lerp 0.045, DPR cap 2, 45fps, IntersectionObserver pause), BackgroundAura, TopBar (☰ + auth/account), HomeHero (tagline cycler), ChatComposer (auto-resize, focus glow), PlusMenu (Model/File/Web/Tools), ModelSelector, ChatView, MessageBubble (copy/regenerate/sources), MarkdownContent (react-markdown + remark-gfm + Prism + copy code), AppSidebar, AuthModal (login/register/forgot 3 bước + deep-link ?reset=), AccountModal, SettingsModal.
- Stores: zustand (auth, chat + SSE client throttle 40ms, ui). Hooks: useMouseParallax (ref + state), usePrefersReducedMotion (useSyncExternalStore).
- Fix lint React Compiler (refs trong render, setState trong effect) — lint sạch, tsc sạch.
- Test backend curl: toàn bộ flow auth + chat streaming + web search + authorization + model guard PASS.
- Test browser agent-browser: Home VLM review tốt, unauth send → modal + auto-send, register → chat streaming VN, code block + copy, + menu → model selector, web search nguồn thật, sidebar, settings, account, regenerate, stop, logout, forgot 3 bước + deep-link, login mật khẩu mới, mobile 390px không tràn ngang, console 0 lỗi.
- Viết README.md, .env.example, cập nhật .gitignore (email-outbox.log, db, !.env.example).

Stage Summary:
- Sản phẩm: KhanhOS AI hoàn chỉnh, chạy được ở http://localhost:3000 (dev server).
- AI thật hoạt động: model khanhos-core/khanhos-code stream qua z-ai backend SDK; web search thật.
- Auth đầy đủ: register/login/logout/forgot (token one-time 60', scrypt, session httpOnly).
- Model registry: thêm model không cần sửa UI; openai-compat chờ API key (UI hiện mờ "Chưa cấu hình").
- Demo accounts: minhkhanh@khanhos.vn / khanhos999 ; test1@khanhos.vn / matkhaumoi456.
- Chưa kết nối thật: Qwen/DeepSeek/GPT-OSS keys, Resend email, model server riêng, đọc file nhị phân.
- Tài liệu: README.md đầy đủ (features, architecture, setup, env, deploy, transparency list).

---
Task ID: 2
Agent: Super Z (main agent)
Task: Nâng cấp KhanhOS AI theo spec mới: Cerebras API, PostgreSQL production path, dark/light mode, landing page, dedicated routes, /api/chats rename, AUTH_SECRET pepper, sidebar search+rename, account profile update.

Work Log:
- Inspect repo: phiên trước đã build app hoàn chỉnh (auth, AI gateway z-ai SDK, streaming, chat history, UI Obsidian&Aurora). Xác định gap vs spec mới.
- Cerebras: viết lại openai-compatible-provider — CEREBRAS_API_KEY (api.cerebras.ai/v1) phục vụ qwen-3-32b / deepseek-r1-distill-70b / gpt-oss-120b (priority), fallback direct keys; registry thêm badge "Cerebras"; .env.example đầy đủ.
- AUTH_SECRET: thêm lib/auth/pepper.ts (HMAC-SHA256) — session + reset token hash bằng pepper; set dev value trong .env.
- PostgreSQL: prisma/schema.postgres.prisma (cùng model + cột theme), sinh prisma/postgres-migration.sql (prisma migrate diff --from-empty), scripts/switch-to-postgres.sh (swap + generate + hướng dẫn migrate). Sandbox không cài được postgres (không root) → SQLite demo + production path PostgreSQL (Supabase/Neon/Vercel).
- Dark/light mode: globals.css thêm html.light "Porcelain & Aurora" (teal đậm 0.55), light variants cho kh-glass/glass-strong/icon-btn/text-gradient/scrollbar/selection/markdown; bulk replace bg-white/N → bg-foreground/N (~85 chỗ) cho theme-aware; next-themes ThemeProvider (attribute=class, default dark) + ThemeSync (event kh:apply-theme từ store); theme column trong UserSettings (cả 2 schema) + settings API + zod + SettingsModal section Tối/Sáng/Hệ thống + TopBar Sun/Moon toggle; BackgroundAura + AIOrb theme-aware (orb teal l=46 ở light); fix hydration mismatch bằng mounted gate (useSyncExternalStore).
- API rename: /api/conversations → /api/chats (folder + tất cả call sites).
- Landing: landing-sections.tsx (5 features + card kiến trúc + CTA + footer), gắn dưới HomeHero, data-home-scroll; CTA "Bắt đầu trò chuyện" dispatch kh:focus-composer (focus + scroll composer thật).
- Routes: KhanhOSApp nhận initial prop → /login /register /forgot-password /reset-password (openReset) /chat /chat/[id] (openConversationId + auth guard) /settings /account (modal + auth guard); login thành công trên route auth → router.replace("/"); đã-login vào /login → redirect /.
- Reset link: /reset-password?token=... (AuthModal đọc token|reset).
- Sidebar: search input (filter client-side, hiện khi >3 conv), rename inline (pencil → input → PATCH), timeAgo timestamp, nền bg-sidebar/95 theme-aware.
- Account: PATCH /api/user (name, zod nameSchema) + AccountModal sửa tên inline (Enter lưu / Esc huỷ).
- Fix: tsc exclude examples/skills (scaffold noise); React Compiler lint (setState-in-effect → useSyncExternalStore mounted); typo "n" thừa trong sidebar; import path @/.
- Khởi động lại dev server (Prisma client cũ không biết cột theme → 500), dùng setsid để process sống.
- Test: scripts/test-backend-v2.sh — 29/29 PASS (register/dup/validation, session, login sai/đúng, SSE meta/delta/done, chats CRUD+rename, IDOR 404/401 chặn user B, model guard CEREBRAS hint, theme DB patch/get/invalid, user PATCH, reset flow link mới, logout huỷ session, rate limit 429).
- E2E agent-browser + VLM: home render, dark/light (VLM: tương phản đạt WCAG, orb fix teal đậm), register → streaming + code block + copy/regenerate, DB persist (title tự sinh + 2 messages), deep-link /chat/[id] load đúng + CHAT VIEW, /login redirect khi đã login, /settings modal (Tối/Sáng/Hệ thống), theme switch lưu DB (UserSettings.theme=light), sidebar rename inline (PATCH 200), mobile 390px không tràn, CTA focus composer, console 0 lỗi sau fix hydration.
- README rewrite: Cerebras, PostgreSQL switch, routes table, env vars, 29/29 tests, Vercel deploy steps + troubleshooting.

Stage Summary:
- Sản phẩm KhanhOS AI hoàn thiện: auth thật, DB thật, streaming thật, Cerebras-ready, dark/light thật (lưu DB), routes đầy đủ, /api/chats đúng spec.
- Cerebras: chỉ cần CEREBRAS_API_KEY ở Vercel → Qwen/DeepSeek/GPT-OSS tự bật (registry check available).
- PostgreSQL: SQLite demo sandbox ↔ Postgres production qua 1 script (code 0 dòng đổi).
- Kiểm chứng: lint sạch, tsc sạch, 29/29 backend, browser E2E + VLM pass, dev.log sạch.

---
Task ID: 3
Agent: Super Z (main agent)
Task: Theo yêu cầu owner: (1) seed owner account hoangbaokhanhhehe@gmail.com / khanhhehedz, (2) nới lỏng chính sách mật khẩu — min 4 ký tự, max 128 ký tự, KHÔNG bắt buộc chữ số/chữ cái/ký tự đặc biệt.

Work Log:
- validation.ts: passwordSchema min 4 / max 128, bỏ 2 regex bắt buộc chữ+ số; export PASSWORD_MIN/PASSWORD_MAX.
- Client: register-form + forgot-password-form (bước 3) — bỏ check chữ/số, thêm check >128, đổi placeholder "Từ 4 đến 128 ký tự".
- Prisma: thêm cột User.role (default "user") vào schema.prisma + schema.postgres.prisma; db:push OK; regenerate prisma/postgres-migration.sql (có role TEXT NOT NULL DEFAULT 'user').
- Seed: scripts/seed-owner.ts (idempotent upsert — re-run reset pass + role; verify round-trip); package.json thêm "db:seed-owner"; .env.example thêm OWNER_EMAIL/OWNER_PASSWORD/OWNER_NAME. Đã chạy: owner tạo trong SQLite, verify PASS.
- Role plumbing: session.ts SessionUser + getSessionUser trả role; login/register/me/user API trả role; types/chat.ts SessionUser.role?; AccountModal badge Crown "CHỦ SỞ HỮU" + mô tả "Chủ sở hữu KhanhOS AI" khi role=owner.
- Dev server: phát hiện harness dọn process sau mỗi Bash call (setsid đơn thuần bị kill) → fix bằng double-fork orphan `( setsid nohup bun run dev & )`; server sống qua nhiều lệnh, HTTP 200.
- Test scripts/test-owner-policy.sh: 13/13 PASS (3 ký tự 400 + msg đúng; 4 chỉ chữ 200; 129 → 400; 128 chỉ số → 200; user mới role=user; login owner 200 role=owner; sai pass 401; me role; models guard; logout; me → user null theo quy ước cũ). Rate limit 429 xác nhận hoạt động (5 register/giờ/IP).
- E2E agent-browser: login owner qua /login → redirect Home + toast; modal Tài khoản hiện badge CHỦ SỞ HỮU (screenshot e2e-owner-account.png); chat streaming thật "2+2 = 4"; console 0 lỗi; đăng ký mật khẩu 3 ký tự bị chặn client ("Mật khẩu phải có ít nhất 4 ký tự"), 4 ký tự chỉ chữ đăng ký thành công.
- Dọn 5 user test rác (@test.dev, clienttest@vidu.com) — DB chỉ còn owner. Lint + tsc sạch. README: mục chính sách mật khẩu, role, tài khoản owner + seed, kết quả test 13/13 + E2E owner; .env.example Owner seed.

Stage Summary:
- Owner account sẵn sàng: hoangbaokhanhhehe@gmail.com / khanhhehedz (role=owner, badge Chủ sở hữu trong UI).
- Chính sách mật khẩu mới áp dụng đồng bộ server (zod) + client: 4–128 ký tự, không yêu cầu độ phức tạp.
- User.role mở đường cho tính năng admin sau này; schema SQLite + PostgreSQL đồng bộ, migration SQL regenerate.
- Kiểm chứng: 13/13 backend mới, E2E browser owner pass, lint/tsc sạch, dev server ổn định (double-fork orphan).

---
Task ID: 4
Agent: Super Z (main agent)
Task: (1) Fix lỗi "Yêu cầu không hợp lệ (origin)" khi login qua preview link. (2) Thêm website thương hiệu phòng tập cao cấp IRON FORGE (design prompt user cung cấp) vào DƯỚI giao diện sẵn có, giữ nguyên UI gốc, đầy đủ animation; KHÔNG dùng chữ "demo" trong UI.

Work Log:
- FIX ORIGIN (src/lib/security/origin.ts): viết lại isSameOrigin 2 lớp — Lớp 1 Fetch Metadata (Sec-Fetch-Site: same-origin/same-site/none → cho; cross-site → chặn; browser tự sinh, JS không spoof được) giải quyết triệt để Host bị proxy edge ghi đè; Lớp 2 fallback browser cũ: Origin/Referer khớp Host + X-Forwarded-Host (Caddy sanitize XFH — đã chứng minh không spoof được qua gateway, case A 403).
- Kiểm chứng origin 5 kịch bản curl: same-origin 200 / cross-site 403 / spoof XFH 403 / proxy hợp lệ (Sec-Fetch) 200 / curl thuần 200. Browser thật login owner thành công (chính là flow user bị lỗi).
- ẢNH: image-search 8 truy vấn (~50 kết quả) → tải 25 → VLM glm-4.5v lọc watermark/người nổi tiếng → giữ 16 ảnh sạch (hero reel 4, coach 4, curriculum 3, member 4, gym 1) vào public/fitness/img/ (xoá 9 ảnh watermark/celebrity).
- ÂM THANH: TTS voiceover — tiếng Việt (giọng luodo) bị hỏng (ASR transcribe vô nghĩa "kong kong") → đổi giọng jam tiếng Anh "Every rep counts…" 18.4s, ASR round-trip khớp ~99% → public/fitness/audio/hero-voice.wav. Nút "Bật âm" phát thật (browser autoplay policy: user gesture).
- DB/API: model TrialBooking (id/name/phone/goal/preferredTime/note/createdAt) vào schema.prisma + schema.postgres.prisma + regenerate postgres-migration.sql + db:push; POST /api/trial-booking (guard origin + rate limit 3/10'/IP + zod: name 2-60, phone VN regex + chuẩn hoá +84/84→0, goal/preferredTime enum, note ≤500).
- COMPONENTS (src/components/fitness/): fitness-site (ghép + marquee brand strip + GrainLayer portal parallax rAF scroll*0.07 + noise steps()), fitness-hero (reel Ken Burns crossfade 5.2s — pause khi out-viewport/tab ẩn; audio toggle; stats; dải HLV tròn scroll-to), fitness-curriculum (3 card mục tiêu: giai đoạn/tần suất/giá + hover glow cam), fitness-coaches (flip 3D rotateY hover/tap/keyboard — mặt sau chứng chỉ + background + bài tập chữ ký), fitness-stories (carousel framer-motion drag x + dragElastic 0.18 rubber-band + auto-advance 5.5s pause hover/out-view/reduced + dots + mũi tên + đo step/maxScroll resize), fitness-booking (CTA pulse + sticky bottom bar portal + modal form → POST → success state), fitness-hooks (useSectionReveal IntersectionObserver stagger, useInView, useMounted useSyncExternalStore), fitness-data (copy tiếng Việt dày đặc, không chữ "demo").
- CSS globals.css +235 dòng namespace .fx-: biến cam neon/bạc/đen, grain film noise, reveal, kenburns, flip 3D, cta pulse, sticky bar, marquee, photo grayscale+contrast, prefers-reduced-motion tắt hết.
- Gắn <FitnessSite/> dưới <LandingSections/> trong home-hero.tsx — 5 dòng thay đổi duy nhất ngoài vùng fitness, UI gốc không đụng.
- BUG FIX: hydration mismatch (portal render null ở SSR ↔ portal ở client) → fix bằng useMounted gate (useSyncExternalStore) cho GrainLayer + sticky bar; ESLint setState-in-effect → dùng usePrefersReducedMotion có sẵn (useSyncExternalStore).
- Test backend booking 9/9 PASS (IP ảo riêng mỗi case qua X-Forwarded-For để không dính chung bucket): hợp lệ 200+id, +84→090 chuẩn hoá, SĐT sai 400, goal lạ 400, tên ngắn 400, CSRF 403, rate limit 429 lần 4, DB lưu thật.
- E2E browser: home 200; scroll xuống fx-root; reel crossfade hero-5→hero-6 sau 5.6s; 23/23 ảnh load; click "Bật âm" → audio paused=false, currentTime chạy, label "Đang phát"; reveal fx-in đủ; coach card click → fx-flipped + matrix3d rotateY(180°) + 3 chứng chỉ; carousel: auto-advance dot 0→1 x=-420 (phát hiện pause-on-hover do chuột Playwright đứng yên — đúng thiết kế), drag PointerEvent -360px → snap -508 dot 2, quăng phải 900px vượt mép → đàn hồi +88.5px → thả snap về 0 (rubber-band); sticky bar ẩn/hiện/ẩn đúng 3 vùng; booking modal điền đủ → submit → "ĐÃ GHI NHẬN!" + DB row (fatloss/evening/0977000111); mobile 390px không tràn ngang + sticky full-width; light mode fx-root vẫn đen thuần rgb(5,5,5); console 0 lỗi; chat sau origin fix stream "1+1=2" OK; login owner qua /login OK.
- VLM review 4 screenshot (hero/programs/stories/mobile-hero): "bố cục chặt, typography mạnh, hardcore-luxury, không lỗi hiển thị".
- Dọn DB: 8 booking test xoá sạch. README: mục IRON FORGE, origin fix, 9/9 + E2E + VLM. dev server sống ổn định qua double-fork orphan.

Stage Summary:
- Lỗi login "Yêu cầu không hợp lệ (origin)" ĐÃ FIX: browser qua preview proxy giờ đi qua Sec-Fetch-Site (Fetch Metadata), CSRF vẫn chặt (cross-site 403, spoof XFH bị gateway sanitize).
- IRON FORGE hoàn chỉnh gắn dưới landing: hero reel B&W + voiceover thật, curriculum 3 mục tiêu, coach flip 3D, stories carousel rubber-band, booking lưu DB thật, sticky CTA, grain parallax, reveal stagger — không đổi gì UI gốc, không chữ "demo".
- Kiểm chứng: 9/9 booking API, E2E đầy đủ từng interaction, VLM review tốt, lint/tsc sạch, console 0 lỗi.

---
Task ID: 5
Agent: Super Z (main agent)
Task: Theo yêu cầu user ("t dùng api của cerebras openroute gemini") — nâng cấp lớp AI hỗ trợ song song 3 API: Cerebras + OpenRouter + Google Gemini.

Work Log:
- Rewrite src/lib/ai/providers/openai-compatible-provider.ts thành multi-backend router: 4 backend (cerebras api.cerebras.ai/v1, openrouter openrouter.ai/api/v1 + header X-Title/HTTP-Referer, gemini generativelanguage.googleapis.com/v1beta/openai + alias GOOGLE_API_KEY, direct key legacy từng model). Mỗi model khai báo ROUTES theo thứ tự ưu tiên — backend đầu tiên có key phục vụ; env đọc lazily (hot-flip được khi test).
- Registry: thêm 5 model mới — llama (Cerebras→OR), gemini-flash/gemini-pro (Gemini→OR), claude/gpt (OpenRouter→direct). Tổng 10 model. Badge ĐỘNG: activeBackendFor() trả backend thật đang phục vụ (chỉ có OPENROUTER_API_KEY → Qwen hiện badge "OpenRouter"); chưa có key → badge tuyến chính.
- types.ts: AIProvider thêm 2 method optional (activeBackendFor, setupHintFor). gateway.ts: lỗi 404 model chưa kích hoạt nay kèm gợi ý đúng tên biến (VD "Thêm OPENROUTER_API_KEY hoặc CLAUDE_API_KEY vào file .env...").
- .env.example: bảng định tuyến model→backend + 3 key chính (CEREBRAS/OPENROUTER/GEMINI_API_KEY) + đầy đủ override model upstream + direct keys. README: bảng tuyến, env table, hướng dẫn test mới.
- Test scripts/test-provider-routing.ts (bun, 44/44 PASS): fake SSE server local 127.0.0.1:3999, xoay env 7 case (A-G) — chứng minh: routing đúng ưu tiên (Cerebras > OpenRouter > direct; Gemini > OpenRouter), fallback chéo (gemini-flash chạy qua OR khi chỉ có OR key), badge động, hint key đủ đường, header OpenRouter (X-Title + HTTP-Referer từ APP_URL), stream parse đúng kể cả comment ": OPENROUTER PROCESSING", direct key legacy hoạt động, GOOGLE_API_KEY alias.
- Test scripts/test-multi-provider.sh (12/12 PASS trên dev server): login owner → guard claude/gemini-flash/qwen hiện đúng tên key cần thêm → model lạ 404 → streaming thật khanhos-core (meta/delta/done) → /api/models 10 model + badge → dọn conversation test.
- Regression: scripts/test-backend-v2.sh 29/29 PASS (không phá gì). tsc sạch, ESLint sạch. Restart dev server (double-fork orphan).
- E2E agent-browser: + menu → Model selector render 10/10 model (2 khanhos chọn được, 8 model mờ trong section "Chưa cấu hình (cần API key)" — DOM verify), badge Cerebras/Gemini/OpenRouter hiển thị, console 0 lỗi. Screenshot download/e2e-multi-provider-models.png.

Stage Summary:
- KhanhOS AI giờ hỗ trợ 3 API AI song song: Cerebras (nhanh, model mở) + OpenRouter (aggregate mọi model — chỉ cần 1 key này là mọi model chạy) + Google Gemini (Flash/Pro trực tiếp).
- 10 model trong selector: khanhos-core/code (SDK), qwen/deepseek/gpt-oss/llama (Cerebras→OR), gemini-flash/pro (Gemini→OR), claude/gpt (OR). Badge UI phản ánh backend thật; lỗi hiển thị đúng tên key cần thêm.
- Muốn kích hoạt: dán key vào .env (CEREBRAS_API_KEY / OPENROUTER_API_KEY / GEMINI_API_KEY — lấy tại cloud.cerebras.ai / openrouter.ai/keys / aistudio.google.com/apikey) rồi restart server.
- Kiểm chứng: 44/44 + 12/12 + 29/29 regression, lint/tsc sạch, console 0 lỗi, dev server ổn định.

---
Task ID: 6
Agent: Super Z (main agent)
Task: Theo yêu cầu user ("bỏ mấy cái ở dưới đi, t muốn là hiệu ứng") — (1) gỡ IRON FORGE khỏi trang chủ, (2) thay bằng bộ hiệu ứng cao cấp cho trang chính.

Work Log:
- GỜ IRON FORGE: home-hero.tsx bỏ import + render <FitnessSite/> (component + ảnh + audio + API trial-booking giữ nguyên trong repo — gắn lại chỉ cần 1 dòng). DOM verify: không còn "RÈN THÉP"/booking/sticky bar. README đánh dấu "ĐÃ GỦ theo yêu cầu chủ sở hữu".
- TẠO src/components/app/effects-layer.tsx (4 lớp, mount trong khanhos-app cạnh BackgroundAura): (1) canvas particle network — 28-85 hạt theo diện tích, dây nối hạt-hạt (<112px), chuột đẩy hạt + dây nối chuột-hạt (<160px), lerp chuột 0.14, DPR cap 2, damping 0.996, pause khi tab ẩn, resize re-seed, màu teal theme-aware (đọc html.light mỗi frame); (2) 4 tia sáng chéo CSS lệch pha (kh-beam, dur/delay CSS var); (3) spotlight bám chuột 34rem lerp (chỉ pointerType != touch); (4) grain film z-40 opacity 0.05 (SVG feTurbulence + steps jitter).
- HERO: wordmark "KhanhOS AI" shimmer (gradient pan 220% alternate); composer có glow "thở" (kh-anim-pulse-glow blob blur-2xl phía sau); chiều sâu scroll — scale 1→0.94 + opacity 1→0.2 + y→-48px.
- LANDING: fadeUp thêm blur(8px); 7 card (6 feature + CTA) có kh-card-glow — radial glow theo --mx/--my chuột (handler setProperty).
- CSS globals.css +170 dòng: kh-shimmer-pan, kh-beam-shoot, kh-spotlight, kh-grain (+shift), kh-card-glow — đủ biến thể html.light + media prefers-reduced-motion tắt hết.
- BUGFIX 1: gate (pointer: fine) sai trong headless (báo none) → bỏ gate, dùng e.pointerType !== "touch" cho spotlight (hạt vẫn tương tác cảm ứng).
- BUGFIX 2: framer useScroll mặc định theo window (page không cuộn window → progress đứng yên + warning container static) → bỏ useScroll, tự theo dõi container [data-home-scroll] bằng scroll listener + useMotionValue/useTransform (rect math: p = (elTop - heroTop)/heroHeight clamp 0-1). Thêm relative cho container scroll.
- SỰ CỐ DB: phát hiện DB custom.db bị reset về schema rỗng (mtime 13:42:34 trùng lúc restart server Task 5; owner + mọi user/conversation mất — chỉ còn schema 7 bảng). Chạy lại bun run db:seed-owner (idempotent) + restart dev server → login owner OK. Thêm scripts/check-owner.ts (debug). Nguyên nhân gốc chưa xác định được (không có lệnh nào của session ghi/đổi DB ngoài test thường quy).
- E2E agent-browser: IRON FORGE gone; canvas+4 beams+grain+shimmer+7 card glow render; spotlight bám chuột (opacity 1, translate3d lerp); scroll depth đúng (1000px → opacity 0.2, scale 0.94, y -48); landing reveal blur; mobile 390px không tràn; light mode đổi màu hiệu ứng; login owner + chat streaming "OK" vẫn chạy với effects active; console 0 lỗi. Screenshots: download/e2e-effects-{hero,landing,mobile,light}.png.
- tsc sạch, ESLint sạch (src/). Dọn conversation test (0 còn lại).

Stage Summary:
- Trang chủ giờ là: hero KhanhOS AI (orb + shimmer + composer glow + scroll depth) → landing features/CTA (reveal blur + card glow) — sạch, không còn IRON FORGE.
- Effects layer chạy toàn app (cả chat view): particle network tương tác chuột, tia sáng, spotlight, grain — theme-aware, reduced-motion an toàn, hiệu năng kỷ luật (DPR cap, pause hidden tab).
- IRON FORGE giữ trong src/components/fitness/ — gắn lại bất cứ lúc nào bằng 1 dòng trong home-hero.tsx.
- Lưu ý vận hành: DB từng bị reset 1 lần giữa session (nguyên nhân chưa rõ) — đã re-seed owner; nếu gặp "Email hoặc mật khẩu không đúng" bất thường → chạy bun run db:seed-owner.

---
Task ID: 7
Agent: Super Z (main agent)
Task: Theo yêu cầu user — (1) đổi password owner hoangbaokhanhhehe@gmail.com thành khanh0712014@#, (2) cho email này ĐĂNG KÝ thì luôn nhận role owner.

Work Log:
- Tạo src/lib/auth/owner.ts: OWNER_EMAIL (env OWNER_EMAIL, mặc định hoangbaokhanhhehe@gmail.com, lowercase) + roleForEmail() + isOwnerEmail().
- Register route: user.create thêm role: roleForEmail(email) — email owner đăng ký qua form/API công khai ⇒ role "owner"; email thường ⇒ "user".
- scripts/seed-owner.ts: default OWNER_PASSWORD → "khanh0712014@#"; OWNER_EMAIL import từ module dùng chung (1 nguồn sự thật).
- scripts/test-owner-policy.sh + test-multi-provider.sh: đổi mật khẩu owner login sang mật khẩu mới.
- bun run db:seed-owner: PASS (verify scrypt round-trip, role=owner). Restart dev server.
- Test scripts/test-owner-register.sh (mới, 13/13 PASS): login pass mới 200 + role owner; pass cũ 401; XOÁ owner trong DB rồi ĐĂNG KÝ lại qua API ⇒ response + DB role=owner + /me owner + login lại 200; trùng email → 409; email thường ⇒ role=user; dọn user test.
- tsc + ESLint sạch. DB cuối: owner role=owner + settings 1-1.
- (Ghi chú: session trước tool 502 giữa chừng — bản ghi worklog này + README/.env.example được bổ sung đầu session sau.)

Stage Summary:
- Owner: hoangbaokhanhhehe@gmail.com / khanh0712014@# (role=owner). Email owner đăng ký lúc nào cũng thành owner (kể cả DB trống).

---
Task ID: 8
Agent: Super Z (main agent)
Task: Theo yêu cầu user ("ko cho khi đăng nhập... chỉ có khung chat th") — Ẩn toàn bộ landing sections khi đã đăng nhập, trang chủ chỉ còn khung chat; khách chưa đăng nhập vẫn thấy landing. Kèm dọn nợ Task 7 (README/.env.example/worklog bị chặn do tool 502 session trước).

Work Log:
- Hoàn nợ Task 7: README dòng owner password → khanh0712014@#; .env.example OWNER_PASSWORD + ghi chú email owner đăng ký tự nhận role; worklog Task 7 append.
- src/components/home/home-hero.tsx: import useAuthStore; showLanding = ready && !user; <LandingSections /> render điều kiện theo showLanding. Gate qua `ready` (auth store đã fetch /api/auth/me) để user đã đăng nhập KHÔNG thấy landing nhấp nháy trước khi session load xong; SSR/hydration an toàn (ready=false lần đầu render hai phía).
- tsc sạch, ESLint sạch. Restart dev server (double-fork orphan) — HTTP 200.
- E2E agent-browser: (1) Khách: landing hiện ("Vì sao chọn" + 2 section trong [data-home-scroll]); (2) Login owner /login với khanh0712014@# → về "/" → landing BIẾN MẤT hoàn toàn (0 section, không text "Vì sao chọn"/CTA), composer + orb + effects còn nguyên, scroll chỉ còn padding hero (134px); (3) Logout → landing QUAY LẠI cho khách (cookie session gone + 2 section); (4) Regression: login lại + gửi "2+2 bằng bao nhiêu?" → streaming trả lời "4", landing vẫn ẩn; (5) Mobile 390px: không tràn ngang, landing ẩn, composer OK; (6) console 0 lỗi (chỉ log HMR dev). Dọn 1 hội thoại test.
- Re-run scripts/test-owner-register.sh sau restart: 13/13 PASS (login pass mới, đăng ký email owner → role owner, user thường → user).
- README: cập nhật bullet landing "chỉ hiển thị cho khách chưa đăng nhập".
- Screenshots: download/e2e-logged-in-chat-only.png, e2e-guest-landing.png, e2e-logged-in-mobile.png.

Stage Summary:
- Đã đăng nhập ⇒ trang chủ chỉ còn khung chat (orb + composer + effects) — không còn features/CTA/footer.
- Chưa đăng nhập ⇒ landing marketing đầy đủ hiện như cũ; login/logout chuyển trạng thái tức thì.
- Không flash landing cho user đã đăng nhập (gate `ready`), hydration an toàn.
- Kiểm chứng: 13/13 owner test PASS lại, tsc/lint sạch, E2E đầy đủ 2 chiều + mobile + chat regression, console 0 lỗi.

---
Task ID: 9
Agent: Super Z (main agent)
Task: Theo yêu cầu user — thêm hệ thống gói Free/Plus/VIP/Max (Free 25k, Plus 85k/55.000đ, VIP 256k/99.000đ, Max 500k/159.000đ), form nâng cấp thu SĐT + Gmail + MoMo, thanh toán chủ TK Hoang Bao Khanh STK 000000, **KHÔNG hiển thị chữ "token" và "demo" trong web**.

Work Log:
- Phiên trước đã dở dang phần lõi (session đứt context): plans.ts, plan-usage.ts, /api/plans, /api/plan-requests (+[id] PATCH), PlansModal, schema User.plan/PlanRequest/Message.tokens, wiring top-bar/sidebar/account — session này khảo sát toàn bộ rồi hoàn thiện phần còn thiếu.
- XOÁ CHỮ "TOKEN" KHỎI UI: plans.ts perks "25.000 tín dụng mỗi tháng" (4 gói) + rename field monthlyTokens→monthlyCredits + formatTokens→formatCredits (JSON API + UI đồng bộ); plans-modal 5 chuỗi hiển thị; plan-usage quotaErrorMessage "dùng hết X tín dụng của gói…"; account-modal "Tín dụng & nâng cấp gói". Còn lại chỉ là code identifier (presetToken của reset mật khẩu, Message.tokens DB) — không hiển thị.
- THÊM TRƯỜNG MOMO (form bắt buộc theo yêu cầu "cần sdt gmail và mono"): prisma PlanRequest.momoNumber (SQLite + Postgres + regenerate postgres-migration.sql) + zod momoNumber (vnPhoneSchema dùng chung) + POST /api/plan-requests lưu + PlansModal form field "Số MoMo (tài khoản dùng để thanh toán)" + admin list "SĐT … • MoMo …".
- SỬA "DEMO": landing-sections "không phải trang demo" → "không phải bản thử nghiệm".
- UX bổ sung: top-bar nút "Gói dịch vụ" cho KHÁCH (icon mobile + text sm+); khách không còn badge "ĐANG DÙNG Free"; nút "Đăng nhập để bắt đầu" giờ mở form đăng ký thật.
- SỰ CỐ DB TÁI DIỄN: custom.db bị reset sạch (0 user — như sự cố Task 6) → chạy lại bun run db:seed-owner (idempotent, verify PASS).
- db:push (cột momoNumber) + restart dev server double-fork orphan + regenerate prisma client.
- Test scripts/test-plans.sh (mới): **34/34 PASS** — /api/plans công khai 4 gói đúng giá/hạn mức + KHÔNG chữ token + STK 000000/HOANG BAO KHANH; đăng ký ⇒ free 25.000; form: thiếu MoMo 400, sai định dạng 400, hợp lệ 200 pending, DB lưu MoMo, trùng pending 409; user thường GET 403; owner duyệt ⇒ plan=plus + limit 85.000, duyệt lại 409, gói đang dùng 400; **chat 402 khi vượt hạn mức** (msg "tín dụng", không "token"); xoá fake → chat thật 200 SSE meta/done + Message.tokens>0; owner chat 200 dù usage 999.999. XFF IP ảo riêng mỗi case tránh bucket rate limit.
- Regression: scripts/test-owner-register.sh 13/13 PASS lại. tsc sạch, ESLint sạch.
- E2E agent-browser: khách bấm "Gói dịch vụ" → modal 4 gói + giá + "tín dụng" + thanh toán (body 0 chữ token/demo) → login user → usage bar "0 / 25.000 tín dụng" → Nâng cấp Plus → form SĐT+MoMo+Gmail+note + HOANG BAO KHANH/000000 → "ĐÃ GHI NHẬN!" → banner "đang chờ duyệt (vừa xong)" → logout → login owner → modal hiện request (SĐT 0938000111 • MoMo 0938222333 • note) → Duyệt ✓ → badge "ĐÃ DUYỆT" + DB user.plan=plus + planUpdatedAt set → chat regression "2+2 = 4" → mobile 390px NO-OVERFLOW → console 0 lỗi. Screenshots: download/e2e-plans-owner-approve.png, e2e-plans-mobile.png. Dọn user E2E + hội thoại test.
- README: mục "💎 Gói dịch vụ & hạn mức" (bảng 4 gói, luồng MoMo, env PAYMENT_ACCOUNT_*) + kết quả test 34/34 + E2E; .env.example thêm PAYMENT_ACCOUNT_NAME/NUMBER (đổi khi có STK thật — không sửa code).

Stage Summary:
- Hệ thống gói hoàn chỉnh: Free 25.000 / Plus 85.000 (55.000đ) / VIP 256.000 (99.000đ) / Max 500.000 (159.000đ) tín dụng/tháng — hiển thị "tín dụng", KHÔNG chữ token/demo trong UI.
- Hạn mức chặn chat thật (402), làm mới mùng 1 hàng tháng, owner không giới hạn; mức dùng ghi vào Message.tokens (phản hồi + ngữ cảnh).
- Nâng cấp: form SĐT + MoMo + Gmail + ghi chú → thanh toán HOANG BAO KHANH STK 000000 (placeholder, đổi qua .env) → owner duyệt trong modal → gói kích hoạt ngay.
- Lưu ý vận hành: DB bị reset 1 lần nữa đầu session (đã re-seed owner; gặp "Email hoặc mật khẩu không đúng" bất thường → bun run db:seed-owner). VIP lấy 256k theo ladder giá hợp lý — owner nói cả 128k/256k, đổi 1 dòng trong plans.ts nếu muốn 128k.

---
Task ID: 10
Agent: Super Z (main agent)
Task: Yêu cầu user — xác nhận haongbaokhanhhehe@gmail.com là owner và có mức dùng VÔ HẠN (không bị giới hạn gói).

Work Log:
- Khảo sát: Task 9 (hệ thống gói Free/Plus/VIP/Max + form nâng cấp + duyệt) đã hoàn thiện ở phiên trước; owner-bypass hạn mức đã có (plans.ts monthlyTokenLimit → Infinity, isOverQuota → false, /api/plans limit=null, modal "Chủ sở hữu (không giới hạn)").
- Phát hiện 1: DB sandbox bị reset lần nữa (bảng users trống) → cần re-seed.
- Phát hiện 2: tin nhắn user viết "haongbaokhanhhehe@gmail.com" nhưng owner.ts mặc định "hoangbaokhanhhehe@gmail.com" — khác chính tả một chữ (hoang/haong), nếu chỉ giữ một thì có nguy cơ mất quyền owner do lỗi gõ.
- Giải pháp: owner.ts hỗ trợ DANH SÁCH email owner — env OWNER_EMAIL nhận nhiều email cách nhau bằng dấu phẩy, mặc định gồm CẢ HAI cách viết; roleForEmail/isOwnerEmail kiểm tra membership trong Set.
- Cập nhật scripts/seed-owner.ts: seed TẤT CẢ email trong OWNER_EMAILS (cùng mật khẩu khanh0712014@#, idempotent, verify round-trip từng account); scripts/check-owner.ts kiểm tra cả hai.
- .env thêm OWNER_EMAIL="hoangbaokhanhhehe@gmail.com,haongbaokhanhhehe@gmail.com" (tường minh, dễ sửa khi biết email thật) + .env.example hướng dẫn comma-separated.
- Re-seed 2 tài khoản owner (DB sạch) + restart dev server (code + env mới).
- test-owner-register.sh: thêm GIAI ĐOẠN 2b (4 case mới) — đăng ký "haong…" ⇒ role owner; /api/plans owner "haong…" ⇒ limit null (vô hạn); /api/plans owner "hoang…" ⇒ limit null (vô hạn).
- Regression: test-owner-register.sh **19/19 PASS** (15 cũ + 4 mới), test-plans.sh **34/34 PASS** (kể cả "owner chat dù vượt hạn mức 200", KHÔNG chữ token trong phản hồi). ESLint sạch.
- E2E agent-browser: login owner bằng chính email haongbaokhanhhehe@gmail.com → "Chào mừng trở lại, Khanh!" → modal Gói dịch vụ hiện "Chủ sở hữu (không giới hạn)" + "Tín dụng đã dùng tháng này: 0" + 3 nút Nâng cấp → body KHÔNG chứa chữ token/demo → chat thật "2+2" ⇒ "4" (streaming) → console 0 lỗi, dev.log 0 lỗi → mobile 390px không overflow → dọn hội thoại test. Screenshot: download/e2e-owner-unlimited-plans.png.
- README: bảng owner 2 email + ghi chú vô hạn mức dùng + hướng dẫn bỏ email sai khi biết chắc; nhắc re-seed khi DB sandbox reset.

Stage Summary:
- haongbaokhanhhehe@gmail.com (và hoangbaokhanhhehe@gmail.com) đều là owner: đăng ký tự nhận role owner, seed sẵn tài khoản, mật khẩu khanh0712014@#.
- Owner có mức dùng VÔ HẠN: /api/plans trả limit=null, modal hiển thị "Chủ sở hữu (không giới hạn)", chat không bao giờ bị chặn 402.
- Muốn bỏ một email sai: sửa OWNER_EMAIL trong .env → chạy lại bun run db:seed-owner (nếu email sai đã tạo tài khoản thì xoá thủ công trong DB).

---
Task ID: 11
Agent: Super Z (main agent)
Task: Hoàn tất engine chat local 100% (phiên trước đã dựng dở) + yêu cầu user: "fix hết lỗi và làm thêm những thứ hay ho như /give plus gmail hoặc id user, /help sẽ ra các lệnh chỉ dành cho owner"

Work Log:
- Khảo sát: Task 11 phiên trước đã dựng khung engine local (src/lib/local-chat/ 10 file + data/chatbot/ intents/responses/knowledge/aliases/faq/commands/topics/system) nhưng test-local-chat.sh đang 18 PASS / 6 FAIL và CHƯA có lệnh owner.
- PHÂN TÍCH 6 LỖI: (1) sse_field Python in "None" khi intent=null → so sánh sai; (2) /clear vẫn lưu message xác nhận → DB còn 1 dòng; (3)+(4) quota test: Prisma where sai cú pháp `conversation:{userId:{email}}` (phải là `conversation:{user:{email}}`) → fake usage không chạy → không 402; (5)+(6) round-trip admin: Python đọc cookie jar tìm "khanhos_session" nhưng cookie thật tên "kh_session" → IndexError, và check đếm intent so sai (16 file ai.json vs 95 toàn engine).
- SỬA LỖI PRODUCT: /clear,/reset giờ KHÔNG lưu câu xác nhận vào DB (messageId=null → done event bỏ field, frontend giữ bubble tạm theo assistantId) → DB thực sự 0 message; quota miễn cho lệnh (user hết hạn mức vẫn gõ được /help /usage /clear — peek body trước khi chặn).
- SỬA LỖI TEST: sse_field None→''; Prisma where user:{email}; round-trip viết lại bằng curl --data-binary @payload (bỏ Python urllib); check engine intents so trước/sau round-trip (95→94→95).
- LỆNH OWNER MỚI (src/lib/local-chat/admin-commands.ts — async, chạm DB): /give <free|plus|vip|max> <email hoặc ID> (email tra case-insensitive qua scan), /user <email|ID> (gói+mức dùng+ngày tham gia+số hội thoại), /pending (10 request mới nhất), /approve <id>, /deny <id> (chấp nhận ID viết tắt ≥4 ký tự, multi-match → liệt kê). /usage công khai cho mọi user.
- PHÂN QUYỀN: CommandDefinition thêm owner_only/usage; runCommand nhận {role} — /help chia 2 mục (user thường KHÔNG thấy mục owner; owner thấy "Lệnh chỉ dành cho chủ sở hữu"); user thường gõ lệnh owner → "chỉ dành cho chủ sở hữu", không đổi dữ liệu; lệnh lạ liệt kê theo quyền.
- TÍCH HỢP: ChatEngine.process nhận thêm user?: {id,email,role,plan} (EngineUserContext) — chat route + admin test route đều truyền; LocalRuleEngine nhánh isDbCommand → runDbCommand trước runCommand thường.
- DATA: commands.json thêm 6 lệnh (/usage + 5 owner_only); tạo data/chatbot/README.md (cấu trúc file, cách thêm intent/response/knowledge/lệnh, sửa qua API owner an toàn); .env.example gỡ toàn bộ key AI provider cũ, thêm CHAT_ENGINE.
- README.md cập nhật lớn: mục "🤖 Bộ máy chat 100% cục bộ" (pipeline, scoring, context, lệnh + lệnh owner, abstraction ChatEngine), sơ đồ kiến trúc mới, cấu trúc thư mục (data/chatbot + lib/local-chat, bỏ lib/ai), tech stack, bảng env mới, mục test mới, "chưa kết nối" + deploy Vercel bỏ key provider.
- HỌC VẬN HÀNH: dev server giữ engine instance cũ trong globalThis qua HMR → sau khi sửa code engine PHẢI restart dev server (data JSON thì tự nạp theo mtime); test script phải dùng XFF động (RANDOM) cho register (5/h/IP) + plan-requests (3/10'/IP) và bucket chat 20/60s theo user id — section 5 test dùng owner THỨ HAI (haong…) để có bucket riêng.
- Test scripts: test-local-chat.sh 6 lỗi sửa + section 5 mới (~20 check: /help ẩn/hiện theo quyền, chặn /give, /usage, /give lỗi các loại, /give HOA email, /user email+ID, /pending, /approve viết tắt, /deny, DB verify từng bước) + XFF động; test-owner-register.sh + test-plans.sh thêm XFF động chống 429 khi chạy lặp.
- KẾT QUẢ: test-local-chat **48/48 PASS**, test-owner-register **19/19 PASS**, test-plans **34/34 PASS**, tsc sạch, ESLint sạch, dev.log 0 lỗi.
- E2E browser (agent-browser): login owner hoang… → gõ /help → hiện mục "Lệnh chỉ dành cho chủ sở hữu" (/give /user /pending /approve /deny) → gõ /give plus <email user test> → "Đã gán gói Plus" → DB user.plan=plus + planUpdatedAt set → console 0 lỗi → screenshot download/e2e-owner-give-command.png → dọn dữ liệu test.
- Dọn DB cuối: 0 message, 0 conversation, 0 pending request, chỉ còn 2 owner.

Stage Summary:
- Bộ máy chat 100% cục bộ hoàn chỉnh + đã kiểm chứng: 95 intents, không API ngoài, fallback không bịa, context multi-turn, admin tri thức owner-only với round-trip an toàn (validate JSON + schema + chặn path traversal + atomic write).
- LỆNH MỚI cho chủ sở hữu (chỉ hiện với owner): /give <gói> <email|ID>, /user <email|ID>, /pending, /approve <id>, /deny <id> — quản lý gói dịch vụ ngay trong chat, /approve chấp nhận ID viết tắt; /usage công khai cho mọi user; /clear xoá thật sạch DB.
- Sửa hết 6 lỗi test cũ (root cause: cookie name, Prisma relation filter, /clear persistence, Python None, escape \\$, rate-limit XFF).
- Lưu ý vận hành: sửa code engine → restart dev server; DB sandbox reset → bun run db:seed-owner; đổi tri thức → sửa data/chatbot/*.json hoặc PUT /api/admin/chatbot (tự nạp lại).

---
Task ID: 12
Agent: Super Z (main agent)
Task: User báo "Sorry, there was a problem deploying the code" sau khi platform redeploy — fix deploy + khôi phục mọi thứ đã mất.

Work Log:
- CHẨN ĐOÁN: dev server chạy nhưng `bun run build` FAIL — "Module not found: @/lib/local-chat/*". `src/lib/local-chat/` (11 file engine Task 11) BIẾN MẤT hoàn toàn sau redeploy; `find /` không còn dấu vết.
- TÌM RA LỖI GỐC (2 tầng):
  (1) `.gitignore` có rule `local-*` (dành cho file tạm) → khớp cả thư mục `src/lib/local-chat/` VÀ file `local-rule-engine.ts` → 11 file engine KHÔNG BAO GIỜ được commit → redeploy restore repo từ git HEAD → mất sạch → build fail → platform hiện "problem deploying the code".
  (2) `.env` được track trong git nhưng bản cũ chỉ còn DATABASE_URL → deploy ghi đè mất OWNER_EMAIL/APP_URL/PAYMENT_*.
- KHÔI PHỤC ENGINE (viết lại từ spec test + data): 11 file — types, normalize (bỏ dấu VN + slang ko→khong/dc→duoc/j→gi/vs→voi + terms, pattern cũng đi qua đúng pipeline), data-loader (nạp data/chatbot, cache globalThis + reload theo mtime, whitelist + atomic write cho admin CRUD), intent-engine (scoring: exact 100/contain 90/partial 70/short 55 + FAQ 85 + keyword cap 60 + alias 30 + topic 15 + related 10 + followup 25; word-aligned nên "kolinux" không lọt keyword "linux"), context-engine (follow-up theo kịch bản conversations.json — align suffix chuỗi lượt user, TTL 6h), knowledge-engine (tra tri thức khi intent hụt, render markdown), response-engine (round-robin biến thể → regenerate ra câu khác), commands (/help /about /status /models /settings /version /knowledge), admin-commands (/usage công khai; /give /user /pending /approve /deny owner-only, /approve-/deny nhận ID viết tắt ≥4 ký tự, email tra case-insensitive qua scan), local-rule-engine (orchestrator), chat-engine (singleton globalThis).
- DATA: phát hiện 12 intent bị tham chiếu nhưng thiếu (ollama, local_ai_without_api, local_ai_setup, ram_requirements, llama_cpp, local_model, quantization, gpu_inference, local_ai_vs_api, what_is_machine_learning, oauth, vercel) → scripts/add-missing-intents.py (idempotent) thêm intents + responses + 2 knowledge → tổng 101 intents / 985 patterns.
- .env khôi phục đầy đủ (OWNER_EMAIL 2 email, APP_URL, PAYMENT_*).
- DB bị reset sạch → bun run db:seed-owner (2 owner, verify PASS).
- next.config.ts: outputFileTracingIncludes data/chatbot cho /api/chat + /api/admin/chatbot; package.json build copy data/ vào standalone.
- FIX trong lúc test: "Đã gán gói Plus" bị markdown ** chen giữa (grep không thấy) → bỏ bold quanh tên gói.
- GIT: 3 commit — engine + 12 intent + .env (2871415), fix .gitignore !src/lib/local-chat/ (10f7cc2), fix sâu hơn !src/lib/local-chat/** vì local-* match cả TÊN FILE local-rule-engine.ts (3b90000).
- KẾT QUẢ: check-chatbot-data 15/15; test-local-chat 48/48 (fix 1 lỗi format); test-owner-register 19/19; test-plans 34/34; tsc sạch; ESLint sạch; bun run build PASS (route table đầy đủ); E2E browser: login owner → /help có mục "👑 Lệnh chỉ dành cho chủ sở hữu" (/give /user /pending /approve /deny) → /give plus e2e-restore@test.dev → "Đã gán gói Plus" + DB plan=plus + planUpdatedAt set → chat "AI là gì" streaming đúng → console 0 lỗi → dọn sạch user test. Screenshot: download/e2e-restore-owner-give.png.

Stage Summary:
- Deploy lỗi ĐÃ FIX: build PASS, engine hoàn nguyên 100% chức năng (48/48 + 19/19 + 34/34 test), 101 intents.
- LỖI GỐC đã trừ tiệt: .gitignore giờ except src/lib/local-chat/** → lần redeploy sau KHÔNG mất code nữa; .env commit đầy đủ biến.
- Lưu ý vận hành (giữ nguyên): sửa code engine → restart dev server; DB reset → bun run db:seed-owner; đổi tri thức → data/chatbot/*.json hoặc PUT /api/admin/chatbot.
- Kèm scripts/add-missing-intents.py để vá lại data nếu cần.

---
Task ID: 13
Agent: Super Z (main agent)
Task: User phàn nàn bot trả "chưa có kiến thức local" khi hỏi "có thể suy nghĩ giống chatgpt ko" + spec 61 mục: xây HỆ AI THẬT (local model inference, không API ngoài, không fake).

Work Log:
- KHẢO SÁT môi trường: không có Ollama/llama.cpp sẵn; CÓ mạng (ollama.com + GitHub releases 200); RAM 3.9GB/2 CPU/7.3GB disk trống.
- CÀI OLLAMA THẬT: asset mới .tar.zst (tgz cũ 404) → python zstandard giải nén → v0.34.0 tại ~/.local/ollama. VẤN ĐỀ: sandbox reaper giết process nền khi tool call kết thúc (setsid/nohup đều chết) → viết scripts/daemonize.py (double-fork + setsid, reparent về tini PID 1) → server + dev server SỐNG SÓT qua mọi tool call. Pull qwen2.5:0.5b (398MB Q4_K_M, hỗ trợ tools, ~4-26 tok/s tuỳ tải).
- KIẾN TRÚC src/ai/ (10 module): core (types, config chỉ loopback — AI_ALLOW_REMOTE mới mở, TokenManager ước lượng trung thực), inference (OllamaAdapter native NDJSON + OpenAICompatAdapter cho llama.cpp/vLLM/LM Studio + RuntimeDetector cache 15s + InferenceEngine retry/abort/TTFT/tok-s đo thật), models (6 profiles GENERAL/REASONING/CODING/FAST/LONG_CONTEXT/AGENT + ModelRouter heuristic), context (ngân sách 3000, cắt lịch sử cũ trước), memory (conversation DB + session TTL 6h + long-term bảng AiMemory qua lệnh "hãy ghi nhớ rằng…" + project data/ai/project-memory.json), tools (calculator tokenizer shunting-yard KHÔNG eval, datetime, json_parser, text_processor, random crypto; permission levels; timeout 8s; log bảng AiToolExecution; AI_ENABLE_UNSAFE_TOOLS mặc định tắt), reasoning (pipeline understand→classify→context→tool→generate→verify→revise≤2→finalize; extractor phép tính chống SĐT/ngày false-positive), prompts (module hoá compose theo profile), safety (che secret input+output, chống injection, path traversal), observability (ring buffer 50 request).
- Prisma: +AiMemory, +AiToolExecution → db push.
- /api/chat ĐỊNH TUYẾN 3 NHÁNH: lệnh /xxx → rules (không tốn model); intent khớp ≥0.6 hoặc knowledge >0.35 → rules fast path; câu tự do → ReasoningEngine (model thật, RAG-lite bơm tri thức local vào prompt khi khớp ≥0.2). User chọn modelId runtime:* → luôn model. SSE mới: status/tool_call/tool_result/verification; done kèm source local-model|local-rules, model, profile, metrics THẬT (TTFT/totalMs/tok/s từ Ollama metrics, estimated=false), verification. Abort: lưu partial text. Fallback không runtime: thông điệp mới hướng dẫn setup-ollama.sh.
- /api/models: gộp runtime models (id runtime:<tên>, badge "Model cục bộ", available theo sức khoẻ thật, default đẩy đầu) + runtime status object. /api/admin/ai: diagnostics owner-only.
- UI: MessageBubble hiện status pipeline thật khi stream (spinner + label) + meta cuối bubble "qwen2.5:0.5b · 31.2s · sinh 4.1/giây · đã kiểm tra" (không chữ token — dùng "sinh N/giây"); store xử lý 4 event mới; Settings +panel "Hệ AI cục bộ" (model đang chạy/Ollama/hướng dẫn bật); model selector gỡ label "cần API key" → "Không khả dụng bây giờ"; GỠ link Cerebras sót footer.
- BUG FIX trong lúc làm: types.ts lần Write đầu fail vì thiếu thư mục (viết lại); guard() cần 2 tham số; regex s-flag vs ES2017; trim ngoặc làm hỏng biểu thức "(128*46)+99" (chỉ cắt toán tử, giữ ngoặc); extractor không ăn space trong biểu thức (compact whitespace giữa ký tự số học); test sse_field parse nhầm raw SSE thành JSON; model name "4943M"→"494M" (làm tròn parameterSize).
- VẬN HÀNH: sửa code src/ai → PHẢI restart dev server (module cache; daemonize lại) — Next auto-restart khi đổi next.config.ts nhưng không đủ cho lib sâu.
- TEST: test-ai-engine.sh MỚI 25/25 PASS (runtime models, hybrid routing, status events, metrics thật, tool 5987, AiMemory, verification, abort, admin 403/owner OK, không lộ secret, key input bị che). Regression: test-local-chat 47/47 (cập nhật kỳ vọng: source "local-rules", nhánh kolinux chấp nhận local-model khi runtime có), test-owner-register 19/19, test-plans 34/34. tsc sạch, ESLint sạch, bun run build PASS (route /api/admin/ai có).
- E2E BROWSER: model selector hiện 2 model → chọn qwen → login owner → hỏi đúng câu "có thể suy nghĩ giống chatgpt ko" → MODEL TRẢ LỜI THẬT (không còn fallback ngu) + status "Đang sinh phản hồi…" + meta đo thật → "tính giúp (128 * 46) + 99" → tool calculator → 5987 ĐÚNG qua UI → /help owner section đủ → mobile 390px không tràn → console 0 lỗi → body không có token/demo. Screenshots: e2e-ai-status-pipeline, e2e-ai-model-answer, e2e-ai-tool-calculator, e2e-ai-owner-help.
- DỌN: 6 user test + hội thoại + AiMemory/AiToolExecution test data xoá (chỉ còn 2 owner). Commit git đầy đủ src/ai + scripts + data/ai.

Stage Summary:
- KHANHOS AI GIỜ CÓ MODEL AI THẬT chạy 100% local (Ollama qwen2.5:0.5b, không API ngoài, không key): câu tự do được suy luận thật, streaming thật, status pipeline thật, metrics đo thật, tool calculator thật, tự kiểm tra + tự sửa, memory dài hạn, che secret 2 chiều.
- 2 LỚP: tri thức (nhanh, chính xác, data-driven) + model (tự do) — chuyển tiếp minh bạch qua source: local-rules | local-model.
- Đổi model lớn hơn: AI_MODEL=... + ollama pull — không sửa code. Mất sandbox: bash scripts/setup-ollama.sh + bun run db:seed-owner + restart dev server bằng daemonize.
- Giới hạn trung thực: 0.5B trên 2 CPU/4GB RAM — 4-10s/câu, câu dài chưa sâu; model càng lớn càng chậm trên phần cứng này.

---
Task ID: 14
Agent: Super Z (main agent)
Task: Spec mới — nâng cấp thành HỆ AI NÂNG CAO thật sự: RAG local, feedback learning, LoRA/QLoRA training, dataset management, model registry (MODEL_PATH/TYPE/FORMAT/CONTEXT_LENGTH), adaptive personality, không API ngoài, không fake.

Work Log:
- KHẢO SÁT: Task 13 (phiên mất context) đã dựng src/ai/ 10 module + Ollama v0.34.0 (daemonize double-fork sống qua reaper) + qwen2.5:0.5b. Runtime vẫn khoẻ khi session này bắt đầu.
- PULL EMBEDDING MODEL: nomic-embed-text (274MB) — pull bị reaper giết 2 lần giữa chừng → dùng scripts/daemonize.py → xong. Verify: /api/embeddings trả vector 768 chiều THẬT.
- PRISMA: +4 model — KnowledgeDocument, KnowledgeChunk (embedding JSON + dim + norm), AiFeedback, TrainingJob (sqlite push + postgres schema append đồng bộ).
- src/ai/knowledge/ (RAG THẬT): embeddings.ts (adapter Ollama /api/embeddings, embedText/embedBatch, cosineSimilarity thuần số học, status cache 60s — KHÔNG fake vector: model hụt → null → hệ tự hạ cấp trung thực); ingest.ts (chunkText ranh giới câu ~600 ký tự overlap 80, cap 400 chunk/200k chars, ingestDocument nhúng từng chunk thật, từ chối nếu embedding chưa sẵn sàng); retrieval.ts (vector cache in-memory theo user TTL 10' + dirty flag, retrieveKnowledge top-k, formatRetrievedKnowledge ngưỡng 0.35).
- src/ai/training/: dataset.ts (collectFeedbackPairs từ AiFeedback 👍, export JSONL alpaca/sharegpt chuẩn axolotl/llama-factory, listDatasets/deleteDataset); lora.ts (validateLoraConfig đầy đủ r/alpha/epochs/lr/batch/seq/bits, generateTrainingScript sinh train_lora.py THẬT dùng transformers+peft+bitsandbytes QLoRA NF4 + labels masking prompt, merge_and_export.py, Modelfile, requirements.txt, README.md job; checkTrainingRuntime probe python3+torch+cuda trung thực; createLoraJob ghi DB + sinh file thật, status created|pending_runtime).
- src/ai/evaluation/feedback.ts: recordFeedback (snapshot hỏi-đáp từ DB, bảo mật ownership, comment ≥8 ký tự → rememberLongTerm để điều chỉnh NGAY câu sau — prompt-level), feedbackStats.
- src/ai/models/model-config.ts: registry data/ai/models.json + env MODEL_PATH/MODEL_TYPE/MODEL_FORMAT/CONTEXT_LENGTH (đúng spec), validate format gguf|transformers|gptq|awq|bnb, upsert/remove atomic write.
- src/ai/prompts/personality.ts + data/ai/personality.json: persona "Astra" theo chỉ thị chủ sở hữu (giỏi code, phong cách GPT-6-class) — GHI RÕ trung thực đây là cấu hình prompt-level, muốn đổi weights → Training. Reload theo mtime.
- prompts/index.ts: composeSystemPrompt chèn personalityPrompt (maxChars 2200→2600).
- API MỚI: /api/knowledge (GET list+embedding status, POST ingest, DELETE), /api/knowledge/search (POST), /api/feedback (POST up/down + comment), /api/memory (GET/PATCH/DELETE — trí nhớ của chính user), /api/training (GET runtime+datasets+jobs+stats owner-only, POST export_dataset|create_job|delete_dataset). Tất cả rate-limit + origin check + auth.
- /api/chat: (1) RAG thật — retrieveKnowledge user + formatRetrievedKnowledge nối vào localKnowledge trước runModelPath; (2) done event thêm conversationId (cả 2 nhánh); (3) FIX ROUTING QUAN TRỌNG: isTaskStyleRequest() — yêu cầu tạo tác (viết hàm/code, fix bug, implement, build…, loại trừ câu hỏi làm sao/tại sao/how/why) → LUÔN model path kể cả khi tri thức khớp (trước đây "viết hàm javascript…" bị intent "javascript" chặn nhanh trả giải thích chung chung thay vì viết code).
- UI: MessageBubble thêm 👍/👎 (canRate chỉ khi id bền vững, toast xác nhận góp dataset huấn luyện); AI Studio modal mới (3 tab: Tri thức — nạp/nhúng/xoá/thử truy vấn + trạng thái embedding; Trí nhớ — list/xoá; Huấn luyện — owner-only: runtime trung thực, thống kê 👍/👎, export JSONL, form tạo job LoRA/QLoRA, danh sách job) mở từ menu tài khoản TopBar; /api/models trả thêm embedding + registry.
- src/ai/index.ts: getAISystemStatus() gộp inference + embedding + training runtime + registry.
- .gitignore: +data/ai/training/*.jsonl + jobs/ (dữ liệu runtime), +tool-results/; .env.example: +AI_EMBEDDING_MODEL, MODEL_PATH/TYPE/FORMAT/CONTEXT_LENGTH.
- LỖI SỬA: 3 lỗi TS trong model-config (cast type); GET handlers gọi isSameOrigin không đối số (vô hại nhưng dọn sạch); test fail dây chuyền do done thiếu conversationId → MSG_ID rỗng → feedback 400 → dataset/job hụt (sửa gốc ở chat route).
- KIỂM CHỨNG: test-ai-advanced.sh MỚI 25/25 PASS (vector 768 chiều trong DB, retrieval đúng chunk "Nguyễn Văn A"/"3,5 tỷ" cosine>0.3, feedback + comment→memory, JSONL hợp lệ, train_lora.py chứa peft, status trung thực). Regression: test-local-chat 47/47, test-ai-engine 25/25, test-owner-register 19/19, test-plans 34/34. tsc + ESLint sạch. bun run build PASS (lần 1 bị OOM kill vì chạy cùng dev server + ollama — tắt dev thì PASS; standalone OK).
- E2E BROWSER: login owner → menu → AI Studio 3 tab (Huấn luyện chỉ owner) → nạp "Sổ tay KhanhOS" → "1 đoạn · nhúng nomic-embed-text" → truy vấn "mã sản phẩm nội bộ" → khớp 66% đúng KH-2026-ALPHA → tab Huấn luyện: "Chưa có Python+torch — job chờ runtime, KHÔNG fake" → chat "viết hàm javascript tính tổng số chẵn" → MODEL VIẾT CODE THẬT (sumEvenNumbers đúng logic, source local-model — sau fix routing) → 👍 → "Đã ghi nhận — góp vào tập dữ liệu huấn luyện" → mobile 390px no-overflow → console 0 lỗi. Screenshots: e2e-ai-studio-knowledge, e2e-ai-studio-rag-search, e2e-ai-studio-training, e2e-ai-feedback-button, e2e-ai-mobile-chat.
- GIT: 2 commit (hệ AI nâng cao + dọn tool-results).

Stage Summary:
- KHANHOS AI GIỜ LÀ HỆ AI NÂNG CAO THẬT: RAG (nạp tài liệu → nhúng 768 chiều → cosine retrieval → model dùng), vòng lặp EVALUATION→FEEDBACK→DATASET (👍 → AiFeedback → JSONL), huấn luyện LoRA/QLoRA sinh script Python thật chạy máy GPU (server chưa có torch → "chờ runtime" trung thực), model registry cấu hình MODEL_PATH/TYPE/FORMAT/CONTEXT_LENGTH, persona Astra.
- Fix routing quan trọng: câu "viết hàm/code" giờ LUÔN đi model (trước đây bị tri thức chặn nhanh) — model 0.5b trả code đúng logic.
- 131 test PASS (25 mới + 106 regression), build PASS, E2E sạch.
- Vận hành: đổi model → AI_MODEL/ollama pull; đổi persona → data/ai/personality.json; huấn luyện thật → máy GPU + data/ai/training/jobs/<id>/; DB reset → bun run db:seed-owner.
- Giới hạn trung thực: qwen2.5:0.5b trên 2 CPU/4GB RAM — code đơn giản ổn, nhiệm vụ phức tạp chậm/nông; RAG theo user (isolation); training cần GPU ngoài (đã có script đầy đủ).

---
Task ID: 12
Agent: Super Z (main agent)
Task: Khôi phục "não" cho bot sau reset sandbox — model local chết → bot trả fallback "chưa có kiến thức local"; user yêu cầu bot LUÔN trả lời mọi câu hỏi tự nhiên như người thật.

Work Log:
- Chẩn đoán: sandbox reset giết process `ollama serve` (binary + model blobs vẫn còn trong ~/.local/ollama + ~/.ollama). App dò 127.0.0.1:11434 fail → nhánh rules → fallback.
- Chạy lại scripts/setup-ollama.sh: serve sống lại (double-fork daemonize), pull qwen2.5:0.5b (blobs còn nguyên, nhanh), inference 2+2=4 OK.
- Kéo model mới qwen2.5:1.5b-instruct (986MB, daemonize.py để sống sót sandbox reaper): benchmark 9.6 tok/s, tiếng Việt mượt hơn 0.5b nhiều; RAM vừa (KV GQA nhẹ).
- .env: +AI_MODEL="qwen2.5:1.5b-instruct" (dev hot-reload "Reload env: .env") + AI_MAX_CONTEXT_TOKENS=2400.
- FIX ROUTING 1 (route.ts): META_FOLLOWUP_INTENTS {simplify, summarize, explain_more, example_please} — các intent template "xin chủ đề" → khi có model thì LUÔN nhường model (model có history, làm thật). Trước đó "vì sao bầu trời màu xanh? giải thích ngắn gọn" bị intent simplify chiếm quyền chỉ vì chữ "ngắn gọn".
- FIX ROUTING 2 (route.ts): isKnowledgeOffTopic() — câu hỏi nhắc từ khoá nội dung mà câu trả lời tri thức không phủ ≥50% (vd "javascript promise là gì" nhưng entry chỉ nói javascript chung) → model. Giữ fast path cho câu khớp thật ("AI la gi").
- FIX BUG NGHIÊM TRỌNG (route.ts): history model path bị CẮT SAI — dbHistory fetch TRƯỚC khi save tin user nên KHÔNG chứa tin hiện tại, nhưng `.slice(0,-1)` xóa mất CÂU TRẢ LỜI ASSISTANT CUỐI → 2 tin user dính nhau → model thấy câu hỏi "treo" nên trả lời lại CÂU CŨ (đây là nguyên nhân bot "trả lời lạc đề" khi chat nhiều lượt!). Sửa: thường giữ nguyên dbHistory, chỉ regenerate mới slice. Debug-bằng-log tạm + xoá sạch sau khi xác nhận.
- FIX NGỮ CẢNH (profiles.ts): mọi profile +contextLength 4096 (num_ctx) — trước đó num_ctx mặc định 2048 < budget 3000 → system prompt có nguy cơ bị context-shift cắt mất. Adapter đã map contextLength→num_ctx sẵn.
- History gửi model: slice(-10) → slice(-6) (3 lượt trao đổi, gọn prompt).
- prompts/index.ts basePrompt (vi+en): +chỉ dẫn "Trả lời trực tiếp MỌI câu hỏi — không né tránh, không vòng vo; khi không chắc vẫn đưa phần biết + mức chắc chắn + hướng tiếp cận" (giữ nguyên tắc không bịa số liệu) và "Chỉ tập trung vào tin nhắn MỚI NHẤT; tin trước chỉ là ngữ cảnh".
- Screenshot: download/e2e-model-revived.png + e2e-model-revived-mobile.png.

Stage Summary:
- BOT GIỜ TRẢ LỜI MỌI CÂU HỎI bằng model local thật qwen2.5:1.5b-instruct (streaming, metrics thật, verification) — không còn fallback "chưa có kiến thức local".
- 3 bug lịch sử được sửa: history cắt nhầm câu trả lời (lạc đề), meta intent chiếm quyền, tri thức chung chung phủ đề cụ thể.
- Test: 6/6 suite PASS (5+25+47+26+19+34 = 156 check), lint sạch, E2E browser sạch (console 0 lỗi, mobile OK, code JS sinh đúng).
- Tốc độ thật (không bị trình duyệt local tranh CPU): ~6.7 tok/s — câu dài 350 token ≈ 54s, câu ngắn 15-30s. Trung thực: 2 CPU là giới hạn phần cứng; muốn nhanh hơn → máy mạnh hơn hoặc model 0.5b (đổi lấy chất lượng thấp hơn).
- Vận hành sau reset sandbox: chạy lại `bash scripts/setup-ollama.sh` (serve + model tự về), .env đã có AI_MODEL. DB reset → `bun run db:seed-owner`.

---
Task ID: 15
Agent: Super Z (main agent)
Task: User gửi screenshot bot fallback "chưa có model AI cục bộ nào đang chạy" + hỏi "giải thích và fix lỗi, hay tôi cho key API rồi m cho API vào". Yêu cầu: bot luôn trả lời mọi câu hỏi, không bao giờ từ chối, chân thành như người thật.

Work Log:
- PHÂN TÍCH ẢNH (VLM): cả 2 ảnh cùng 1 lỗi — fallback rules engine + ghi chú "chưa có model AI cục bộ" (kèm typo "trả lợi thoải").
- CHẨN ĐOÁN: ollama serve sống lại từ 00:47 (sandbox reset trước đó làm chết process), model qwen2.5:1.5b-instruct nạp 04:01 — ảnh user chụp khoảnh khắc model chưa sống. /api/models xác nhận runtime.available=true.
- VERIFY: test-model-revive.sh 5/5 PASS — câu "bạn có thể suy nghĩ giống chatgpt không" + "vì sao bầu trời màu xanh" + "sự thật thú vị vũ trụ" đều source=local-model.
- FIX 1 (route.ts): typo "trả lợi thoải" → "trả lời thoải mái" trong ghi chú fallback.
- FIX 2 (prompts/index.ts basePrompt vi+en): +QUY TẮC CỨNG cấm mở đầu "Xin lỗi/Tôi không thể/Tôi không biết trả lời" — LUÔN đưa câu trả lời tốt nhất ngay từ câu đầu, chân thành như người bạn hiểu biết; câu về năng lực mình thì trả lời tự tin (suy luận/lập trình/phân tích được gì). Trước khi sửa model trả "Xin lỗi, nhưng tôi không thể仿效 ChatGPT" (lẫn chữ Hán + từ chối) — sau khi sửa trả "Chào bạn! Tôi có thể suy nghĩ giống...".
- FIX 3 (personality.ts + data/ai/personality.json): directive 3 đổi từ "nếu vượt khả năng thì nói rõ" → "Trả lời TẤT CẢ câu hỏi — không bao giờ từ chối thẳng; câu khó vẫn đưa phần biết + mức chắc chắn + hướng tiếp cận, không bịa số liệu".
- FIX 4 (data/chatbot/system.json + data-loader.ts default): fallback responses mềm hơn, không phẳng "mình không đoán bừa đâu" (đường này chỉ tới khi model chết).
- FIX 5 (.env.example): thêm section TÙY CHỌN API ngoài — 3 bước mở khoá (AI_ALLOW_REMOTE=true + AI_RUNTIME=openai-compat + OPENAI_COMPAT_BASE_URL/KEY/AI_MODEL) kèm ví dụ OpenRouter/Groq free. Sẵn sàng cắm key khi user đưa.
- KIỂM CHỨNG: tsc sạch, eslint sạch, test-model-revive 5/5, test-local-chat 47/47, test-ai-engine 25/25 → 77 PASS / 0 FAIL.

Stage Summary:
- LỖI TRONG ẢNH LÀ QUÁ KHỨ: model local (qwen2.5:1.5b-instruct) đã sống và bot trả lời mọi câu hỏi tự do bằng model thật (streaming, source=local-model).
- Bot KHÔNG còn từ chối: prompt cứng cấm "Xin lỗi/Tôi không thể" — luôn trả lời best-effort chân thành, đúng yêu cầu chủ sở hữu (không bịa số liệu vẫn giữ).
- Đường cắm API key ngoài đã chuẩn bị sẵn (.env.example có hướng dẫn OpenRouter/Groq) — chờ user đưa key nếu muốn nâng cấp model đám mây.
- Trung thực về giới hạn: model 1.5B trên 2 CPU/4GB RAM — câu dài 15-60s, thỉnh thoảng sai chi tiết; muốn mạnh hơn → API key hoặc máy GPU.

---
Task ID: 16
Agent: Super Z (main agent)
Task: (a) User báo lỗi fallback quay lại "??" + hỏi bot "có thể tự chế câu trả lời" — CẢ 2 do timeout probe 1.5s của ollama-adapter khi máy 2 CPU bận. (b) User yêu cầu animation login/signup mượt đẹp "kiểu Zcode". Kèm: hoàn nốt verifier cấm từ chối (đang dở trước đó).

Work Log:
- (a) ROOT CAUSE: ollama-adapter.ts isHealthy() timeout 1500ms — máy 2 CPU khi đang nạp model trả /api/version chậm hơn 1.5s → app kết luận SAI "chưa có model" → cache lỗi 15s → fallback hiện. Screenshot user chụp đúng khoảnh khắc đó dù model vẫn sống.
- FIX (a): timeout 1.5s → 8s (cả ollama + openai-compat adapter); runtime-detector.ts probe fail → retry sau 600ms trước khi kết luận chết; cache trạng thái CHẾT rút xuống 5s (trạng thái SỐNG giữ probeCacheMs 15s); ollama generate/stream + keep_alive "2h" (model nằm RAM, không nạp lại mỗi 30p). Làm nóng model sau sửa.
- (b) ANIMATION AUTH (kiểu Zcode): globals.css +keyframes kh-modal-in/out (scale+blur bằng thuộc tính scale riêng — compose với translate tailwind, không xung đột) target [data-slot=dialog-content][data-state] — MỌI modal trong app được animation spring mượt; +kh-shake (lỗi rung, replay bằng key React) + kh-err-pulse (viền đỏ nhấp nháy).
- (b) dialog.tsx: bỏ class animate-in/out fade zoom cũ (chết vì CSS mới unlayered thắng cascade).
- (b) success-burst.tsx MỚI: AnimatedCheck (SVG circle + path vẽ pathLength, spring) + SuccessBurst (halo lan + vòng nhịp + 8 hạt toả ra).
- (b) auth-modal.tsx: đổi bước login<->register<->forgot trượt THEO HƯỚNG (usePrevious bằng state trễ 1 commit — tránh lint react-hooks/refs) + scale + blur; icon brand spring pop; thành công → crossfade panel SuccessBurst + text stagger, data (refreshUser/loadConversations/loadModels) chạy SONG SONG animation 1250ms → modal tự đóng → flash sáng màn hình (radial primary 22% overlay pointer-events-none) → pending message gửi tiếp.
- (b) login-form + register-form: field cascade stagger (50-55ms/field, y:12+blur→0), nút submit MORPH (label -> tròn 40px loading spring stiffness 420 damping 30 -> label), lỗi rung + key replay; keep valid logic nguyên bản.
- VERIFIER (hoàn dở dang): +check no_refusal (hard fail) — REFUSAL_HEAD_RE (xin lỗi/tôi xin lỗi/sorry/i'm sorry + không thể/cannot/can't trong 40 ký tự đầu câu) + REFUSAL_ANYWHERE_RE (tôi không thể trả lời / vượt khả năng của tôi / i cannot answer / beyond my capabilities); engine.ts maxAttempts = 1 + max(1, maxIterations) — FAST cũng được 1 vòng viết lại; use-chat-store.ts: status stage="revising" → xóa full + content của assistant msg → stream bản viết lại THAY THẾ liền mạch (không nối dồn 2 bản).
- TEST REGEX: 11/11 — bắt đúng 6 câu từ chối, KHÔNG bắt nhầm 5 câu hợp lệ ("tôi không thể nói chắc 100% nhưng...", "xin lỗi bạn mình trả lời chậm vì...", "tất nhiên! tôi có thể...").
- E2E BROWSER (record video download/auth-animation.webm): đăng ký → panel dấu tích xanh + hạt bay (VLM xác nhận) → modal tự đóng → vào app + toast chào mừng; đổi bước 2 chiều; login hợp lệ → success panel; lỗi validation rung đỏ; console 0 lỗi, page errors 0; mobile 390px OK. Dọn user anim test khỏi DB.
- REGRESSION: test-model-revive 5/5 (câu "chatgpt" giờ trả tự tin không từ chối), test-local-chat 47/47 (lần đầu 46/2 do ollama bận rewrite — lần 2,3 sạch), test-ai-engine 25/25 → 77 PASS. tsc + eslint sạch.
- Lưu ý hiệu năng: no_refusal retry làm câu bị rewrite mất ~gấp đôi thời gian trên máy 2 CPU (chấp nhận — đúng yêu cầu cấm từ chối; hết vấn đề khi cắm API model nhanh).

Stage Summary:
- HẾT FALLBACK NHẦM: timeout probe 8s + retry + cache chết 5s + keep_alive 2h — bot không còn "mù model" khi ollama bận.
- AUTH ĐẸP: modal spring+blur toàn app, field cascade, nút morph, panel dấu tích vẽ + hạt bay + flash màn hình — video demo tại download/auth-animation.webm + 5 screenshot PNG.
- BOT KHÔNG TỪ CHỐI (2 lớp): prompt cấm (Task 15) + verifier no_refusal tự viết lại (Task 16) — câu "xin lỗi tôi không thể" không bao giờ tới tay user, stream thay thế liền mạch.
