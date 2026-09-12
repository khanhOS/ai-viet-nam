#!/bin/bash
# KhanhOS AI — Test chính sách owner mới:
#   (1) Password owner đổi thành khanh0712014@#
#   (2) hoangbaokhanhhehe@gmail.com ĐĂNG KÝ ⇒ luôn role owner
#   (3) Email thường đăng ký ⇒ role user (không bị ảnh hưởng)
# Chạy: bash scripts/test-owner-register.sh   (cần dev server ở :3000)
BASE="http://localhost:3000"
JAR="/tmp/kh-owner-reg.jar"
PASS=0; FAIL=0

check() { # name, expected, actual
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "✔ $1";
  else FAIL=$((FAIL+1)); echo "✘ $1 — expected [$2] got [$3]"; fi
}

OWNER_EMAIL="hoangbaokhanhhehe@gmail.com"
NEW_PASS='khanh0712014@#'
OLD_PASS='khanhhehedz'

echo "═══ GIAI ĐOẠN 1: password owner mới hoạt động ═══"

# 1.1 Login owner với mật khẩu MỚI → 200 + role owner
rm -f $JAR
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -c $JAR -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$NEW_PASS\"}")
check "login owner với mật khẩu mới (200)" "200" "$code"
role=$(cat /tmp/r.json | python3 -c "import sys,json;print(json.load(sys.stdin)['user'].get('role'))" 2>/dev/null)
check "login response role = owner" "owner" "$role"

# 1.2 Login owner với mật khẩu CŨ → 401 (chứng minh đã đổi pass)
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$OLD_PASS\"}")
check "login owner với mật khẩu cũ bị từ chối (401)" "401" "$code"

echo ""
echo "═══ GIAI ĐOẠN 2: đăng ký email owner ⇒ luôn owner ═══"

# 2.1 Xoá owner trong DB để mô phỏng DB mới / chưa seed
bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.session.deleteMany({where:{user:{email:'$OWNER_EMAIL'}}}).then(()=>db.user.delete({where:{email:'$OWNER_EMAIL'}})).then(()=>console.log('owner deleted for register-test')).catch(e=>console.log('delete:',e.message)).finally(()=>db.\$disconnect())"

# 2.2 ĐĂNG KÝ owner email qua API công khai → phải nhận role OWNER
rm -f $JAR
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -c $JAR -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" -H "X-Forwarded-For: 10.88.0.1" \
  -d "{\"name\":\"Khanh\",\"email\":\"$OWNER_EMAIL\",\"password\":\"$NEW_PASS\",\"confirmPassword\":\"$NEW_PASS\"}")
check "đăng ký email owner thành công (200)" "200" "$code"
role=$(cat /tmp/r.json | python3 -c "import sys,json;print(json.load(sys.stdin)['user'].get('role'))" 2>/dev/null)
check "đăng ký email owner ⇒ role = owner (LUÔN)" "owner" "$role"

# 2.3 DB thật: role của user vừa tạo
dbrole=$(bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.user.findUnique({where:{email:'$OWNER_EMAIL'}}).then(u=>console.log(u?u.role:'null')).finally(()=>db.\$disconnect())")
check "DB: user vừa đăng ký có role = owner" "owner" "$dbrole"

# 2.4 Session register trả về hợp lệ → /me vẫn owner
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -b $JAR $BASE/api/auth/me)
check "GET /api/auth/me với session mới (200)" "200" "$code"
merole=$(cat /tmp/r.json | python3 -c "import sys,json;u=json.load(sys.stdin).get('user');print(u.get('role') if u else 'null')" 2>/dev/null)
check "me ⇒ role = owner" "owner" "$merole"

# 2.5 Login lại sau khi đăng ký → 200 role owner
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$NEW_PASS\"}")
check "login sau khi đăng ký bằng mật khẩu mới (200)" "200" "$code"
role=$(cat /tmp/r.json | python3 -c "import sys,json;print(json.load(sys.stdin)['user'].get('role'))" 2>/dev/null)
check "login lại ⇒ role = owner" "owner" "$role"

