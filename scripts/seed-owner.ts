// KhanhOS AI — Seed owner account (idempotent, chạy được nhiều lần)
// -----------------------------------------------------------------
// Usage:  bun scripts/seed-owner.ts
// Override qua env (khuyến nghị ở production/Vercel):
//   OWNER_EMAIL (nhiều email cách nhau bằng dấu phẩy) / OWNER_PASSWORD / OWNER_NAME
// Mỗi lần chạy: tạo MỌI tài khoản owner nếu chưa có, hoặc reset mật khẩu
// + đảm bảo role=owner (hỗ trợ nhiều email vì khác chính tả "hoang/haong").

import { PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { OWNER_EMAILS } from "../src/lib/auth/owner";

const db = new PrismaClient();

const OWNER_PASSWORD = process.env.OWNER_PASSWORD ?? "khanh0712014@#";
const OWNER_NAME = process.env.OWNER_NAME ?? "Khanh";

async function main() {
  const passwordHash = await hashPassword(OWNER_PASSWORD);

  for (const email of OWNER_EMAILS) {
    const user = await db.user.upsert({
      where: { email },
      update: { passwordHash, role: "owner" }, // re-run ⇒ reset pass + giữ role owner
      create: {
        email,
        name: OWNER_NAME,
        passwordHash,
        role: "owner",
        avatarSeed: Math.random().toString(36).slice(2, 10),
      },
    });

    // Đảm bảo có row UserSettings (1-1)
    await db.userSettings
      .upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } })
      .catch(() => {});

    // Verify round-trip ngay sau khi seed
    const ok = await verifyPassword(OWNER_PASSWORD, user.passwordHash);
    console.log(`✔ Owner sẵn sàng: ${user.email} — role=${user.role} — verify=${ok ? "PASS" : "FAIL"}`);
    if (!ok) process.exit(1);
  }

  console.log(`✔ Tổng cộng ${OWNER_EMAILS.length} tài khoản owner (cùng mật khẩu, vô hạn mức dùng).`);
}

main()
  .catch((e) => {
    console.error("Seed owner thất bại:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
