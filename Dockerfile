FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=10000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data
COPY --from=builder /app/prisma ./prisma

EXPOSE 10000
CMD ["node", "server.js"]
