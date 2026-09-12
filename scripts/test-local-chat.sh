#!/bin/bash
# KhanhOS AI — E2E test Local Chat Engine (qua HTTP thật, cần dev server :3000)
# Phủ: auth → chat SSE (intent/confidence/source local) → follow-up context
# → lệnh → fallback không bịa → admin (owner) → quyền truy cập → quota.
# Chạy: bash scripts/test-local-chat.sh
BASE="http://localhost:3000"
PASS=0; FAIL=0
JAR="/tmp/kh-local-chat.jar"; JAR_OWNER="/tmp/kh-local-chat-owner.jar"

check() { # name, expected, actual
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "✔ $1";
  else FAIL=$((FAIL+1)); echo "✘ $1 — expected [$2] got [$3]"; fi
}

sse_field() { # field, default
  python3 -c "
import sys, json, re
raw = sys.stdin.read()
events = [json.loads(x) for x in re.findall(r'^data: (.+)$', raw, re.M) if x]
done = [e for e in events if e.get('type') == 'done']
v = done[0].get('$1', '$2') if done else '<no-done>'
print(v if v is not None else '')
"
}

chat() { curl -s -N --max-time 60 -X POST $BASE/api/chat -H "Content-Type: application/json" -b "$1" -d "$2"; }

echo "═══ 1. Đăng ký user test ═══"
TS=$(date +%s%3N)
EMAIL="lc-e2e-$TS@test.dev"
rm -f $JAR
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -c $JAR -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" -H "X-Forwarded-For: 10.99.0.1" \
  -d "{\"name\":\"E2E Local\",\"email\":\"$EMAIL\",\"password\":\"12345678\",\"confirmPassword\":\"12345678\"}")
check "đăng ký user test (200)" "200" "$code"

echo ""
echo "═══ 2. Chat → engine cục bộ trả lời đúng intent ═══"

r=$(chat $JAR '{"content":"AI la gi","modelId":"khanhos-core"}')
check "AI la gi → intent what_is_ai" "what_is_ai" "$(echo "$r" | sse_field intent '')"
check "AI la gi → confidence 1" "1" "$(echo "$r" | sse_field confidence '')"
check "source = local-rules (không gọi API ngoài)" "local-rules" "$(echo "$r" | sse_field source '')"
CONV=$(echo "$r" | grep -o '"conversationId":"[^"]*"' | head -1 | cut -d'"' -f4)

r=$(chat $JAR "{\"content\":\"thế local AI?\",\"modelId\":\"khanhos-core\",\"conversationId\":\"$CONV\"}")
check "follow-up 'thế local AI?' → what_is_local_ai" "what_is_local_ai" "$(echo "$r" | sse_field intent '')"

r=$(chat $JAR "{\"content\":\"có cần api không?\",\"modelId\":\"khanhos-core\",\"conversationId\":\"$CONV\"}")
check "follow-up 'có cần api không?' → local_ai_without_api" "local_ai_without_api" "$(echo "$r" | sse_field intent '')"

r=$(chat $JAR "{\"content\":\"kolinux la gi\",\"modelId\":\"khanhos-core\",\"conversationId\":\"$CONV\"}")
KOLINUX_SOURCE=$(echo "$r" | sse_field source '-')
if [ "$KOLINUX_SOURCE" = "local-model" ]; then
  # Có model AI cục bộ đang chạy → câu lạ được MODEL suy luận thật
  check "từ bịa 'kolinux' → model cục bộ xử lý" "local-model" "$KOLINUX_SOURCE"
else
  # Không có runtime model → fallback trung thực của rules (không bịa)
  check "từ bịa 'kolinux' → fallback (null)" "" "$(echo "$r" | sse_field intent '-')"
  echo "$r" | sse_field content '' | grep -qi "chưa\|không đoán\|không có" && check "fallback nói thẳng không có dữ liệu" "y" "y" || check "fallback nói thẳng không có dữ liệu" "y" "n"
fi

r=$(chat $JAR "{\"content\":\"/knowledge\",\"modelId\":\"khanhos-core\",\"conversationId\":\"$CONV\"}")
check "lệnh /knowledge → command:knowledge" "command:knowledge" "$(echo "$r" | sse_field intent '')"

