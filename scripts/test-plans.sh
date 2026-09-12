#!/bin/bash
# KhanhOS AI — Test hệ thống gói dịch vụ Free/Plus/VIP/Max (Task 9):
#   (1) /api/plans công khai: 4 gói đúng giá + hạn mức, KHÔNG còn chữ "token"
#   (2) Đăng ký ⇒ plan=free, usage limit 25.000
#   (3) POST /api/plan-requests: SĐT + MoMo + Gmail bắt buộc, validate VN
#   (4) Owner duyệt ⇒ user.plan đổi, limit 85.000
#   (5) Chat bị chặn 402 khi vượt hạn mức — thông báo dùng chữ "tín dụng"
#   (6) Chat thật ghi nhận mức dùng; owner KHÔNG bị giới hạn
# Chạy: bash scripts/test-plans.sh   (cần dev server ở :3000)
BASE="http://localhost:3000"
JAR="/tmp/kh-plans.jar"
OJAR="/tmp/kh-plans-owner.jar"
PASS=0; FAIL=0

check() { # name, expected, actual
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "✔ $1";
  else FAIL=$((FAIL+1)); echo "✘ $1 — expected [$2] got [$3]"; fi
}
check_contains() { # name, haystack, needle
  if echo "$2" | grep -qF "$3"; then PASS=$((PASS+1)); echo "✔ $1";
  else FAIL=$((FAIL+1)); echo "✘ $1 — không thấy [$3]"; fi
}
check_not_contains() { # name, haystack, needle
  if echo "$2" | grep -qiF "$3"; then FAIL=$((FAIL+1)); echo "✘ $1 — VẪN còn [$3]";
  else PASS=$((PASS+1)); echo "✔ $1"; fi
}

TS=$(date +%s%3N)
# IP ảo ĐỘNG mỗi lần chạy — tránh dính rate-limit bucket khi chạy test lặp lại
XFF_REG="10.77.$((RANDOM%250)).$((RANDOM%250))"
XFF_A="10.78.$((RANDOM%250)).$((RANDOM%250))"
XFF_B="10.78.$((RANDOM%250)).$((RANDOM%250))"
XFF_C="10.78.$((RANDOM%250)).$((RANDOM%250))"
XFF_D="10.78.$((RANDOM%250)).$((RANDOM%250))"
XFF_E="10.78.$((RANDOM%250)).$((RANDOM%250))"
TEST_EMAIL="planuser$TS@test.dev"
TEST_PASS="12345678"
OWNER_EMAIL="hoangbaokhanhhehe@gmail.com"
OWNER_PASS='khanh0712014@#'
PHONE="0901234567"
MOMO="0987654321"

echo "═══ GIAI ĐOẠN 1: /api/plans công khai ═══"
code=$(curl -s -o /tmp/plan1.json -w "%{http_code}" $BASE/api/plans)
check "GET /api/plans (khách) 200" "200" "$code"
body=$(cat /tmp/plan1.json)
nplans=$(echo "$body" | python3 -c "import sys,json;print(len(json.load(sys.stdin)['plans']))")
check "4 gói (free/plus/vip/max)" "4" "$nplans"
prices=$(echo "$body" | python3 -c "import sys,json;p=json.load(sys.stdin)['plans'];print(','.join(str(x['priceVND']) for x in p))")
check "giá 0/55000/99000/159000" "0,55000,99000,159000" "$prices"
credits=$(echo "$body" | python3 -c "import sys,json;p=json.load(sys.stdin)['plans'];print(','.join(str(x['monthlyCredits']) for x in p))")
check "hạn mức 25000/85000/256000/500000" "25000,85000,256000,500000" "$credits"
acct=$(echo "$body" | python3 -c "import sys,json;print(json.load(sys.stdin)['payment']['accountNumber'])")
check "thông tin thanh toán STK 000000" "000000" "$acct"
name=$(echo "$body" | python3 -c "import sys,json;print(json.load(sys.stdin)['payment']['accountName'])")
check_contains "chủ TK Hoang Bao Khanh" "$name" "HOANG BAO KHANH"
check_not_contains "phản hồi KHÔNG chứa chữ token" "$body" "token"

