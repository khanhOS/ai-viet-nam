#!/bin/bash
# KhanhOS AI — E2E test HỆ AI CỤC BỘ (src/ai/) qua HTTP thật, cần dev server :3000
# Phủ: runtime detection → model list → pipeline status events → streaming thật
# → tool calculator thật → lệnh vẫn chạy khi model bật → hybrid routing
# → memory ghi nhớ → verification → diagnostics admin (owner only) → abort.
# Chạy: bash scripts/test-ai-engine.sh
BASE="http://localhost:3000"
PASS=0; FAIL=0
JAR="/tmp/kh-ai-engine.jar"; JAR_OWNER="/tmp/kh-ai-engine-owner.jar"

check() {
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "✔ $1";
  else FAIL=$((FAIL+1)); echo "✘ $1 — expected [$2] got [$3]"; fi
}

sse_field() { python3 -c "
import sys, json, re
raw = sys.stdin.read()
events = [json.loads(x) for x in re.findall(r'^data: (.+)$', raw, re.M) if x]
done = [e for e in events if e.get('type') == 'done']
v = done[0].get('$1', '$2') if done else '<no-done>'
print(v if v is not None else '')
"; }

sse_events() { python3 -c "
import sys, json, re
raw = sys.stdin.read()
events = [json.loads(x) for x in re.findall(r'^data: (.+)$', raw, re.M) if x]
print(json.dumps(events))
"; }

sse_has_status() { python3 -c "
import sys, json
events = json.loads(sys.stdin.read())
labels = [e.get('label','') for e in events if e.get('type') == 'status']
print('y' if any('$1' in l for l in labels) else 'n')
"; }

chat() { curl -s -N --max-time 120 -X POST $BASE/api/chat -H "Content-Type: application/json" -b "$1" -d "$2"; }

echo "═══ 0. Đăng ký user test ═══"
TS=$(date +%s%3N)
EMAIL="ai-e2e-$TS@test.dev"
rm -f $JAR
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -c $JAR -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" -H "X-Forwarded-For: 10.88.0.88" \
  -d "{\"name\":\"AI E2E\",\"email\":\"$EMAIL\",\"password\":\"12345678\",\"confirmPassword\":\"12345678\"}")
check "đăng ký user test (200)" "200" "$code"

echo ""
echo "═══ 1. /api/models — runtime model thật xuất hiện ═══"
MODELS_JSON=$(curl -s -b $JAR $BASE/api/models)
RUNTIME_OK=$(echo "$MODELS_JSON" | python3 -c "
import sys, json
d = json.load(sys.stdin)
rt = d.get('runtime') or {}
print('y' if rt.get('available') and rt.get('runtime') == 'ollama' else 'n')
")
check "runtime ollama available" "y" "$RUNTIME_OK"

RT_MODEL_ID=$(echo "$MODELS_JSON" | python3 -c "
import sys, json
d = json.load(sys.stdin)
m = [x for x in d.get('models', []) if x['id'].startswith('runtime:')]
print(m[0]['id'] if m else '')
")
check "có model runtime: trong list" "y" "$([ -n "$RT_MODEL_ID" ] && echo y || echo n)"

RT_AVAILABLE=$(echo "$MODELS_JSON" | python3 -c "
import sys, json
d = json.load(sys.stdin)
m = [x for x in d.get('models', []) if x['id'].startswith('runtime:')]
print('y' if m and m[0].get('available') else 'n')
")
check "model runtime available=true" "y" "$RT_AVAILABLE"

echo ""
echo "═══ 2. Hybrid routing — câu ngoài tri thức → MODEL (source=local-model) ═══"
EV=$(chat $JAR '{"content":"có thể suy nghĩ giống chatgpt ko","modelId":"khanhos-core"}')
check "câu mở rộng → source local-model" "local-model" "$(echo "$EV" | sse_field source '')"
MODEL_USED=$(echo "$EV" | sse_field model '')
check "done chứa tên model thật" "y" "$([ -n "$MODEL_USED" ] && echo y || echo n)"
check "status 'Đang phân tích' có" "y" "$(echo "$EV" | sse_events | sse_has_status 'phân tích')"
check "status 'Đang kiểm tra' có" "y" "$(echo "$EV" | sse_events | sse_has_status 'kiểm tra')"
METRICS_OK=$(echo "$EV" | python3 -c "
import sys, json, re
raw = sys.stdin.read()
events = [json.loads(x) for x in re.findall(r'^data: (.+)\$', raw, re.M) if x]
done = [e for e in events if e.get('type') == 'done']
m = (done[0].get('metrics') if done else None) or {}
print('y' if m.get('totalMs') and m['totalMs'] > 0 else 'n')
")
check "metrics thật (totalMs > 0)" "y" "$METRICS_OK"
CONTENT=$(echo "$EV" | sse_field content '' | head -c 60)
check "nội dung không rỗng" "y" "$([ -n "$(echo "$EV" | sse_field content '')" ] && echo y || echo n)"

echo ""
echo "═══ 3. Chọn model runtime: trực tiếp — luôn dùng model ═══"
EV=$(chat $JAR "{\"content\":\"giới thiệu bản thân ngắn gọn\",\"modelId\":\"$RT_MODEL_ID\"}")
check "modelId runtime → source local-model" "local-model" "$(echo "$EV" | sse_field source '')"
RT_NAME=$(echo "$RT_MODEL_ID" | sed 's/^runtime://')
check "model trả đúng tên đã chọn" "$RT_NAME" "$(echo "$EV" | sse_field model '')"

echo ""
echo "═══ 4. Intent khớp cao → vẫn trả bằng tri thức (fast path, không model) ═══"
EV=$(chat $JAR '{"content":"AI la gi","modelId":"khanhos-core"}')
check "intent what_is_ai vẫn nhận diện" "what_is_ai" "$(echo "$EV" | sse_field intent '')"
check "fast path → source local-rules" "local-rules" "$(echo "$EV" | sse_field source '')"

echo ""
echo "═══ 5. Lệnh vẫn chạy khi model bật (không đi qua model) ═══"
EV=$(chat $JAR '{"content":"/help","modelId":"khanhos-core"}')
check "/help → command:help" "command:help" "$(echo "$EV" | sse_field intent '')"
check "/help → local-rules" "local-rules" "$(echo "$EV" | sse_field source '')"

echo ""
echo "═══ 6. Tool calculator CHẠY THẬT cho phép tính ═══"
EV=$(chat $JAR '{"content":"tính giúp (128 * 46) + 99","modelId":"khanhos-core"}')
TOOL_OK=$(echo "$EV" | sse_events | python3 -c "
import sys, json
events = json.loads(sys.stdin.read())
tr = [e for e in events if e.get('type') == 'tool_result' and e.get('name') == 'calculator']
print('y' if any('5987' in (e.get('output') or '') for e in tr) else 'n')
")
check "calculator chạy thật → 128*46+99 = 5987" "y" "$TOOL_OK"
TOOL_LOG_OK=$(bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.aiToolExecution.count({where:{tool:'calculator',status:'ok'}}).then(c=>{console.log(c>0?'y':'n');return db.\$disconnect()})")
check "tool log ghi vào DB (AiToolExecution)" "y" "$TOOL_LOG_OK"

echo ""
echo "═══ 7. Long-term memory — 'ghi nhớ' của user được lưu ═══"
EV=$(chat $JAR '{"content":"hãy ghi nhớ rằng mình thích trả lời ngắn gọn","modelId":"khanhos-core"}')
sleep 1
MEM_OK=$(bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.aiMemory.count({where:{kind:'long_term'}}).then(c=>{console.log(c>0?'y':'n');return db.\$disconnect()})")
check "lệnh ghi nhớ → lưu AiMemory" "y" "$MEM_OK"

echo ""
echo "═══ 8. Verification event + DB message lưu đúng ═══"
EV=$(chat $JAR '{"content":"bầu trời hôm nay đẹp không","modelId":"khanhos-core"}')
VERIF=$(echo "$EV" | sse_events | python3 -c "
import sys, json
events = json.loads(sys.stdin.read())
v = [e for e in events if e.get('type') == 'verification']
print(v[0].get('severity') if v else 'none')
")
case "$VERIF" in ok|warn|fail) VOK=y ;; *) VOK=n ;; esac
check "có event verification (severity ok/warn/fail)" "y" "$VOK"

echo ""
echo "═══ 9. Abort — dừng giữa chừng không crash ═══"
CONV_AB=$(echo "$EV" | sse_field conversationId '' | head -1)
timeout 4 curl -s -N -X POST $BASE/api/chat -H "Content-Type: application/json" -b $JAR \
  -d '{"content":"viết bài luận dài về vũ trụ","modelId":"khanhos-core"}' > /dev/null 2>&1
check "abort giữa stream không làm sập server" "y" "$(curl -s -o /dev/null -w '%{http_code}' -b $JAR $BASE/api/models | grep -q 200 && echo y || echo n)"

echo ""
echo "═══ 10. Admin diagnostics — chỉ owner ═══"
code=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR $BASE/api/admin/ai)
check "user thường GET /api/admin/ai → 403" "403" "$code"

rm -f $JAR_OWNER
curl -s -o /dev/null -c $JAR_OWNER -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hoangbaokhanhhehe@gmail.com","password":"khanh0712014@#"}'
DIAG=$(curl -s -b $JAR_OWNER $BASE/api/admin/ai)
DIAG_OK=$(echo "$DIAG" | python3 -c "
import sys, json
d = json.load(sys.stdin)
rt = d.get('runtime') or {}
dg = d.get('diagnostics') or {}
tools = d.get('tools') or []
print('y' if rt.get('available') and dg.get('totals') and len(tools) >= 5 else 'n')
")
check "owner GET /api/admin/ai — runtime + diagnostics + tools" "y" "$DIAG_OK"
DIAG_NO_SECRET=$(echo "$DIAG" | grep -qi "sk-\|password\|DATABASE_URL=" && echo n || echo y)
check "diagnostics không lộ secret" "y" "$DIAG_NO_SECRET"

echo ""
echo "═══ 11. An toàn: secret trong input bị che trước khi tới model ═══"
EV=$(chat $JAR '{"content":"sk-abcdefghij1234567890 ghi lại giùm rồi dịch sang tiếng Anh câu: hello","modelId":"khanhos-core"}')
NO_LEAK=$(echo "$EV" | sse_field content '' | grep -q "sk-abcdefghij1234567890" && echo n || echo y)
check "output không nhả lại API key đầu vào" "y" "$NO_LEAK"

echo ""
echo "───────────────────────────"
echo "KẾT QUẢ: $PASS PASS / $FAIL FAIL"
[ $FAIL -eq 0 ] || exit 1