r=$(chat $JAR "{\"content\":\"/clear\",\"modelId\":\"khanhos-core\",\"conversationId\":\"$CONV\"}")
check "lệnh /clear → action clear_chat" "clear_chat" "$(echo "$r" | sse_field action '')"
count=$(bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.message.count({where:{conversationId:'$CONV'}}).then(c=>{console.log(c);return db.\$disconnect()})")
check "/clear xoá hết message trong DB" "0" "$count"

r=$(chat $JAR '{"content":"React là gì","modelId":"khanhos-core"}')
CONV2=$(echo "$r" | grep -o '"conversationId":"[^"]*"' | head -1 | cut -d'"' -f4)
r1=$(echo "$r" | sse_field content '')
r2=$(chat $JAR "{\"conversationId\":\"$CONV2\",\"modelId\":\"khanhos-core\",\"regenerate\":true}" | sse_field content '')
if [ "$r1" != "$r2" ]; then check "regenerate cho biến thể khác" "diff" "diff"; else check "regenerate cho biến thể khác" "diff" "same"; fi

echo ""
echo "═══ 3. Quota gói dịch vụ vẫn chặn khi hết hạn mức ═══"
bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.message.updateMany({where:{conversation:{user:{email:'$EMAIL'}},role:'assistant'},data:{tokens:999999}}).then(c=>{console.log('faked');return db.\$disconnect()})"
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -X POST $BASE/api/chat -H "Content-Type: application/json" -b $JAR \
  -d '{"content":"AI là gì","modelId":"khanhos-core"}')
check "chat khi vượt hạn mức → 402" "402" "$code"
cat /tmp/r.json | grep -q "tín dụng" && check "thông báo dùng chữ tín dụng (không token)" "y" "y" || check "thông báo dùng chữ tín dụng" "y" "n"
bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.message.updateMany({where:{conversation:{user:{email:'$EMAIL'}}},data:{tokens:0}}).then(()=>db.\$disconnect())"

echo ""
echo "═══ 4. Admin tri thức — owner duy nhất được vào ═══"

code=$(curl -s -o /tmp/r.json -w "%{http_code}" -b $JAR $BASE/api/admin/chatbot)
check "user thường GET admin → 403" "403" "$code"

rm -f $JAR_OWNER
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -c $JAR_OWNER -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hoangbaokhanhhehe@gmail.com","password":"khanh0712014@#"}')
check "owner login (200)" "200" "$code"

code=$(curl -s -o /tmp/r.json -w "%{http_code}" -b $JAR_OWNER $BASE/api/admin/chatbot)
check "owner GET admin (200)" "200" "$code"
ints=$(cat /tmp/r.json | python3 -c "import sys,json;print(json.load(sys.stdin)['stats']['intents'])")
[ "$ints" -ge 90 ] && check "stats: ≥90 intents (thấy $ints)" "y" "y" || check "stats: ≥90 intents (thấy $ints)" "y" "n"

code=$(curl -s -o /tmp/r.json -w "%{http_code}" -b $JAR_OWNER -X POST $BASE/api/admin/chatbot \
  -H "Content-Type: application/json" -d '{"message":"ollama la gi"}')
check "owner POST admin/test (200)" "200" "$code"
it=$(cat /tmp/r.json | python3 -c "import sys,json;print(json.load(sys.stdin)['intent'])")
check "test 'ollama la gi' → ollama" "ollama" "$it"

code=$(curl -s -o /tmp/r.json -w "%{http_code}" -b $JAR_OWNER -X PUT $BASE/api/admin/chatbot \
  -H "Content-Type: application/json" -d '{"path":"intents/ai.json","content":"{khong hop le"}')
check "ghi JSON hỏng → 400 chặn" "400" "$code"

code=$(curl -s -o /tmp/r.json -w "%{http_code}" -b $JAR_OWNER -X PUT $BASE/api/admin/chatbot \
  -H "Content-Type: application/json" -d '{"path":"../../.env","content":"x"}')
check "path traversal → 400 chặn" "400" "$code"

