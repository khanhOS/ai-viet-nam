#!/bin/bash
# Iron Forge — Test POST /api/trial-booking (validation + chuẩn hoá + rate limit + CSRF)
# Mỗi case dùng X-Forwarded-For riêng để không dính chung bucket rate limit.
BASE="http://localhost:3000"
PASS=0; FAIL=0
check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "✔ $1"; else FAIL=$((FAIL+1)); echo "✘ $1 — expected [$2] got [$3]"; fi; }
ts() { date +%s%3N; }
H='Content-Type: application/json'

# 1. Booking hợp lệ → 200 + id
code=$(curl -s -o /tmp/tb.json -w "%{http_code}" -X POST $BASE/api/trial-booking -H "$H" -H "X-Forwarded-For: 10.1.0.1" \
  -d "{\"name\":\"Nguyễn Văn A\",\"phone\":\"09$(ts | tail -c 9)\",\"goal\":\"muscle\",\"preferredTime\":\"evening\",\"note\":\"kiểm thử tự động\"}")
check "booking hợp lệ (200)" "200" "$code"
grep -q '"id"' /tmp/tb.json && check "trả booking.id" "ok" "ok" || check "trả booking.id" "ok" "FAIL: $(cat /tmp/tb.json)"

# 2. SĐT +84 → 200 và chuẩn hoá về 0
code=$(curl -s -o /tmp/tb84.json -w "%{http_code}" -X POST $BASE/api/trial-booking -H "$H" -H "X-Forwarded-For: 10.1.0.2" \
  -d "{\"name\":\"Test Chuẩn Hoá\",\"phone\":\"+84901234567\",\"goal\":\"fatloss\",\"preferredTime\":\"morning\"}")
check "SĐT +84 hợp lệ (200)" "200" "$code"

# 3. SĐT sai định dạng → 400
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/trial-booking -H "$H" -H "X-Forwarded-For: 10.1.0.3" \
  -d "{\"name\":\"Test\",\"phone\":\"12345\",\"goal\":\"muscle\",\"preferredTime\":\"evening\"}")
check "SĐT sai (400)" "400" "$code"

# 4. Goal lạ → 400
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/trial-booking -H "$H" -H "X-Forwarded-For: 10.1.0.4" \
  -d "{\"name\":\"Test\",\"phone\":\"0901234567\",\"goal\":\"powerlifting\",\"preferredTime\":\"evening\"}")
check "goal lạ (400)" "400" "$code"

# 5. Tên ngắn → 400
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/trial-booking -H "$H" -H "X-Forwarded-For: 10.1.0.5" \
  -d "{\"name\":\"T\",\"phone\":\"0901234567\",\"goal\":\"muscle\",\"preferredTime\":\"evening\"}")
check "tên 1 ký tự (400)" "400" "$code"

# 6. CSRF cross-site → 403 (không tốn bucket rate limit)
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/trial-booking -H "$H" \
  -H "Origin: https://evil.com" -H "Sec-Fetch-Site: cross-site" -H "X-Forwarded-For: 10.1.0.6" \
  -d "{\"name\":\"CSRF\",\"phone\":\"0901234567\",\"goal\":\"muscle\",\"preferredTime\":\"evening\"}")
check "CSRF cross-site (403)" "403" "$code"

# 7. Rate limit: 3 lần từ cùng IP → lần 4 = 429
for i in 1 2 3; do
  curl -s -o /dev/null -X POST $BASE/api/trial-booking -H "$H" -H "X-Forwarded-For: 10.1.0.7" \
    -d "{\"name\":\"RL $i\",\"phone\":\"0901234567\",\"goal\":\"fitness\",\"preferredTime\":\"noon\"}" > /dev/null
done
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/trial-booking -H "$H" -H "X-Forwarded-For: 10.1.0.7" \
  -d "{\"name\":\"RL 4\",\"phone\":\"0901234567\",\"goal\":\"fitness\",\"preferredTime\":\"noon\"}")
check "rate limit lần 4 cùng IP (429)" "429" "$code"

# 8. Kiểm tra lưu DB thật + SĐT +84 đã chuẩn hoá về 0
bun -e "
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const last84 = await db.trialBooking.findFirst({ where: { name: 'Test Chuẩn Hoá' } });
const ok = last84 && last84.phone === '0901234567';
console.log(ok ? 'NORMALIZE_OK' : 'NORMALIZE_FAIL:' + last84?.phone);
await db.\$disconnect();
" > /tmp/tb-norm.txt 2>&1
grep -q "NORMALIZE_OK" /tmp/tb-norm.txt && check "+84 → chuẩn hoá 090…" "ok" "ok" || check "+84 → chuẩn hoá 090…" "ok" "FAIL: $(cat /tmp/tb-norm.txt)"

echo ""
echo "════ KẾT QUẢ: $PASS PASS / $FAIL FAIL ════"
[ $FAIL -eq 0 ] || exit 1
