#!/bin/bash
# KhanhOS AI — Cài đặt Ollama + model local (chạy trong sandbox)
# Mất sandbox / redeploy? Chạy lại: bash scripts/setup-ollama.sh
set -u

OLLAMA_DIR="$HOME/.local/ollama"
OLLAMA_BIN="$OLLAMA_DIR/bin/ollama"
OLLAMA_MODELS="$HOME/.ollama/models"
LOG="$OLLAMA_DIR/serve.log"

# Model ưu tiên theo env AI_MODEL (mặc định qwen2.5:0.5b — vừa RAM 4GB / 2 CPU)
MODEL="${AI_MODEL:-qwen2.5:0.5b}"
PORT="${OLLAMA_PORT:-11434}"

echo "== [1/4] Tải/nạp Ollama =="
if [ -x "$OLLAMA_BIN" ]; then
  echo "Ollama đã có tại $OLLAMA_BIN"
else
  mkdir -p "$OLLAMA_DIR/bin"
  # Ollama >= 0.34 phát hành bản .tar.zst (asset mới — .tgz cũ đã 404)
  curl -L --fail --retry 3 -o /tmp/ollama.tar.zst \
    https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64.tar.zst
  python3 - "$OLLAMA_DIR" <<'PYEOF'
import sys, tarfile, io, zstandard
dest = sys.argv[1]
with open("/tmp/ollama.tar.zst", "rb") as fh:
    dctx = zstandard.ZstdDecompressor()
    with dctx.stream_reader(fh) as reader:
        with tarfile.open(fileobj=reader, mode="r|") as tar:
            tar.extractall(dest)  # tar chứa bin/ollama, lib/...
print("extracted ->", dest)
PYEOF
  rm -f /tmp/ollama.tar.zst
  chmod +x "$OLLAMA_BIN"
fi
"$OLLAMA_BIN" --version || true

echo "== [2/4] Khởi động Ollama server (127.0.0.1:$PORT) =="
export OLLAMA_HOST="127.0.0.1:$PORT"
export OLLAMA_MODELS="$OLLAMA_MODELS"
export OLLAMA_MAX_LOADED_MODELS=1
export OLLAMA_KEEP_ALIVE=30m
if curl -sf "http://127.0.0.1:$PORT/api/version" >/dev/null 2>&1; then
  echo "Ollama server đã chạy"
else
  # daemonize double-fork: thoát process group để sống sót sau khi shell đóng
  python3 /home/z/my-project/scripts/daemonize.py "$OLLAMA_DIR/serve.log" "$OLLAMA_BIN" serve
  for i in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:$PORT/api/version" >/dev/null 2>&1; then break; fi
    sleep 1
  done
fi
curl -sf "http://127.0.0.1:$PORT/api/version" || { echo "LỖI: không khởi động được Ollama"; exit 1; }

echo "== [3/4] Kéo model $MODEL =="
"$OLLAMA_BIN" pull "$MODEL" || { echo "LỖI: pull model"; exit 1; }

echo "== [4/4] Kiểm tra inference thật =="
"$OLLAMA_BIN" run "$MODEL" "2+2=? Trả lời ngắn." 2>&1 | tail -3

echo "HOÀN TẤT: Ollama + $MODEL sẵn sàng tại 127.0.0.1:$PORT"
