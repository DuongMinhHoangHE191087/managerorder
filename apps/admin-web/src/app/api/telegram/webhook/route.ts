// ============================================================
// TELEGRAM WEBHOOK - Receives updates from Telegram Bot API
// ============================================================
// SECURITY LAYER 1: Webhook Secret Token
//   Telegram sends this header with every request if configured.
//   Requests without valid secret are instantly rejected.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  markBotRuntimeError,
  markBotRuntimeHeartbeat,
  markBotRuntimeInbound,
} from "@/lib/bot-manager/runtime-health";
import { resolveTelegramBotAccount } from "@/lib/bot-manager/runtime-account";
import { bot } from "@/integrations/telegram";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
const DEDUP_TTL_MS = 10 * 60 * 1000;
const processedUpdateIds = new Map<number, number>();

function cleanupProcessedUpdates(now: number): void {
  for (const [updateId, ts] of processedUpdateIds.entries()) {
    if (now - ts > DEDUP_TTL_MS) {
      processedUpdateIds.delete(updateId);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!WEBHOOK_SECRET) {
      console.error("[Webhook] TELEGRAM_WEBHOOK_SECRET not configured. Rejecting all requests.");
      return NextResponse.json({ error: "Bot not configured" }, { status: 503 });
    }

    const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
    if (secretHeader !== WEBHOOK_SECRET) {
      const ip =
        request.headers.get("x-forwarded-for")
        ?? request.headers.get("x-real-ip")
        ?? "unknown";
      console.warn(`[Webhook] Invalid secret token from IP: ${ip}`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const updateId = typeof body.update_id === "number" ? body.update_id : null;
    const now = Date.now();

    cleanupProcessedUpdates(now);
    if (updateId !== null && processedUpdateIds.has(updateId)) {
      console.log(`[Webhook] Skip duplicate update_id=${updateId}`);
      return NextResponse.json({ ok: true, duplicate: true });
    }
    if (updateId !== null) {
      processedUpdateIds.set(updateId, now);
    }

    const updateType = body.message
      ? "message"
      : body.callback_query
        ? "callback_query"
        : "other";
    const chatId =
      body.message?.chat?.id
      ?? body.callback_query?.message?.chat?.id
      ?? "unknown";

    console.log(`[Webhook] <- ${updateType} from chat ${chatId}`);
    await markBotRuntimeHeartbeat("telegram", {
      transport: "webhook",
      configuredMode: "webhook",
      metadata: {
        route: "api/telegram/webhook",
        updateType,
        chatId,
      },
    });
    await markBotRuntimeInbound("telegram", {
      updateId,
      updateType,
      chatId,
    });

    try {
      await bot.processUpdate(body);
      console.log(`[Webhook] processed ${updateType} for chat ${chatId}`);
    } catch (err) {
      console.error(`[Webhook] bot processUpdate error for chat ${chatId}:`, err);
      await markBotRuntimeError("telegram", err, {
        route: "api/telegram/webhook",
        updateType,
        chatId,
        updateId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Webhook] Parse error:", error);
    await markBotRuntimeError("telegram", error, {
      route: "api/telegram/webhook",
      stage: "parse",
    });
    return NextResponse.json({ ok: true });
  }
}

export const GET = withErrorHandler(
  withAccount(
    requirePermissions(["settings:read"])(async () => {
      const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
      const adminChatId =
        process.env.TELEGRAM_ADMIN_CHAT_ID
        ?? process.env.TELEGRAM_CHAT_ID
        ?? "";
      const botAccount = await resolveTelegramBotAccount();

      const diagnostics: Record<string, unknown> = {
        botTokenConfigured: Boolean(botToken),
        webhookSecretConfigured: Boolean(WEBHOOK_SECRET),
        adminChatIdConfigured: Boolean(adminChatId),
        botAccountConfigured: Boolean(botAccount.accountId),
        botAccountSource: botAccount.source,
        botAccountWarnings: botAccount.warnings,
      };

      if (botToken) {
        try {
          const [botMeRes, webhookRes] = await Promise.all([
            fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
              signal: AbortSignal.timeout(5000),
            }),
            fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`, {
              signal: AbortSignal.timeout(5000),
            }),
          ]);
          const data = await botMeRes.json();
          const webhookData = await webhookRes.json();
          diagnostics.botApiOk = data.ok;
          diagnostics.botName = data.result?.first_name;
          diagnostics.botUsername = data.result?.username;
          diagnostics.webhookInfo = webhookData.result ?? null;
        } catch (error) {
          diagnostics.botApiOk = false;
          diagnostics.botApiError =
            error instanceof Error ? error.message : "Unknown";
        }
      }

      return NextResponse.json({
        status: "ok",
        bot: "ManagerOrder Bot v5.1",
        diagnostics,
        setup: {
          alreadyConfigured: false,
          commands: null,
          menuButton: null,
          description: null,
          webhookInfo: "read-only",
          errors: [],
        },
      });
    }),
  ),
);
