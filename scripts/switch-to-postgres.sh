#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# KHANHOS AI — Chuyển database từ SQLite (sandbox/dev) sang
# PostgreSQL (production: Supabase / Neon / Vercel Postgres).
#
# Cách dùng:
#   1. Đặt DATABASE_URL PostgreSQL trong .env:
#      DATABASE_URL="postgresql://user:pass@host:5432/khanhos?schema=public"
#      (Supabase: Settings → Database → Connection string → URI)
#   2. ./scripts/switch-to-postgres.sh
#   3. bunx prisma migrate dev --name init   (tạo bảng)
#   4. bun run build && deploy lên Vercel (set cùng DATABASE_URL)
#
# Quay lại SQLite cho dev:
#   DATABASE_URL="file:./db/custom.db" trong .env
#   cp prisma/schema.sqlite.prisma prisma/schema.prisma && bunx prisma generate
# ═══════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

if ! grep -q '^DATABASE_URL="postgres' .env 2>/dev/null; then
  echo "⚠  DATABASE_URL trong .env chưa phải chuỗi postgresql://"
  echo "   Hãy sửa .env trước, ví dụ:"
  echo '   DATABASE_URL="postgresql://user:pass@host:5432/khanhos?schema=public"'
  exit 1
fi

# Sao lưu schema SQLite hiện tại
cp prisma/schema.prisma prisma/schema.sqlite.prisma

# Bật schema PostgreSQL
cp prisma/schema.postgres.prisma prisma/schema.prisma

# Tạo lại Prisma Client cho PostgreSQL
bunx prisma generate

echo ""
echo "✓ Đã chuyển sang PostgreSQL."
echo "  Tiếp theo: bunx prisma migrate dev --name init"
echo "  (hoặc áp SQL thủ công từ prisma/postgres-migration.sql)"
