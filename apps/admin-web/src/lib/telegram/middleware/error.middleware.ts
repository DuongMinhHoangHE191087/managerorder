// Global Error Handler Middleware
// Catches any unhandled errors in handlers and sends a user-friendly message.
import type { BotMiddleware } from '../bot-router';
import { sendTelegramMessage } from '@/lib/utils/telegram';

export const errorMiddleware: BotMiddleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Bot Error] chatId=${ctx.chatId} cmd=${ctx.command ?? ctx.callbackData ?? 'unknown'}:`, errMsg);

    try {
      await sendTelegramMessage(
        [
          `❌ <b>Đã xảy ra lỗi</b>`,
          `Vui lòng thử lại sau hoặc quay về menu chính.`,
          ``,
          `<i>Chi tiết: ${errMsg.slice(0, 100)}</i>`,
        ].join('\n'),
        { chatId: String(ctx.chatId) }
      );
    } catch {
      // If even the error message fails to send, just log it
      console.error('[Bot Error] Failed to send error notification to user.');
    }
  }
};
