// ============================================================
// NEXT.JS INSTRUMENTATION — Auto-register Telegram webhook
// ============================================================
// This file runs ONCE when the Next.js server starts (cold start).
// It automatically registers the Telegram webhook so the bot
// starts working immediately after every deploy/restart.
// ============================================================

export async function register() {
  // Only run in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const autoRegister =
    process.env.TELEGRAM_AUTO_REGISTER_WEBHOOK === 'true' ||
    (process.env.NODE_ENV === 'production' && process.env.TELEGRAM_AUTO_REGISTER_WEBHOOK !== 'false');

  if (!autoRegister) return;

  // Delay slightly to let the server finish initializing
  setTimeout(async () => {
    try {
      const { autoRegisterWebhook } = await import(
        '@/lib/services/telegram-auto-setup'
      );
      await autoRegisterWebhook();
    } catch (err) {
      console.error('[Instrumentation] Failed to auto-register Telegram webhook:', err);
    }
  }, 3000);
}
