#!/bin/bash
# Xem nội dung trả lời thật của 3 câu hỏi tự do qua app (field content của done event)
BASE="http://localhost:3000"
JAR="/tmp/kh-revive2.jar"
TS=$(date +%s%3N)
curl -s -o /dev/null -c $JAR -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" -H "X-Forwarded-For: 10.97.0.1" \
  -d "{\"name\":\"QA Test\",\"email\":\"qa-$TS@test.dev\",\"password\":\"12345678\",\"confirmPassword\":\"12345678\"}"

ask() {
  echo "──────────────────────────────"
  echo "❓ $1"
  curl -s -N --max-time 120 -X POST $BASE/api/chat -H "Content-Type: application/json" -b $JAR \
    -d "{\"content\":\"$1\",\"modelId\":\"khanhos-core\"}" | python3 -c "
import sys, json, re
raw = sys.stdin.read()
events = [json.loads(x) for x in re.findall(r'^data: (.+)$', raw, re.M) if x]
done = next((e for e in events if e.get('type')=='done'), {})
print('source:', done.get('source'), '| intent:', done.get('intent'), '| conf:', round(done.get('confidence') or 0,2))
print('TRẢ LỜI:', (done.get('content') or '')[:400].replace(chr(10),' ⏎ '))
"
}

ask "vì sao bầu trời lại màu xanh? giải thích ngắn gọn"
ask "hãy kể mình nghe một sự thật thú vị về vũ trụ"
ask "nếu mình có 3苹果 và ăn đi 1 quả thì còn mấy quả?"