# 2.6 Đăng ký TRÙNG email owner (đã tồn tại) → 409 như thường
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" -H "X-Forwarded-For: 10.88.0.2" \
  -d "{\"name\":\"Khanh\",\"email\":\"$OWNER_EMAIL\",\"password\":\"$NEW_PASS\",\"confirmPassword\":\"$NEW_PASS\"}")
check "đăng ký trùng email owner → 409 (email đã tồn tại)" "409" "$code"

echo ""
echo "═══ GIAI ĐOẠN 2b: cách viết haong… cũng là owner + vô hạn ═══"

OWNER2_EMAIL="haongbaokhanhhehe@gmail.com"

# 2b.1 Xoá (nếu có) để mô phỏng DB mới
bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.session.deleteMany({where:{user:{email:'$OWNER2_EMAIL'}}}).then(()=>db.user.deleteMany({where:{email:'$OWNER2_EMAIL'}})).then(()=>console.log('owner2 cleaned')).catch(e=>console.log('delete:',e.message)).finally(()=>db.\$disconnect())"

# 2b.2 ĐĂNG KÝ cách viết haong… ⇒ cũng nhận role OWNER
rm -f /tmp/kh-owner2.jar
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -c /tmp/kh-owner2.jar -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" -H "X-Forwarded-For: 10.88.0.3" \
  -d "{\"name\":\"Khanh\",\"email\":\"$OWNER2_EMAIL\",\"password\":\"$NEW_PASS\",\"confirmPassword\":\"$NEW_PASS\"}")
check "đăng ký email haong… (200)" "200" "$code"
role=$(cat /tmp/r.json | python3 -c "import sys,json;print(json.load(sys.stdin)['user'].get('role'))" 2>/dev/null)
check "email haong… ⇒ role = owner (LUÔN)" "owner" "$role"

# 2b.3 /api/plans với session owner haong… ⇒ limit = null (VÔ HẠN mức dùng)
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -b /tmp/kh-owner2.jar $BASE/api/plans)
check "GET /api/plans owner haong… (200)" "200" "$code"
limit=$(cat /tmp/r.json | python3 -c "import sys,json;u=json.load(sys.stdin).get('usage') or {};print(u.get('limit'))" 2>/dev/null)
check "owner haong… ⇒ limit = null (vô hạn)" "None" "$limit"

# 2b.4 /api/plans với session owner hoang… ⇒ limit = null (vô hạn mức dùng)
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -b $JAR $BASE/api/plans)
check "GET /api/plans owner hoang… (200)" "200" "$code"
limit=$(cat /tmp/r.json | python3 -c "import sys,json;u=json.load(sys.stdin).get('usage') or {};print(u.get('limit'))" 2>/dev/null)
check "owner hoang… ⇒ limit = null (vô hạn)" "None" "$limit"

echo ""
echo "═══ GIAI ĐOẠN 3: email thường vẫn role user ═══"

# 3.1 Đăng ký email thường → role user
TS=$(date +%s%3N)
NORMAL="normal$TS@test.dev"
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" -H "X-Forwarded-For: 10.88.0.4" \
  -d "{\"name\":\"User Thường\",\"email\":\"$NORMAL\",\"password\":\"12345678\",\"confirmPassword\":\"12345678\"}")
check "đăng ký email thường (200)" "200" "$code"
role=$(cat /tmp/r.json | python3 -c "import sys,json;print(json.load(sys.stdin)['user'].get('role'))" 2>/dev/null)
check "email thường ⇒ role = user (không tự nâng)" "user" "$role"

# 3.2 Dọn user test
bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.session.deleteMany({where:{user:{email:'$NORMAL'}}}).then(()=>db.user.delete({where:{email:'$NORMAL'}})).then(()=>console.log('cleaned')).finally(()=>db.\$disconnect())"
echo "✔ dọn user test $NORMAL"

echo ""
echo "════════════════════════════════════"
echo "KẾT QUẢ: $PASS PASS / $FAIL FAIL"
[ $FAIL -eq 0 ] && echo "TẤT CẢ PASS ✔" || echo "CÓ LỖI ✘"
exit $FAIL
