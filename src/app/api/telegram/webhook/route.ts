// ============================================================
// TELEGRAM WEBHOOK — Receives updates from Telegram Bot API
// ============================================================
// 🔒 SECURITY LAYER 1: Webhook Secret Token
//   Telegram sends this header with every request if configured.
//   Requests without valid secret are instantly rejected.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { resolveTelegramBotAccount } from "@/lib/bot-manager/runtime-account";
import { bot } from '@/lib/telegram';
import { withAccount } from '@/lib/api/with-account';

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
const DEDUP_TTL_MS = 10 * 60 * 1000;
const processedUpdateIds = new Map<number, number>();

function cleanupProcessedUpdates(now: number): void {
  for (const [updateId, ts] of processedUpdateIds.entries()) {
    if (now - ts > DEDUP_TTL_MS) processedUpdateIds.delete(updateId);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 🔒 Layer 1: Verify webhook secret — MANDATORY
    if (!WEBHOOK_SECRET) {
      console.error('[Webhook] TELEGRAM_WEBHOOK_SECRET not configured! Rejecting all requests.');
      return NextResponse.json({ error: 'Bot not configured' }, { status: 503 });
    }

    const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
    if (secretHeader !== WEBHOOK_SECRET) {
      const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
      console.warn(`[Webhook] ⚠️ Invalid secret token from IP: ${ip}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updateId = typeof body.update_id === 'number' ? body.update_id : null;
    const now = Date.now();

    cleanupProcessedUpdates(now);
    if (updateId !== null && processedUpdateIds.has(updateId)) {
      console.log(`[Webhook] ⏭️ Skip duplicate update_id=${updateId}`);
      return NextResponse.json({ ok: true, duplicate: true });
    }
    if (updateId !== null) {
      processedUpdateIds.set(updateId, now);
    }

    // Log incoming update type for debugging
    const updateType = body.message ? 'message' : body.callback_query ? 'callback_query' : 'other';
    const chatId = body.message?.chat?.id ?? body.callback_query?.message?.chat?.id ?? 'unknown';
    console.log(`[Webhook] ← ${updateType} from chat ${chatId}`);

    // 🚀 Process update — wait for completion to catch errors
    // Changed from fire-and-forget to await for better error visibility
    try {
      await bot.processUpdate(body);
      console.log(`[Webhook] ✅ ${updateType} processed for chat ${chatId}`);
    } catch (err) {
      console.error(`[Webhook] ❌ bot processUpdate error for chat ${chatId}:`, err);
      // Still return 200 to prevent Telegram from retrying the same update
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Webhook] Parse error:', error);
    return NextResponse.json({ ok: true });
  }
}

// GET — Health check + diagnostics
export const GET = withAccount(async () => {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID ?? '';
  const botAccount = await resolveTelegramBotAccount();
  
  const diagnostics: Record<string, unknown> = {
    botTokenConfigured: !!BOT_TOKEN,
    webhookSecretConfigured: !!WEBHOOK_SECRET,
    adminChatIdConfigured: !!ADMIN_CHAT_ID,
    botAccountConfigured: !!botAccount.accountId,
    botAccountSource: botAccount.source,
    botAccountWarnings: botAccount.warnings,
  };

  // Test bot API connectivity
  if (BOT_TOKEN) {
    try {
      const [botMeRes, webhookRes] = await Promise.all([
        fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`, {
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`, {
          signal: AbortSignal.timeout(5000),
        }),
      ]);
      const data = await botMeRes.json();
      const webhookData = await webhookRes.json();
      diagnostics.botApiOk = data.ok;
      diagnostics.botName = data.result?.first_name;
      diagnostics.botUsername = data.result?.username;
      diagnostics.webhookInfo = webhookData.result ?? null;
    } catch (e) {
      diagnostics.botApiOk = false;
      diagnostics.botApiError = e instanceof Error ? e.message : 'Unknown';
    }
  }

  return NextResponse.json({
    status: 'ok',
    bot: 'ManagerOrder Bot v5.1',
    diagnostics,
    setup: {
      alreadyConfigured: false,
      commands: null,
      menuButton: null,
      description: null,
      webhookInfo: 'read-only',
      errors: [],
    },
  });
});
