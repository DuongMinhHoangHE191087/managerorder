// Callback Query Acknowledgment Middleware
// Automatically calls answerCallbackQuery for every callback_query update
// to dismiss the loading spinner on Telegram's Inline Keyboard buttons.
import type { BotMiddleware } from '../bot-router';
import { answerCallbackQuery } from '@/lib/utils/telegram';

export const callbackAckMiddleware: BotMiddleware = async (ctx, next) => {
  // Acknowledge early so inline button spinner disappears immediately.
  const callbackQueryId = ctx.update.callback_query?.id;
  if (callbackQueryId) {
    answerCallbackQuery(callbackQueryId).catch(() => { /* Non-critical */ });
  }

  await next();
};