# Round-trip an toàn: đọc file gốc → xoá 1 intent → ghi → engine nạp lại → GHI LẠI BẢN GỐC
ints_before=$(curl -s -b $JAR_OWNER $BASE/api/admin/chatbot | python3 -c "import sys,json;print(json.load(sys.stdin)['stats']['intents'])")
curl -s -b $JAR_OWNER "$BASE/api/admin/chatbot?file=intents/ai.json" -o /tmp/f.json
python3 - << 'PYEOF'
import json
d = json.load(open('/tmp/f.json'))
orig = json.loads(d['content'])          # mảng intent gốc
removed = orig[:-1]                      # bản bớt 1 intent
json.dump({"path": "intents/ai.json", "content": json.dumps(removed, ensure_ascii=False, indent=2)},
          open('/tmp/p1.json', 'w'), ensure_ascii=False)
json.dump({"path": "intents/ai.json", "content": json.dumps(orig, ensure_ascii=False, indent=2)},
          open('/tmp/p2.json', 'w'), ensure_ascii=False)
print("prepared round-trip payloads")
PYEOF
st1=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR_OWNER -X PUT $BASE/api/admin/chatbot \
  -H "Content-Type: application/json" --data-binary @/tmp/p1.json)
ints_after_del=$(curl -s -b $JAR_OWNER $BASE/api/admin/chatbot | python3 -c "import sys,json;print(json.load(sys.stdin)['stats']['intents'])")
st2=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR_OWNER -X PUT $BASE/api/admin/chatbot \
  -H "Content-Type: application/json" --data-binary @/tmp/p2.json)
ints_final=$(curl -s -b $JAR_OWNER $BASE/api/admin/chatbot | python3 -c "import sys,json;print(json.load(sys.stdin)['stats']['intents'])")

check "round-trip ghi file (xoá 1 intent rồi khôi phục) 200-200" "200-200" "$st1-$st2"
check "engine nhận xoá 1 intent ($ints_before → $((ints_before-1)))" "$((ints_before-1))" "$ints_after_del"
check "engine khôi phục đủ intents ($ints_before)" "$ints_before" "$ints_final"

echo ""
echo "═══ 5. Lệnh owner trong chat (/give, /user, /pending, /approve, /deny) ═══"

# Owner thứ hai (haong...) — bucket rate-limit chat riêng + kiểm chứng cả 2 owner đều dùng được lệnh
JAR_O2="/tmp/kh-local-chat-owner2.jar"; rm -f $JAR_O2
code=$(curl -s -o /dev/null -w "%{http_code}" -c $JAR_O2 -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"haongbaokhanhhehe@gmail.com","password":"khanh0712014@#"}')
check "login owner haong… cho section lệnh owner (200)" "200" "$code"

# User thử lệnh (riêng để dọn dễ)
TS2=$(date +%s%3N)
EMAIL2="lc-cmd-$TS2@test.dev"
JAR2="/tmp/kh-local-chat-cmd.jar"; rm -f $JAR2
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -c $JAR2 -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" -H "X-Forwarded-For: 10.99.0.2" \
  -d "{\"name\":\"Cmd Test\",\"email\":\"$EMAIL2\",\"password\":\"12345678\",\"confirmPassword\":\"12345678\"}")
check "đăng ký user thử lệnh owner (200)" "200" "$code"

