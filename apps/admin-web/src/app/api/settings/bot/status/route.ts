import { withAccount } from "@/lib/api/with-account";
import { createSuccessResponse, withErrorHandler } from "@/lib/api/with-error-handler";
import {
  getBotRuntimeSnapshot,
  isPollingRuntimeHealthy,
} from "@/lib/bot-manager/runtime-health";
import {
  resolveTelegramRuntimeMode,
  resolveZaloRuntimeMode,
} from "@/lib/bot-manager/runtime-mode";
import type { BotManagerStatus } from "@/lib/domain/types";
import { resolveTelegramBotAccount } from "@/lib/bot-manager/runtime-account";
import { buildBotOperationalSummary } from "@/lib/bot-manager/status";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveZaloRuntimeConfig } from "@/lib/zalo/config";

export const dynamic = "force-dynamic";

type TelegramWebhookDiagnostics = {
  url: string | null;
  pendingUpdateCount: number | null;
};

async function fetchTelegramWebhookDiagnostics(): Promise<TelegramWebhookDiagnostics> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    return { url: null, pendingUpdateCount: null };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`,
      { signal: AbortSignal.timeout(5000) },
    );
    const payload = await response.json();
    return {
      url: payload?.result?.url ? String(payload.result.url) : null,
      pendingUpdateCount:
        typeof payload?.result?.pending_update_count === "number"
          ? payload.result.pending_update_count
          : null,
    };
  } catch {
    return { url: null, pendingUpdateCount: null };
  }
}

function resolveTelegramActualTransport(input: {
  configuredMode: "webhook" | "polling" | "disabled";
  pollingHealthy: boolean;
  webhookUrl: string | null;
}) {
  if (input.pollingHealthy) {
    return { actualTransport: "polling" as const, healthy: true };
  }

  if (input.webhookUrl) {
    return { actualTransport: "webhook" as const, healthy: true };
  }

  if (input.configuredMode === "polling") {
    return { actualTransport: "polling" as const, healthy: false };
  }

  if (input.configuredMode === "webhook") {
    return { actualTransport: "webhook" as const, healthy: false };
  }

  return { actualTransport: "inactive" as const, healthy: false };
}

function resolveZaloActualTransport(input: {
  configuredMode: "polling" | "disabled";
  pollingHealthy: boolean;
}) {
  if (input.configuredMode === "polling") {
    return { actualTransport: "polling" as const, healthy: input.pollingHealthy };
  }

  return { actualTransport: "inactive" as const, healthy: false };
}

function toOperationalRuntimeMode(
  transport: "webhook" | "polling" | "inactive",
): "webhook-first" | "polling-fallback" | "inactive" {
  switch (transport) {
    case "webhook":
      return "webhook-first";
    case "polling":
      return "polling-fallback";
    default:
      return "inactive";
  }
}

export const GET = withErrorHandler(
  withAccount(async (_request, { accountId }) => {
    const zaloConfig = resolveZaloRuntimeConfig(process.env);
    const telegramConfiguredMode = resolveTelegramRuntimeMode(process.env);
    const zaloConfiguredMode = resolveZaloRuntimeMode(process.env);
    const [telegramAccount, telegramRuntime, zaloRuntime, webhookDiagnostics] = await Promise.all([
      resolveTelegramBotAccount(),
      getBotRuntimeSnapshot("telegram"),
      getBotRuntimeSnapshot("zalo"),
      fetchTelegramWebhookDiagnostics(),
    ]);
    const telegramResolvedRuntime = resolveTelegramActualTransport({
      configuredMode: telegramConfiguredMode,
      pollingHealthy:
        telegramRuntime?.transport === "polling" &&
        isPollingRuntimeHealthy(telegramRuntime),
      webhookUrl: webhookDiagnostics.url,
    });
    const zaloResolvedRuntime = resolveZaloActualTransport({
      configuredMode: zaloConfiguredMode,
      pollingHealthy:
        zaloRuntime?.transport === "polling" && isPollingRuntimeHealthy(zaloRuntime),
    });

    const [total, zalo, telegram, matched, autoReminderEnabled] = await Promise.all([
      supabaseAdmin
        .from("bot_user_contacts")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId),
      supabaseAdmin
        .from("bot_user_contacts")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .eq("channel", "zalo"),
      supabaseAdmin
        .from("bot_user_contacts")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .eq("channel", "telegram"),
      supabaseAdmin
        .from("bot_user_contacts")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .not("customer_id", "is", null),
      supabaseAdmin
        .from("bot_user_contacts")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .eq("auto_reminder_enabled", true),
    ]);

    const status: BotManagerStatus = {
      telegram: {
        tokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        adminChatConfigured: Boolean(process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID),
        webhookSecretConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
        accountConfigured: Boolean(telegramAccount.accountId),
        accountMatchesCurrentTenant:
          !telegramAccount.accountId || telegramAccount.accountId === accountId,
        accountResolutionSource: telegramAccount.source === "unresolved" ? null : telegramAccount.source,
        warnings: telegramAccount.warnings,
        runtime: {
          configuredMode: telegramConfiguredMode,
          actualTransport: telegramResolvedRuntime.actualTransport,
          healthy: telegramResolvedRuntime.healthy,
          webhookUrl: webhookDiagnostics.url,
          pendingUpdateCount: webhookDiagnostics.pendingUpdateCount,
          lastHeartbeatAt: telegramRuntime?.lastHeartbeatAt ?? null,
          lastInboundAt: telegramRuntime?.lastInboundAt ?? null,
          lastReplyAt: telegramRuntime?.lastReplyAt ?? null,
          lastErrorAt: telegramRuntime?.lastErrorAt ?? null,
          lastErrorMessage: telegramRuntime?.lastErrorMessage ?? null,
        },
      },
      zalo: {
        tokenConfigured: Boolean(process.env.ZALO_BOT_TOKEN),
        accountBound: zaloConfig.accountBound,
        adminConfigured: zaloConfig.adminUserIds.length > 0,
        runtime: {
          configuredMode: zaloConfiguredMode,
          actualTransport: zaloResolvedRuntime.actualTransport,
          healthy: zaloResolvedRuntime.healthy,
          lastHeartbeatAt: zaloRuntime?.lastHeartbeatAt ?? null,
          lastInboundAt: zaloRuntime?.lastInboundAt ?? null,
          lastReplyAt: zaloRuntime?.lastReplyAt ?? null,
          lastErrorAt: zaloRuntime?.lastErrorAt ?? null,
          lastErrorMessage: zaloRuntime?.lastErrorMessage ?? null,
        },
      },
      contacts: {
        total: total.count ?? 0,
        zalo: zalo.count ?? 0,
        telegram: telegram.count ?? 0,
        matched: matched.count ?? 0,
        autoReminderEnabled: autoReminderEnabled.count ?? 0,
      },
      operational: buildBotOperationalSummary({
        telegram: {
          tokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
          adminChatConfigured: Boolean(process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID),
          accountConfigured: Boolean(telegramAccount.accountId),
          accountMatchesCurrentTenant:
            !telegramAccount.accountId || telegramAccount.accountId === accountId,
          runtimeMode: toOperationalRuntimeMode(telegramResolvedRuntime.actualTransport),
          runtimeHealthy: telegramResolvedRuntime.healthy,
        },
        contacts: {
          total: total.count ?? 0,
          matched: matched.count ?? 0,
          autoReminderEnabled: autoReminderEnabled.count ?? 0,
        },
      }),
    };

    return createSuccessResponse(status);
  }),
);
