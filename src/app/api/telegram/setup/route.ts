// ============================================================
// TELEGRAM WEBHOOK SETUP — Register/check webhook with Telegram API
// ============================================================
// Usage:
//   GET  /api/telegram/setup — Check current webhook status
//   POST /api/telegram/setup — Register webhook URL with Telegram
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAccount } from '@/lib/api/with-account';
import { forceReconfigure } from '@/lib/services/telegram-auto-setup';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';

/**
 * GET — Check current webhook info from Telegram
 */
export const GET = withAccount(async () => {
  if (!BOT_TOKEN) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_TOKEN not configured' },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
    );
    const data = await res.json();
    return NextResponse.json({
      ok: data.ok,
      webhook: data.result,
      configured: {
        botToken: !!BOT_TOKEN,
        webhookSecret: !!WEBHOOK_SECRET,
        adminChatId: !!process.env.TELEGRAM_ADMIN_CHAT_ID,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'not set',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to check webhook: ${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 500 }
    );
  }
});

/**
 * POST — Register webhook URL or reconfigure bot
 * 
 * Body options:
 *   { "action": "reconfigure" }  — Force re-register commands, menu button, description
 *   { "url": "https://your-domain.com" } — Register webhook URL with Telegram
 *   {} — Auto-detect domain from request headers for webhook
 */
export const POST = withAccount(async (request: NextRequest) => {
  if (!BOT_TOKEN) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_TOKEN not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));

    // ── Action: Reconfigure bot (commands, menu, description) ──
    if (body.action === 'reconfigure') {
      const result = await forceReconfigure();
      return NextResponse.json({
        success: result.commands && result.menuButton,
        message: 'Bot reconfigured (commands, menu button, description)',
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'fallback',
        result,
      });
    }

    // ── Action: Set Webhook URL ──
    let webhookUrl: string;

    if (body.url) {
      webhookUrl = `${body.url}/api/telegram/webhook`;
    } else {
      // Auto-detect from request headers
      const proto = request.headers.get('x-forwarded-proto') ?? 'https';
      const host = request.headers.get('host') ?? '';
      if (!host) {
        return NextResponse.json(
          { error: 'Cannot auto-detect domain. Provide { "url": "https://your-domain.com" }' },
          { status: 400 }
        );
      }
      webhookUrl = `${proto}://${host}/api/telegram/webhook`;
    }

    // Call Telegram setWebhook API
    const params: Record<string, string> = {
      url: webhookUrl,
      max_connections: '40',
      allowed_updates: JSON.stringify(['message', 'callback_query']),
    };

    // Set secret token for webhook verification
    if (WEBHOOK_SECRET) {
      params.secret_token = WEBHOOK_SECRET;
    }

    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }
    );

    const result = await res.json();

    if (result.ok) {
      return NextResponse.json({
        success: true,
        message: 'Webhook registered successfully',
        webhookUrl,
        telegramResponse: result,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.description ?? 'Telegram API error',
          telegramResponse: result,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: `Setup failed: ${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 500 }
    );
  }
});