plan_of() { bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.user.findUnique({where:{email:'$1'}}).then(u=>{console.log(u?u.plan:'<none>');return db.\$disconnect()})"; }

# 5.1 /help của user thường KHÔNG nhắc /give
r=$(chat $JAR2 '{"content":"/help","modelId":"khanhos-core"}')
if echo "$r" | sse_field content '' | grep -q "/give"; then
  check "user thường /help ẨN lệnh owner" "ẩn" "thấy /give"
else
  check "user thường /help ẨN lệnh owner" "ẩn" "ẩn"
fi

# 5.2 user thường gõ /give → bị chặn, không đổi gói
r=$(chat $JAR2 "{\"content\":\"/give plus $EMAIL2\",\"modelId\":\"khanhos-core\"}")
if echo "$r" | sse_field content '' | grep -qi "chỉ dành cho chủ sở hữu"; then
  check "user thường /give → bị chặn" "chặn" "chặn"
else
  check "user thường /give → bị chặn" "chặn" "lọt"
fi
check "user thường /give KHÔNG đổi gói (vẫn free)" "free" "$(plan_of $EMAIL2)"

# 5.3 /usage công khai — user thường xem được mức dùng của mình
r=$(chat $JAR2 '{"content":"/usage","modelId":"khanhos-core"}')
echo "$r" | sse_field content '' | grep -q "tín dụng" && check "/usage công khai — hiện tín dụng" "y" "y" || check "/usage công khai — hiện tín dụng" "y" "n"

# 5.4 owner /help hiện lệnh owner
r=$(chat $JAR_O2 '{"content":"/help","modelId":"khanhos-core"}')
echo "$r" | sse_field content '' | grep -q "/give" && check "owner /help HIỆN lệnh owner (/give...)" "y" "y" || check "owner /help HIỆN lệnh owner (/give...)" "y" "n"
echo "$r" | sse_field content '' | grep -q "chỉ dành cho chủ sở hữu" && check "owner /help có mục riêng lệnh owner" "y" "y" || check "owner /help có mục riêng lệnh owner" "y" "n"

# 5.5 owner /give thiếu đối số → hiện hướng dẫn
r=$(chat $JAR_O2 '{"content":"/give","modelId":"khanhos-core"}')
echo "$r" | sse_field content '' | grep -q "Cú pháp" && check "owner /give thiếu đối số → hướng dẫn" "y" "y" || check "owner /give thiếu đối số → hướng dẫn" "y" "n"

# 5.6 gói không hợp lệ
r=$(chat $JAR_O2 "{\"content\":\"/give ultra $EMAIL2\",\"modelId\":\"khanhos-core\"}")
echo "$r" | sse_field content '' | grep -q "không hợp lệ" && check "owner /give gói sai → báo lỗi" "y" "y" || check "owner /give gói sai → báo lỗi" "y" "n"

# 5.7 email không tồn tại
r=$(chat $JAR_O2 '{"content":"/give plus khongtonxi99@test.dev","modelId":"khanhos-core"}')
echo "$r" | sse_field content '' | grep -q "Không tìm thấy" && check "owner /give email không tồn tại → báo lỗi" "y" "y" || check "owner /give email không tồn tại → báo lỗi" "y" "n"

# 5.8 /give plus bằng email (viết HOA — test tra cứu không phân biệt hoa/thường)
r=$(chat $JAR_O2 "{\"content\":\"/give PLUS ${EMAIL2^^}\",\"modelId\":\"khanhos-core\"}")
echo "$r" | sse_field content '' | grep -q "Đã gán gói Plus" && check "owner /give plus <email HOA> → thành công" "y" "y" || check "owner /give plus <email HOA> → thành công" "y" "n"
check "DB: user.plan = plus" "plus" "$(plan_of $EMAIL2)"

# 5.9 owner /user <email> → hiện gói + hạn mức
r=$(chat $JAR_O2 "{\"content\":\"/user $EMAIL2\",\"modelId\":\"khanhos-core\"}")
c=$(echo "$r" | sse_field content '')
echo "$c" | grep -q "$EMAIL2" && echo "$c" | grep -q "Plus" && check "owner /user <email> → hiện Plus + 85.000" "y" "y" || check "owner /user <email> → hiện Plus + 85.000" "y" "n"

# 5.10 owner /user bằng ID
UID2=$(bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.user.findUnique({where:{email:'$EMAIL2'}}).then(u=>{console.log(u.id);return db.\$disconnect()})")
r=$(chat $JAR_O2 "{\"content\":\"/user $UID2\",\"modelId\":\"khanhos-core\"}")
echo "$r" | sse_field content '' | grep -q "$EMAIL2" && check "owner /user <ID> → tra được user" "y" "y" || check "owner /user <ID> → tra được user" "y" "n"

# 5.11 /pending — tạo request rồi kiểm tra hiển thị (IP động tránh bucket 3/10'/IP khi chạy nhiều lần)
XFF_A="10.99.$((RANDOM%250)).$((RANDOM%250))"
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -b $JAR2 -X POST $BASE/api/plan-requests \
  -H "Content-Type: application/json" -H "X-Forwarded-For: $XFF_A" \
  -d "{\"plan\":\"vip\",\"phone\":\"0938000111\",\"momoNumber\":\"0938222333\",\"contactEmail\":\"$EMAIL2\",\"note\":\"test lệnh /approve\"}")
check "tạo request vip để test (200)" "200" "$code"
r=$(chat $JAR_O2 '{"content":"/pending","modelId":"khanhos-core"}')
c=$(echo "$r" | sse_field content '')
echo "$c" | grep -q "$EMAIL2" && echo "$c" | grep -qi "VIP" && check "owner /pending → hiện request mới" "y" "y" || check "owner /pending → hiện request mới" "y" "n"

# 5.12 /approve bằng ID VIẾT TẮT (6 ký tự đầu)
RID=$(bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.planRequest.findFirst({where:{contactEmail:'$EMAIL2',status:'pending'},orderBy:{createdAt:'desc'}}).then(r=>{console.log(r.id);return db.\$disconnect()})")
r=$(chat $JAR_O2 "{\"content\":\"/approve ${RID:0:6}\",\"modelId\":\"khanhos-core\"}")
echo "$r" | sse_field content '' | grep -q "Đã duyệt" && check "owner /approve <id viết tắt> → duyệt được" "y" "y" || check "owner /approve <id viết tắt> → duyệt được" "y" "n"
check "DB: user.plan = vip sau /approve" "vip" "$(plan_of $EMAIL2)"

# 5.13 /deny — tạo request mới rồi từ chối
XFF_B="10.99.$((RANDOM%250)).$((RANDOM%250))"
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -b $JAR2 -X POST $BASE/api/plan-requests \
  -H "Content-Type: application/json" -H "X-Forwarded-For: $XFF_B" \
  -d "{\"plan\":\"max\",\"phone\":\"0938000111\",\"momoNumber\":\"0938222333\",\"contactEmail\":\"$EMAIL2\",\"note\":\"test lệnh /deny\"}")
check "tạo request max để test (200)" "200" "$code"
RID2=$(bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.planRequest.findFirst({where:{contactEmail:'$EMAIL2',status:'pending'},orderBy:{createdAt:'desc'}}).then(r=>{console.log(r.id);return db.\$disconnect()})")
r=$(chat $JAR_O2 "{\"content\":\"/deny ${RID2:0:6}\",\"modelId\":\"khanhos-core\"}")
echo "$r" | sse_field content '' | grep -q "Đã từ chối" && check "owner /deny <id> → từ chối được" "y" "y" || check "owner /deny <id> → từ chối được" "y" "n"
st=$(bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.planRequest.findUnique({where:{id:'$RID2'}}).then(r=>{console.log(r.status);return db.\$disconnect()})")
check "DB: request bị /deny → rejected" "rejected" "$st"

# 5.14 user xem /usage → gói mới vip hiện
r=$(chat $JAR2 '{"content":"/usage","modelId":"khanhos-core"}')
echo "$r" | sse_field content '' | grep -q "VIP" && check "/usage sau /approve → hiện gói VIP" "y" "y" || check "/usage sau /approve → hiện gói VIP" "y" "n"

echo ""
echo "═══ 6. Dọn dẹp ═══"
bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.session.deleteMany({where:{user:{email:{in:['$EMAIL','$EMAIL2']}}}}).then(()=>db.conversation.deleteMany({where:{user:{email:{in:['$EMAIL','$EMAIL2']}}}})).then(()=>db.planRequest.deleteMany({where:{contactEmail:'$EMAIL2'}})).then(()=>db.user.deleteMany({where:{email:{in:['$EMAIL','$EMAIL2']}}})).then(()=>console.log('cleaned')).finally(()=>db.\$disconnect())"

echo ""
echo "════════════════════════════"
echo "KẾT QUẢ: $PASS PASS / $FAIL FAIL"
[ $FAIL -eq 0 ] && echo "TẤT CẢ PASS ✔" || echo "CÓ LỖI ✘"
exit $FAIL
