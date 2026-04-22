import type { BotMiddleware } from '../bot-router';

const SLOW_THRESHOLD_MS = 1200;

/**
 * Lightweight perf middleware for Telegram update processing.
 * Logs only slow handlers to avoid noisy logs in normal traffic.
 */
export const perfMiddleware: BotMiddleware = async (ctx, next) => {
  const start = Date.now();
  await next();
  const elapsed = Date.now() - start;

  if (elapsed >= SLOW_THRESHOLD_MS) {
    const op = ctx.command ?? ctx.callbackData ?? 'text';
    console.warn(`[Bot Perf] slow update ${elapsed}ms chat=${ctx.chatId} op=${op}`);
  }
};