echo ""
echo "═══ GIAI ĐOẠN 2: đăng ký ⇒ gói Free ═══"
rm -f $JAR
code=$(curl -s -o /tmp/plan2.json -w "%{http_code}" -c $JAR -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" -H "X-Forwarded-For: $XFF_REG" \
  -d "{\"name\":\"Plan Tester\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\",\"confirmPassword\":\"$TEST_PASS\"}")
check "đăng ký user test (200)" "200" "$code"
plan=$(cat /tmp/plan2.json | python3 -c "import sys,json;print(json.load(sys.stdin)['user'].get('plan'))")
check "user mới ⇒ plan = free" "free" "$plan"
curl -s -b $JAR $BASE/api/plans > /tmp/plan3.json
ulimit=$(cat /tmp/plan3.json | python3 -c "import sys,json;print(json.load(sys.stdin)['usage']['limit'])")
check "usage limit gói Free = 25000" "25000" "$ulimit"

echo ""
echo "═══ GIAI ĐOẠN 3: form nâng cấp cần SĐT + MoMo + Gmail ═══"
# 3.1 Thiếu momoNumber → 400 (IP ảo riêng tránh dính bucket rate limit chung)
code=$(curl -s -o /tmp/plan4.json -w "%{http_code}" -b $JAR -X POST $BASE/api/plan-requests \
  -H "Content-Type: application/json" -H "X-Forwarded-For: $XFF_A" \
  -d "{\"plan\":\"plus\",\"phone\":\"$PHONE\",\"contactEmail\":\"$TEST_EMAIL\"}")
check "thiếu số MoMo → 400" "400" "$code"
# 3.2 MoMo sai định dạng → 400
code=$(curl -s -o /tmp/plan5.json -w "%{http_code}" -b $JAR -X POST $BASE/api/plan-requests \
  -H "Content-Type: application/json" -H "X-Forwarded-For: $XFF_B" \
  -d "{\"plan\":\"plus\",\"phone\":\"$PHONE\",\"momoNumber\":\"12345\",\"contactEmail\":\"$TEST_EMAIL\"}")
check "số MoMo sai định dạng → 400" "400" "$code"
# 3.3 Gửi hợp lệ → 200 pending
code=$(curl -s -o /tmp/plan6.json -w "%{http_code}" -b $JAR -X POST $BASE/api/plan-requests \
  -H "Content-Type: application/json" -H "X-Forwarded-For: $XFF_C" \
  -d "{\"plan\":\"plus\",\"phone\":\"$PHONE\",\"momoNumber\":\"$MOMO\",\"contactEmail\":\"$TEST_EMAIL\",\"note\":\"đã chuyển lúc 14h30\"}")
check "gửi yêu cầu hợp lệ (200)" "200" "$code"
status=$(cat /tmp/plan6.json | python3 -c "import sys,json;print(json.load(sys.stdin)['request']['status'])")
check "trạng thái = pending" "pending" "$status"
# 3.4 DB lưu đúng momoNumber
dbmomo=$(bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.planRequest.findFirst({where:{user:{email:'$TEST_EMAIL'}},orderBy:{createdAt:'desc'}}).then(r=>console.log(r?r.momoNumber:'null')).finally(()=>db.\$disconnect())")
check "DB lưu số MoMo" "$MOMO" "$dbmomo"
# 3.5 Trùng pending → 409
code=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR -X POST $BASE/api/plan-requests \
  -H "Content-Type: application/json" -H "X-Forwarded-For: $XFF_D" \
  -d "{\"plan\":\"vip\",\"phone\":\"$PHONE\",\"momoNumber\":\"$MOMO\",\"contactEmail\":\"$TEST_EMAIL\"}")
check "chỉ 1 yêu cầu chờ duyệt → 409" "409" "$code"

echo ""
echo "═══ GIAI ĐOẠN 4: owner duyệt yêu cầu ═══"
# 4.1 User thường GET danh sách → 403
code=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR $BASE/api/plan-requests)
check "user thường xem danh sách → 403" "403" "$code"
# 4.2 Owner login → GET 200 thấy MoMo
rm -f $OJAR
code=$(curl -s -o /tmp/plan7.json -w "%{http_code}" -c $OJAR -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$OWNER_PASS\"}")
check "login owner (200)" "200" "$code"
reqid=$(curl -s -b $OJAR $BASE/api/plan-requests | python3 -c "import sys,json;r=[x for x in json.load(sys.stdin)['requests'] if x['user']['email']=='$TEST_EMAIL'][0];print(r['id'])")
omomo=$(curl -s -b $OJAR $BASE/api/plan-requests | python3 -c "import sys,json;r=[x for x in json.load(sys.stdin)['requests'] if x['user']['email']=='$TEST_EMAIL'][0];print(r['momoNumber'])")
check "owner thấy số MoMo trong yêu cầu" "$MOMO" "$omomo"
# 4.3 Duyệt → 200
code=$(curl -s -o /tmp/plan8.json -w "%{http_code}" -b $OJAR -X PATCH $BASE/api/plan-requests/$reqid \
  -H "Content-Type: application/json" -d "{\"action\":\"approve\"}")
