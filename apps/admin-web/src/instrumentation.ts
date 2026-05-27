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
  validateAccountSharingRuntime();
  const { shouldAutoRegisterTelegramWebhook } = await import(
    "@/lib/bot-manager/runtime-mode"
  );
  const autoRegister = shouldAutoRegisterTelegramWebhook(process.env);

  if (!autoRegister) return;

  // Delay slightly to let the server finish initializing
  setTimeout(async () => {
    try {
      const { autoRegisterWebhook } = await import("@/lib/services/telegram-auto-setup");
      await autoRegisterWebhook();
    } catch (err) {
      console.error('[Instrumentation] Failed to auto-register Telegram webhook:', err);
    }
  }, 3000);
}

function validateAccountSharingRuntime() {
  const missing = [
    "CREDENTIAL_ENCRYPTION_KEY",
    "SHARE_UNLOCK_SECRET",
    "NEXT_PUBLIC_SITE_URL",
  ].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(
      `[Instrumentation] Account sharing is missing env vars: ${missing.join(", ")}. ` +
      "Sharing routes will fail closed or fall back where possible.",
    );
  }
}
