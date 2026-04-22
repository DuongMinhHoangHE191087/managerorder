#!/bin/sh
# ============================================================
# Production Startup Script
# Runs the unified supervisor so Next.js + Telegram Bot + Zalo Bot stay isolated
# ============================================================

echo "🚀 Starting ManagerOrder Production Server..."
echo "   Next.js: port ${PORT:-8080}"
echo "   Telegram Bot: polling mode"
echo "   Zalo Bot: polling mode"

exec node --experimental-strip-types --import ./scripts/register-ts-loader.mjs ./scripts/runtime-supervisor.ts --mode=docker
