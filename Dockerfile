# ============================================================
# Multi-stage Dockerfile for ManagerOrder monorepo
# Optimized for DigitalOcean App Platform
# Runs: Next.js server + Telegram bot polling
# ============================================================

FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

RUN corepack enable pnpm

COPY pnpm-lock.yaml* pnpm-workspace.yaml* package.json ./
COPY apps/admin-web/package.json ./apps/admin-web/
COPY packages/zalo-bot-js/package.json ./packages/zalo-bot-js/

RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin-web/node_modules ./apps/admin-web/node_modules
COPY --from=deps /app/packages/zalo-bot-js/node_modules ./packages/zalo-bot-js/node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV BUILD_STANDALONE=true

RUN corepack pnpm build:all

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/admin-web/public ./apps/admin-web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-web/.next/static ./apps/admin-web/.next/static
COPY --from=builder /app/apps/admin-web/src ./apps/admin-web/src
COPY --from=builder /app/apps/admin-web/scripts ./apps/admin-web/scripts
COPY --from=builder /app/packages/zalo-bot-js/dist ./packages/zalo-bot-js/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/admin-web/node_modules ./apps/admin-web/node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/admin-web/package.json ./apps/admin-web/package.json
COPY --from=builder /app/apps/admin-web/docker-start.sh ./docker-start.sh

RUN chmod +x ./docker-start.sh

USER nextjs

EXPOSE 8080

CMD ["./docker-start.sh"]
