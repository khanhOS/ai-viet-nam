import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const junk = await db.user.deleteMany({ where: { OR: [
  { email: { contains: "@test.dev" } },
  { email: "clienttest@vidu.com" },
] } });
console.log("Đã xoá user test rác:", junk.count);
const owners = await db.user.findMany({ where: { role: "owner" }, select: { email: true, role: true } });
console.log("Owner:", JSON.stringify(owners));
const total = await db.user.count();
console.log("Tổng user còn lại:", total);
await db.$disconnect();
