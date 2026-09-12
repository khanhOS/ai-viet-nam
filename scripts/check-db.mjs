import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const convs = await db.conversation.findMany({ orderBy: { updatedAt: 'desc' }, take: 3, select: { id: true, title: true, modelId: true, _count: { select: { messages: true } } } });
console.log(JSON.stringify(convs, null, 2));
const msgs = await db.message.findMany({ orderBy: { createdAt: 'desc' }, take: 2, select: { role: true, content: true } });
console.log(msgs.map(m => `${m.role}: ${m.content.slice(0, 70)}`).join('\n'));
await db.$disconnect();
