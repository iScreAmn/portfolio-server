# syntax=docker/dockerfile:1

# ─── Зависимости ──────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Движку Prisma в alpine нужен openssl.
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
# Схема должна лежать до npm ci: postinstall запускает prisma generate.
COPY prisma ./prisma

# prisma CLI намеренно в dependencies, а не в dev: этим же образом деплой
# накатывает миграции командой `prisma migrate deploy`.
RUN npm ci --omit=dev

# ─── Рантайм ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production \
    PORT=5050

RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S api -G nodejs

COPY --from=deps --chown=api:nodejs /app/node_modules ./node_modules
COPY --chown=api:nodejs . .

USER api
EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:5050/api/health || exit 1

CMD ["node", "server.js"]
