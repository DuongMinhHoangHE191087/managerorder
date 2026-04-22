// ============================================================
// TELEGRAM WEBHOOK SETUP - Register/check webhook with Telegram API
// ============================================================
// Usage:
//   GET  /api/telegram/setup - Check current webhook status
//   POST /api/telegram/setup - Register webhook URL with Telegram
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";
import { forceReconfigure } from "@/lib/services/telegram-auto-setup";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";

type TelegramSetupBody = {
  action?: string;
  url?: string;
};

function resolveConfiguredSiteUrl(fallback = "not set"): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || fallback
  );
}

function buildWebhookUrl(
  request: NextRequest,
  requestedUrl?: string,
): string | NextResponse {
  const rawRequestedUrl = requestedUrl?.trim();

  if (rawRequestedUrl) {
    let parsed: URL;
    try {
      parsed = new URL(rawRequestedUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid url. Expected an absolute http(s) URL." },
        { status: 400 },
      );
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json(
        { error: "Invalid url protocol. Expected http or https." },
        { status: 400 },
      );
    }

    return `${parsed.origin}/api/telegram/webhook`;
  }

  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? "";

  if (!host) {
    return NextResponse.json(
      { error: 'Cannot auto-detect domain. Provide { "url": "https://your-domain.com" }' },
      { status: 400 },
    );
  }

  return `${proto}://${host}/api/telegram/webhook`;
}

/**
 * GET - Check current webhook info from Telegram.
 */
export const GET = withErrorHandler(
  withAccount(
    requirePermissions(["settings:read"])(async () => {
      if (!BOT_TOKEN) {
        return NextResponse.json(
          { error: "TELEGRAM_BOT_TOKEN not configured" },
          { status: 503 },
        );
      }

      try {
        const res = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`,
        );
        const data = (await res.json()) as {
          ok?: boolean;
          result?: unknown;
        };

        return NextResponse.json({
          ok: Boolean(data.ok),
          webhook: data.result ?? null,
          configured: {
            botToken: Boolean(BOT_TOKEN),
            webhookSecret: Boolean(WEBHOOK_SECRET),
            adminChatId: Boolean(process.env.TELEGRAM_ADMIN_CHAT_ID),
            siteUrl: resolveConfiguredSiteUrl(),
          },
        });
      } catch (error) {
        return NextResponse.json(
          {
            error: `Failed to check webhook: ${error instanceof Error ? error.message : "Unknown"}`,
          },
          { status: 500 },
        );
      }
    }),
  ),
);

/**
 * POST - Register webhook URL or reconfigure bot.
 *
 * Body options:
 *   { "action": "reconfigure" } - Force re-register commands, menu button, description
 *   { "url": "https://your-domain.com" } - Register webhook URL with Telegram
 *   {} - Auto-detect domain from request headers for webhook
 */
export const POST = withErrorHandler(
  withAccount(
    requirePermissions(["settings:write"])(async (request: NextRequest) => {
      if (!BOT_TOKEN) {
        return NextResponse.json(
          { error: "TELEGRAM_BOT_TOKEN not configured" },
          { status: 503 },
        );
      }

      try {
        const body = (await request.json().catch(() => ({}))) as TelegramSetupBody;

        if (body.action === "reconfigure") {
          const result = await forceReconfigure();
          return NextResponse.json({
            success: Boolean(result.commands && result.menuButton),
            message: "Bot reconfigured (commands, menu button, description)",
            siteUrl: resolveConfiguredSiteUrl("fallback"),
            result,
          });
        }

        const webhookUrl = buildWebhookUrl(request, body.url);
        if (webhookUrl instanceof NextResponse) {
          return webhookUrl;
        }

        const params: Record<string, string> = {
          url: webhookUrl,
          max_connections: "40",
          allowed_updates: JSON.stringify(["message", "callback_query"]),
        };

        if (WEBHOOK_SECRET) {
          params.secret_token = WEBHOOK_SECRET;
        }

        const res = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
          },
        );

        const result = (await res.json()) as {
          ok?: boolean;
          description?: string;
        };

        if (result.ok) {
          return NextResponse.json({
            success: true,
            message: "Webhook registered successfully",
            webhookUrl,
            telegramResponse: result,
          });
        }

        return NextResponse.json(
          {
            success: false,
            error: result.description ?? "Telegram API error",
            telegramResponse: result,
          },
          { status: 400 },
        );
      } catch (error) {
        return NextResponse.json(
          { error: `Setup failed: ${error instanceof Error ? error.message : "Unknown"}` },
          { status: 500 },
        );
      }
    }),
  ),
);
