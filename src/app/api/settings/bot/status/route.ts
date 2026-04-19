import { withAccount } from "@/lib/api/with-account";
import { createSuccessResponse, withErrorHandler } from "@/lib/api/with-error-handler";
import type { BotManagerStatus } from "@/lib/domain/types";
import { resolveTelegramBotAccount } from "@/lib/bot-manager/runtime-account";
import { buildBotOperationalSummary } from "@/lib/bot-manager/status";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveZaloRuntimeConfig } from "@/lib/zalo/config";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (_request, { accountId }) => {
    const zaloConfig = resolveZaloRuntimeConfig(process.env);
    const telegramAccount = await resolveTelegramBotAccount();

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
      },
      zalo: {
        tokenConfigured: Boolean(process.env.ZALO_BOT_TOKEN),
        accountBound: zaloConfig.accountBound,
        adminConfigured: zaloConfig.adminUserIds.length > 0,
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
          webhookSecretConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
          accountConfigured: Boolean(telegramAccount.accountId),
          accountMatchesCurrentTenant:
            !telegramAccount.accountId || telegramAccount.accountId === accountId,
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
