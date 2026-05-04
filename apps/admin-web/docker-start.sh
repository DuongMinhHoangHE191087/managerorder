#!/bin/sh
# ============================================================
# Production Startup Script
# Runs the unified supervisor so Next.js and Telegram polling stay isolated
# ============================================================

echo "🚀 Starting ManagerOrder Production Server..."
echo "   Next.js: port ${PORT:-8080}"
echo "   Telegram Bot: polling mode"
echo "   Zalo Bot: not started by this container (run a dedicated worker if needed)"

exec node --experimental-strip-types --import ./apps/admin-web/scripts/register-ts-loader.mjs ./apps/admin-web/scripts/runtime-supervisor.ts --mode=docker
