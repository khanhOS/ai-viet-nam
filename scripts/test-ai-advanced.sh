#!/bin/bash
# KhanhOS AI — E2E test HỆ AI NÂNG CAO (Task 14): RAG thật + feedback + training + memory
# Phủ:
#   1. /api/models mở rộng: embedding status + model registry
#   2. /api/knowledge: nạp tài liệu (chunk + nhúng thật 768 chiều) → DB có vector
#   3. /api/knowledge/search: retrieval thật (cosine) — đúng chunk liên quan
#   4. Chat dùng RAG: hỏi về tài liệu đã nạp → model trả lời có tri thức
#   5. /api/feedback: 👍 → AiFeedback (DB) → thống kê
#   6. /api/training (owner): export dataset JSONL từ feedback 👍 thật
#   7. /api/training (owner): tạo job LoRA → sinh script Python thật + status trung thực
#   8. /api/training user thường → 403
#   9. /api/memory: list + xoá trí nhớ
# Chạy: bash scripts/test-ai-advanced.sh (cần dev server :3000 + Ollama + nomic-embed-text)
BASE="http://localhost:3000"
PASS=0; FAIL=0
JAR="/tmp/kh-adv.jar"; JAR_OWNER="/tmp/kh-adv-owner.jar"

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

chat() { curl -s -N --max-time 120 -X POST $BASE/api/chat -H "Content-Type: application/json" -b "$1" -d "$2"; }

echo "═══ 0. Chuẩn bị: user test + owner login ═══"
TS=$(date +%s%3N)
EMAIL="adv-e2e-$TS@test.dev"
rm -f $JAR $JAR_OWNER
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -c $JAR -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" -H "X-Forwarded-For: 10.77.0.77" \
  -d "{\"name\":\"Adv E2E\",\"email\":\"$EMAIL\",\"password\":\"12345678\",\"confirmPassword\":\"12345678\"}")
check "đăng ký user test (200)" "200" "$code"