check "duyệt yêu cầu (200)" "200" "$code"
upg=$(cat /tmp/plan8.json | python3 -c "import sys,json;print(json.load(sys.stdin).get('upgradedPlan'))")
check "kết quả = plus" "plus" "$upg"
# 4.4 User đổi sang gói Plus + limit 85.000
curl -s -b $JAR $BASE/api/plans > /tmp/plan9.json
uplan=$(cat /tmp/plan9.json | python3 -c "import sys,json;print(json.load(sys.stdin)['plan'])")
plimit=$(cat /tmp/plan9.json | python3 -c "import sys,json;print(json.load(sys.stdin)['usage']['limit'])")
check "user.plan = plus" "plus" "$uplan"
check "limit mới = 85000" "85000" "$plimit"
# 4.5 Duyệt lại → 409
code=$(curl -s -o /dev/null -w "%{http_code}" -b $OJAR -X PATCH $BASE/api/plan-requests/$reqid \
  -H "Content-Type: application/json" -d "{\"action\":\"approve\"}")
check "duyệt lại yêu cầu cũ → 409" "409" "$code"
# 4.6 Yêu cầu gói đang dùng → 400
code=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR -X POST $BASE/api/plan-requests \
  -H "Content-Type: application/json" -H "X-Forwarded-For: $XFF_E" \
  -d "{\"plan\":\"plus\",\"phone\":\"$PHONE\",\"momoNumber\":\"$MOMO\",\"contactEmail\":\"$TEST_EMAIL\"}")
check "yêu cầu gói đang dùng → 400" "400" "$code"

