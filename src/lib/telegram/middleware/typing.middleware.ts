import type { BotMiddleware } from '../bot-router';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';

/**
 * Typing indicator middleware — sends "typing..." action before
 * every handler to give users immediate visual feedback.
 */
export const typingMiddleware: BotMiddleware = async (ctx, next) => {
  // Skip typing action for callback queries to reduce API noise/latency.
  if (ctx.callbackData) {
    await next();
    return;
  }

  // Fire and forget — don't await to avoid delaying the handler
  if (BOT_TOKEN) {
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ctx.chatId, action: 'typing' }),
    }).catch(() => { /* Non-critical */ });
  }
  await next();
};
