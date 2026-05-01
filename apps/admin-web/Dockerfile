# ============================================================
# Multi-stage Dockerfile for ManagerOrder Premium Admin Web
# Optimized for DigitalOcean App Platform
# Runs: Next.js server + Telegram Bot + Zalo Bot (polling mode)
# ============================================================

# Stage 1: Install dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable pnpm

# Copy workspace configuration and lockfile
# Note: These should be at the root of the build context
COPY pnpm-lock.yaml* pnpm-workspace.yaml* package.json ./

# Copy package.json files for all workspaces to allow dependency resolution
COPY apps/admin-web/package.json ./apps/admin-web/
COPY packages/zalo-bot-js/package.json ./packages/zalo-bot-js/

# Install dependencies
# Using --filter to install only what's needed for admin-web and its dependencies
RUN pnpm install --frozen-lockfile --filter @managerorder/admin-web...

# Stage 2: Build the Next.js app
FROM node:22-alpine AS builder
WORKDIR /app

# Re-enable pnpm in the builder stage
RUN corepack enable pnpm

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin-web/node_modules ./apps/admin-web/node_modules
COPY --from=deps /app/packages/zalo-bot-js/node_modules ./packages/zalo-bot-js/node_modules

# Copy the rest of the source code
COPY . .

# Build outputs standalone Next.js server
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV BUILD_STANDALONE=true

# Use pnpm to run build within the workspace
RUN pnpm --filter @managerorder/admin-web run build

# Stage 3: Production runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build + static assets
COPY --from=builder /app/apps/admin-web/public ./apps/admin-web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-web/.next/static ./apps/admin-web/.next/static

# Note: Standalone output puts the server.js at the root of the standalone folder
# but the static files need to be in the correct subpath.

# Copy source tree + bot scripts for production polling
COPY --from=builder /app/apps/admin-web/src ./apps/admin-web/src
COPY --from=builder /app/apps/admin-web/scripts ./apps/admin-web/scripts
COPY --from=builder /app/packages/zalo-bot-js/dist ./packages/zalo-bot-js/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/admin-web/node_modules ./apps/admin-web/node_modules

# Copy essential root files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/admin-web/package.json ./apps/admin-web/package.json
COPY --from=builder /app/apps/admin-web/docker-start.sh ./docker-start.sh

RUN chmod +x ./docker-start.sh

USER nextjs

EXPOSE 8080

# Start both Next.js server and Telegram bot via supervisor
CMD ["./docker-start.sh"]
