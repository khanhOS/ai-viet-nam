import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const s = await db.userSettings.findFirst({ orderBy: { userId: 'desc' }, select: { userId: true, theme: true, defaultModelId: true } });
console.log(JSON.stringify(s));
await db.$disconnect();