echo ""
echo "═══ GIAI ĐOẠN 5: hạn mức chặn chat (402) ═══"
# 5.1 Tạo mức dùng fake = 85.000 (conversation QUOTA-TEST)
bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.user.findUnique({where:{email:'$TEST_EMAIL'}}).then(async u=>{const c=await db.conversation.create({data:{userId:u.id,title:'QUOTA-TEST',modelId:'khanhos-core'}});await db.message.create({data:{conversationId:c.id,role:'assistant',content:'x',tokens:85000}});console.log('fake usage set')}).finally(()=>db.\$disconnect())"
code=$(curl -s -o /tmp/plan10.json -w "%{http_code}" -b $JAR -X POST $BASE/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"alo\",\"modelId\":\"khanhos-core\"}")
check "chat khi hết hạn mức → 402" "402" "$code"
qmsg=$(cat /tmp/plan10.json | python3 -c "import sys,json;print(json.load(sys.stdin).get('error',''))" 2>/dev/null)
check_contains "thông báo nhắc mở Gói & Nâng cấp" "$qmsg" "Gói & Nâng cấp"
check_contains "thông báo dùng chữ tín dụng" "$qmsg" "tín dụng"
check_not_contains "thông báo KHÔNG chứa chữ token" "$qmsg" "token"
# 5.2 Xoá fake → chat thật chạy + ghi nhận mức dùng
bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.conversation.deleteMany({where:{title:'QUOTA-TEST',user:{email:'$TEST_EMAIL'}}}).then(r=>console.log('cleared',r.count)).finally(()=>db.\$disconnect())"
code=$(curl -s -o /tmp/plan11.txt -w "%{http_code}" -m 60 -b $JAR -X POST $BASE/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"trả lời ngắn: 2+2=?\",\"modelId\":\"khanhos-core\"}")
check "chat sau khi xoá fake (200)" "200" "$code"
sse=$(cat /tmp/plan11.txt)
check_contains "SSE có meta" "$sse" '"type":"meta"'
check_contains "SSE có done" "$sse" '"type":"done"'
mtokens=$(bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.conversation.findFirst({where:{title:{startsWith:'trả lời ngắn'},user:{email:'$TEST_EMAIL'}},orderBy:{createdAt:'desc'}}).then(async c=>{const m=await db.message.findFirst({where:{conversationId:c.id,role:'assistant'},orderBy:{createdAt:'desc'}});console.log(m&&m.tokens>0?'yes':'no')}).finally(()=>db.\$disconnect())")
check "assistant message ghi mức dùng > 0" "yes" "$mtokens"

echo ""
echo "═══ GIAI ĐOẠN 6: owner không bị giới hạn ═══"
bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.user.findUnique({where:{email:'$OWNER_EMAIL'}}).then(async u=>{const c=await db.conversation.create({data:{userId:u.id,title:'QUOTA-TEST-OWNER',modelId:'khanhos-core'}});await db.message.create({data:{conversationId:c.id,role:'assistant',content:'x',tokens:999999}});console.log('owner fake usage set')}).finally(()=>db.\$disconnect())"
code=$(curl -s -o /tmp/plan12.txt -w "%{http_code}" -m 60 -b $OJAR -X POST $BASE/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"trả lời ngắn: 1+1=?\",\"modelId\":\"khanhos-core\"}")
check "owner chat dù vượt hạn mức (200)" "200" "$code"

echo ""
echo "═══ DỌN DẸP ═══"
bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.conversation.deleteMany({where:{title:{startsWith:'QUOTA-TEST'}}}).then(r=>console.log('conv cleared',r.count)).then(()=>db.session.deleteMany({where:{user:{email:'$TEST_EMAIL'}}})).then(()=>db.planRequest.deleteMany({where:{user:{email:'$TEST_EMAIL'}}})).then(()=>db.conversation.deleteMany({where:{user:{email:'$TEST_EMAIL'}}})).then(()=>db.user.delete({where:{email:'$TEST_EMAIL'}})).then(()=>console.log('user test cleaned')).catch(e=>console.log('clean:',e.message)).finally(()=>db.\$disconnect())"
# Xoá hội thoại chat test của owner
bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.conversation.deleteMany({where:{title:{startsWith:'trả lời ngắn'},user:{email:'$OWNER_EMAIL'}}}).then(r=>console.log('owner test conv cleaned',r.count)).finally(()=>db.\$disconnect())"

echo ""
echo "════════════════════════════════════"
echo "KẾT QUẢ: $PASS PASS / $FAIL FAIL"
[ $FAIL -eq 0 ] && echo "TẤT CẢ PASS ✔" || echo "CÓ LỖI ✘"
exit $FAIL
