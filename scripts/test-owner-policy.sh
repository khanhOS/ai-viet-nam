#!/bin/bash
# KhanhOS AI — Test password policy mới (4–128, không yêu cầu chữ/số) + owner account
BASE="http://localhost:3000"
JAR="/tmp/kh-owner-test.jar"
PASS=0; FAIL=0

check() { # name, expected, actual
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "✔ $1";
  else FAIL=$((FAIL+1)); echo "✘ $1 — expected [$2] got [$3]"; fi
}

ts() { date +%s%3N; }
EMAIL="pw$(ts)@test.dev"

# 1. Mật khẩu 3 ký tự → 400
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"T\",\"email\":\"s$EMAIL\",\"password\":\"abc\",\"confirmPassword\":\"abc\"}")
check "register pass 3 ký tự bị chặn (400)" "400" "$code"
grep -q "ít nhất 4" /tmp/r.json && echo "✔ message đúng: $(cat /tmp/r.json | head -c 120)" || { echo "✘ message không đúng"; FAIL=$((FAIL+1)); }

# 2. Mật khẩu 4 ký tự chỉ chữ → 200 (chính sách mới cho phép)
rm -f $JAR
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -c $JAR -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test PW\",\"email\":\"$EMAIL\",\"password\":\"abcd\",\"confirmPassword\":\"abcd\"}")
check "register pass 4 ký tự chỉ chữ OK (200)" "200" "$code"
role=$(cat /tmp/r.json | python3 -c "import sys,json;print(json.load(sys.stdin)['user'].get('role'))" 2>/dev/null)
check "user mới có role mặc định = user" "user" "$role"

# 3. Mật khẩu 129 ký tự → 400
long=$(python3 -c "print('a'*129)")
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"T\",\"email\":\"l$EMAIL\",\"password\":\"$long\",\"confirmPassword\":\"$long\"}")
check "register pass 129 ký tự bị chặn (400)" "400" "$code"

# 4. Mật khẩu 128 ký tự chỉ số → 200 (max cho phép, không cần chữ)
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"T2\",\"email\":\"m$EMAIL\",\"password\":\"$(python3 -c "print('1'*128)")\",\"confirmPassword\":\"$(python3 -c "print('1'*128)")\"}")
check "register pass 128 ký tự chỉ số OK (200)" "200" "$code"

# 5. Login owner hoangbaokhanhhehe@gmail.com / khanh0712014@#
rm -f $JAR
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -c $JAR -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hoangbaokhanhhehe@gmail.com","password":"khanh0712014@#"}')
check "login owner đúng pass (200)" "200" "$code"
role=$(cat /tmp/r.json | python3 -c "import sys,json;print(json.load(sys.stdin)['user'].get('role'))" 2>/dev/null)
check "login response role = owner" "owner" "$role"

# 6. Login owner sai pass → 401
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hoangbaokhanhhehe@gmail.com","password":"saimatkhau"}')
check "login owner sai pass (401)" "401" "$code"

# 7. /api/auth/me với session owner → role owner
code=$(curl -s -o /tmp/r.json -w "%{http_code}" -b $JAR $BASE/api/auth/me)
check "GET /api/auth/me owner (200)" "200" "$code"
role=$(cat /tmp/r.json | python3 -c "import sys,json;print(json.load(sys.stdin)['user'].get('role'))" 2>/dev/null)
check "me.role = owner" "owner" "$role"

# 8. /api/models với session owner (guard + SessionUser mới hoạt động)
code=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR $BASE/api/models)
check "GET /api/models với owner session (200)" "200" "$code"

# 9. Logout
code=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR -c $JAR -X POST $BASE/api/auth/logout)
check "logout owner (200)" "200" "$code"
body=$(curl -s -b $JAR $BASE/api/auth/me)
echo "$body" | grep -q '"user":null' && check "sau logout me → user null" "ok" "ok" || check "sau logout me → user null" "ok" "FAIL: $body"

echo ""
echo "════ KẾT QUẢ: $PASS PASS / $FAIL FAIL ════"
[ $FAIL -eq 0 ] || exit 1
