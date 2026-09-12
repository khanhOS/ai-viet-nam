#!/bin/bash
# KhanhOS AI — Xác minh model local sống lại sau reset sandbox
# Phủ: runtime probe → chat SSE câu tự do/khó → source phải là local-model (KHÔNG rơi fallback)
BASE="http://localhost:3000"
PASS=0; FAIL=0
JAR="/tmp/kh-revive.jar"

check() {
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "✔ $1";
  else FAIL=$((FAIL+1)); echo "✘ $1 — expected [$2] got [$3]"; fi
}

sse() { python3 -c "
import sys, json, re
raw = sys.stdin.read()
events = [json.loads(x) for x in re.findall(r'^data: (.+)$', raw, re.M) if x]
done = [e for e in events if e.get('type') == 'done']
v = done[0].get('$1', '$2') if done else '<no-done>'
print(v if v is not None else '')
"; }

chat() { curl -s -N --max-time 120 -X POST $BASE/api/chat -H "Content-Type: application/json" -b "$1" -d "$2"; }

echo "═══ 0. Ollama runtime trực tiếp ═══"
v=$(curl -s --max-time 5 http://127.0.0.1:11434/api/version | head -c 40)
[ -n "$v" ] && { PASS=$((PASS+1)); echo "✔ ollama server sống: $v"; } || { FAIL=$((FAIL+1)); echo "✘ ollama server chết"; }

echo ""
echo "═══ 1. Đăng ký user test ═══"
TS=$(date +%s%3N)
EMAIL="revive-$TS@test.dev"
rm -f $JAR
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -c $JAR -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" -H "X-Forwarded-For: 10.98.0.1" \
  -d "{\"name\":\"Revive Test\",\"email\":\"$EMAIL\",\"password\":\"12345678\",\"confirmPassword\":\"12345678\"}")
check "đăng ký (200)" "200" "$code"

echo ""
echo "═══ 2. Câu user bị fail: 'bạn có thể suy nghĩ giống chatgpt không' ═══"
raw=$(chat $JAR '{"content":"bạn có thể suy nghĩ giống chatgpt không","modelId":"khanhos-core"}')
src=$(echo "$raw" | sse source "?")
check "source == local-model" "local-model" "$src"
echo "  → trả lời: $(echo "$raw" | sse content "" | head -c 220)"

echo ""
echo "═══ 3. Câu khó tự do (vì sao bầu trời màu xanh) ═══"
raw=$(chat $JAR '{"content":"vì sao bầu trời lại màu xanh? giải thích ngắn gọn","modelId":"khanhos-core"}')
src=$(echo "$raw" | sse source "?")
check "source == local-model" "local-model" "$src"
echo "  → trả lời: $(echo "$raw" | sse content "" | head -c 220)"

echo ""
echo "═══ 4. Không còn chuỗi fallback cũ ═══"
raw=$(chat $JAR '{"content":"hãy kể mình nghe một sự thật thú vị về vũ trụ","modelId":"khanhos-core"}')
if echo "$raw" | rg -q "chưa có kiến thức local"; then FAIL=$((FAIL+1)); echo "✘ vẫn rơi fallback";
else PASS=$((PASS+1)); echo "✔ không còn fallback 'chưa có kiến thức local'"; fi
echo "  → trả lời: $(echo "$raw" | sse content "" | head -c 260)"

echo ""
echo "══════════════════════════════"
echo "KẾT QUẢ: $PASS PASS / $FAIL FAIL"
[ $FAIL -eq 0 ] && echo "✅ MODEL LOCAL SỐNG LẠI — BOT TRẢ LỜI MỌI CÂU" || echo "❌ CÒN LỖI"