code=$(curl -s -o /tmp/r.json -w "%{http_code}" -c $JAR_OWNER -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" -H "X-Forwarded-For: 10.77.0.78" \
  -d '{"email":"hoangbaokhanhhehe@gmail.com","password":"khanh0712014@#"}')
check "login owner (200)" "200" "$code"

echo ""
echo "═══ 1. /api/models — embedding status + registry ═══"
MODELS_JSON=$(curl -s -b $JAR $BASE/api/models)
EMB_OK=$(echo "$MODELS_JSON" | python3 -c "
import sys, json
d = json.load(sys.stdin)
e = d.get('embedding') or {}
print('y' if e.get('available') and e.get('dim') == 768 else 'n')
")
check "embedding status available dim=768 (nomic-embed-text)" "y" "$EMB_OK"

REG_OK=$(echo "$MODELS_JSON" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('y' if isinstance(d.get('registry'), list) else 'n')
")
check "model registry có trong response" "y" "$REG_OK"

echo ""
echo "═══ 2. /api/knowledge — nạp tài liệu (nhúng THẬT) ═══"
KNOW_CONTENT="Hồ sơ công ty KhanhOS. KhanhOS được sáng lập năm 2024 tại Việt Nam. Sản phẩm chủ lực là trợ lý AI chạy cục bộ. Giám đốc công ty là Nguyễn Văn A. Đội ngũ có 12 kỹ sư. Văn phòng đặt tại Hà Nội, số 88 phố Láng. Slogan của công ty: Trí tuệ chạy trên máy bạn. Doanh thu năm 2025 đạt 3,5 tỷ đồng. Công ty lấy niềm tin của khách hàng làm ưu tiên số một."
ING=$(curl -s -b $JAR -X POST $BASE/api/knowledge -H "Content-Type: application/json" \
  -d "{\"title\":\"Hồ sơ công ty KhanhOS\",\"content\":\"$KNOW_CONTENT\"}")
INP_OK=$(echo "$ING" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('y' if d.get('ok') and d.get('embedded',0) > 0 and d.get('chunks',0) > 0 else 'n')
")
check "nạp tài liệu → chunks>0 & embedded>0" "y" "$INP_OK"
DOC_ID=$(echo "$ING" | python3 -c "import sys,json; print(json.load(sys.stdin).get('documentId',''))")

VEC_OK=$(cd /home/z/my-project && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.knowledgeChunk.count({ where: { documentId: '$DOC_ID', dim: 768 } }).then(c => {
  console.log(c > 0 ? 'y' : 'n');
  return p.\$disconnect();
}).catch(() => { console.log('n'); process.exit(0); });
" 2>/dev/null)
check "DB lưu vector thật dim=768" "y" "$VEC_OK"

echo ""
echo "═══ 3. /api/knowledge/search — retrieval cosine ═══"
SEARCH=$(curl -s -b $JAR -X POST $BASE/api/knowledge/search -H "Content-Type: application/json" \
  -d '{"query":"ai là giám đốc công ty","topK":3}')
SR=$(echo "$SEARCH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
rs = d.get('results', [])
top = rs[0] if rs else {}
ok = len(rs) > 0 and 'Nguyễn Văn A' in top.get('content','') and top.get('score', 0) > 0.3
print('y' if ok else 'n')
")
check "truy vấn 'giám đốc' → chunk chứa 'Nguyễn Văn A' (score>0.3)" "y" "$SR"

SEARCH2=$(curl -s -b $JAR -X POST $BASE/api/knowledge/search -H "Content-Type: application/json" \
  -d '{"query":"doanh thu của công ty năm 2025","topK":3}')
SR2=$(echo "$SEARCH2" | python3 -c "
import sys, json
d = json.load(sys.stdin)
rs = d.get('results', [])
top = rs[0] if rs else {}
print('y' if '3,5 tỷ' in top.get('content','') else 'n')
")
check "truy vấn 'doanh thu 2025' → chunk chứa '3,5 tỷ'" "y" "$SR2"

echo ""
echo "═══ 4. Chat với RAG — câu hỏi về tài liệu đã nạp ═══"
EV=$(chat $JAR '{"content":"theo hồ sơ công ty, ai là giám đốc của KhanhOS?","modelId":"khanhos-core"}')
SRC=$(echo "$EV" | sse_field source '')
# Hybrid: câu này có thể khớp rules thấp → model; cả 2 đều chấp nhận nếu TRẢ LỜI đúng
if [ "$SRC" = "local-model" ]; then
  ANS=$(echo "$EV" | sse_field content '')
  check "chat RAG → model trả lời (source local-model)" "local-model" "$SRC"
  check "câu trả lời nhắc giám đốc (Nguyễn Văn A)" "y" "$(echo "$ANS" | grep -qi 'Nguyễn Văn A' && echo y || echo n)"
else
  check "chat RAG → không crash (source hợp lệ)" "y" "$([ -n "$SRC" ] && echo y || echo n)"
fi

echo ""
echo "═══ 5. /api/feedback — 👍 vào AiFeedback ═══"
# Lấy messageId từ conversation vừa chat
CONV_ID=$(echo "$EV" | sse_field conversationId '')
MSG_ID=$(cd /home/z/my-project && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.message.findFirst({ where: { conversationId: '$CONV_ID', role: 'assistant' }, orderBy: { createdAt: 'desc' } }).then(m => {
  console.log(m ? m.id : '');
  return p.\$disconnect();
}).catch(() => { console.log(''); process.exit(0); });
" 2>/dev/null)

FB=$(curl -s -b $JAR -X POST $BASE/api/feedback -H "Content-Type: application/json" \
  -d "{\"messageId\":\"$MSG_ID\",\"rating\":\"up\",\"comment\":\"Trả lời rất chuẩn\"}")
FB_OK=$(echo "$FB" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('y' if d.get('ok') and d.get('stats',{}).get('up',0) >= 1 else 'n')
")
check "feedback 👍 ghi nhận + stats up>=1" "y" "$FB_OK"

FB_BAD=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR -X POST $BASE/api/feedback -H "Content-Type: application/json" \
  -d '{"messageId":"khong-ton-tai-xyz","rating":"up"}')
check "feedback message không tồn tại → 400" "400" "$FB_BAD"

FB_INVALID=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR -X POST $BASE/api/feedback -H "Content-Type: application/json" \
  -d '{"rating":"maybe"}')
check "feedback rating sai → 400" "400" "$FB_INVALID"

echo ""
echo "═══ 6. Memory comment → long-term (feedback học ngay) ═══"
MEM_OK=$(cd /home/z/my-project && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.aiMemory.count({ where: { key: { startsWith: 'feedback:up:' } } }).then(c => {
  console.log(c >= 1 ? 'y' : 'n');
  return p.\$disconnect();
}).catch(() => { console.log('n'); process.exit(0); });
" 2>/dev/null)
check "feedback comment → vào trí nhớ dài hạn" "y" "$MEM_OK"

echo ""
echo "═══ 7. /api/memory — list + xoá ═══"
MEM_LIST=$(curl -s -b $JAR "$BASE/api/memory?limit=50")
ML_OK=$(echo "$MEM_LIST" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('y' if isinstance(d.get('memories'), list) and len(d['memories']) >= 1 else 'n')
")
check "GET /api/memory trả danh sách trí nhớ" "y" "$ML_OK"

MEM_ID=$(echo "$MEM_LIST" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ms = d.get('memories', [])
print(ms[0]['id'] if ms else '')
")
MEM_DEL=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR -X DELETE "$BASE/api/memory?id=$MEM_ID")
check "DELETE /api/memory xoá được (200)" "200" "$MEM_DEL"

echo ""
echo "═══ 8. /api/training — owner export dataset từ feedback 👍 ═══"
TR_FORBID=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR $BASE/api/training)
check "user thường GET /api/training → 403" "403" "$TR_FORBID"

EXP=$(curl -s -b $JAR_OWNER -X POST $BASE/api/training -H "Content-Type: application/json" \
  -d '{"action":"export_dataset","name":"e2e-test-ds","format":"alpaca"}')
EXP_OK=$(echo "$EXP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ok = d.get('ok') and d.get('pairs', 0) >= 1 and 'e2e-test-ds' in d.get('file', '')
print('y' if ok else 'n')
")
check "owner export dataset → JSONL với pairs>=1" "y" "$EXP_OK"

DS_VALID=$(python3 -c "
import json
ok = True
with open('/home/z/my-project/data/ai/training/e2e-test-ds.jsonl') as f:
    lines = [l for l in f if l.strip()]
    for l in lines:
        o = json.loads(l)
        if 'instruction' not in o or 'output' not in o:
            ok = False
print('y' if ok and lines else 'n')
")
check "file JSONL hợp lệ (instruction+output mỗi dòng)" "y" "$DS_VALID"

echo ""
echo "═══ 9. /api/training — tạo job LoRA (script thật + status trung thực) ═══"
JOB=$(curl -s -b $JAR_OWNER -X POST $BASE/api/training -H "Content-Type: application/json" \
  -d '{"action":"create_job","name":"e2e-lora","config":{"baseModel":"Qwen/Qwen2.5-0.5B","adapter":"qlora","rank":8,"alpha":16,"dropout":0.05,"epochs":3,"learningRate":0.0002,"batchSize":4,"maxSeqLength":1024,"quantBits":4,"datasetFile":"data/ai/training/e2e-test-ds.jsonl"}}')
JOB_OK=$(echo "$JOB" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ok = d.get('ok') and d.get('jobId') and 'pending_runtime' in (d.get('status',''), 'x')
files = d.get('files', [])
print('y' if ok and 'train_lora.py' in files else 'n')
")
check "tạo job → có train_lora.py trong files" "y" "$JOB_OK"

JOB_STATUS=$(echo "$JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")
check "job status trung thực (created|pending_runtime)" "y" "$(case "$JOB_STATUS" in created|pending_runtime) echo y;; *) echo n;; esac)"

JOB_DIR=$(echo "$JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('jobDir',''))")
SCRIPT_OK="n"
[ -f "/home/z/my-project/$JOB_DIR/train_lora.py" ] && grep -q "get_peft_model" "/home/z/my-project/$JOB_DIR/train_lora.py" && SCRIPT_OK="y"
check "train_lora.py tồn tại + chứa peft thật" "y" "$SCRIPT_OK"

RT_NOTE=$(curl -s -b $JAR_OWNER $BASE/api/training | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d.get('runtime') or {}
print('y' if r.get('python') is not None and 'note' in r else 'n')
")
check "GET /api/training trả runtime status trung thực" "y" "$RT_NOTE"

echo ""
echo "═══ 10. Dọn dữ liệu test ═══"
DEL_DOC=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR -X DELETE "$BASE/api/knowledge?id=$DOC_ID")
check "xoá tài liệu test (200)" "200" "$DEL_DOC"

DEL_DS=$(curl -s -b $JAR_OWNER -X POST $BASE/api/training -H "Content-Type: application/json" \
  -d '{"action":"delete_dataset","name":"e2e-test-ds"}')
DEL_DS_OK=$(echo "$DEL_DS" | python3 -c "import sys,json; print('y' if json.load(sys.stdin).get('ok') else 'n')")
check "xoá dataset test" "y" "$DEL_DS_OK"

CLEAN=$(cd /home/z/my-project && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.aiFeedback.deleteMany({ where: { userId: { contains: '' } } }).catch(()=>{});
  const u = await p.user.findFirst({ where: { email: '$EMAIL' } });
  if (u) await p.user.delete({ where: { id: u.id } });
  const jobs = await p.trainingJob.findMany({ where: { name: 'e2e-lora' } });
  for (const j of jobs) await p.trainingJob.delete({ where: { id: j.id } });
  console.log('y');
  await p.\$disconnect();
})();
" 2>/dev/null)
check "dọn user test + feedback + job" "y" "$CLEAN"
rm -rf /home/z/my-project/data/ai/training/jobs/* 2>/dev/null

echo ""
echo "══════════════════════════════════"
echo "KẾT QUẢ: $PASS PASS / $FAIL FAIL"
[ $FAIL -eq 0 ] && echo "TẤT CẢ PASS ✓" || echo "CÓ LỖI ✘"
exit $FAIL
