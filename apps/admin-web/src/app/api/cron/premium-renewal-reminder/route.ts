// ============================================================
// CRON: PREMIUM RENEWAL REMINDER
// ============================================================
// Sends T-7 / T-3 / T-1 / expired reminder chain for premium subscriptions.
// Reuses reminder_config + reminder_logs so reminders stay idempotent.

import { NextRequest, NextResponse } from "next/server";
import { buildReminderTemplateContext, getReminderConfig, renderReminderTemplate } from "@/lib/bot-manager/reminder-config";
import { listCustomerZaloReminderTargets } from "@/lib/bot-manager/bot-contacts";
import { addDaysToDateKey, formatDateKey } from "@/lib/utils";
import { sendTelegramMessage } from "@/lib/utils/telegram";
import { getDaysRemaining } from "@/lib/utils/premium-accounts-helpers";
import { loadRowsByIds } from "@/lib/supabase/relation-fallback";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendZaloTextMessage } from "@/lib/zalo/outbound";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const MAX_MESSAGES_PER_RUN = 24;

type ReminderTier = "T-7" | "T-3" | "T-1" | "EXPIRED";
type ReminderChannel = "telegram" | "zalo";

type PremiumRenewalRow = {
  id: string;
  account_id: string;
  customer_id: string;
  premium_account_id: string;
  service_type_id: string;
  package_id: string;
  expiry_date: string;
  start_date: string;
  original_price: number | null;
  final_price: number | null;
  renewal_status: string | null;
  status: string;
};

type HydratedPremiumRenewalRow = PremiumRenewalRow & {
  customer_name: string;
  premium_account_email: string | null;
  service_name: string | null;
  package_name: string | null;
};

function getReminderTier(daysUntilExpiry: number, status: string): ReminderTier | null {
  if (status === "expired" || daysUntilExpiry <= 0) return "EXPIRED";
  if (daysUntilExpiry === 1) return "T-1";
  if (daysUntilExpiry === 3) return "T-3";
  if (daysUntilExpiry === 7) return "T-7";
  return null;
}

function isTierEnabled(
  tier: ReminderTier,
  config: Awaited<ReturnType<typeof getReminderConfig>>,
): boolean {
  if (tier === "T-7") return config.t7_enabled;
  if (tier === "T-3") return config.t3_enabled;
  if (tier === "T-1") return config.t1_enabled;
  return true;
}

function shouldSendChannel(
  config: Awaited<ReturnType<typeof getReminderConfig>>,
  channel: ReminderChannel,
): boolean {
  return config.channel === "both" || config.channel === channel;
}

function buildReminderContext(
  subscription: HydratedPremiumRenewalRow,
  daysLeft: number,
) {
  const productName = [
    subscription.service_name,
    subscription.package_name,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" - ") || subscription.premium_account_email || "dịch vụ premium";

  const renewalAmount = Math.max(
    0,
    Math.round(Number(subscription.final_price ?? subscription.original_price ?? 0)),
  );

  return buildReminderTemplateContext({
    customerName: subscription.customer_name,
    productName,
    expiryDate: subscription.expiry_date,
    debtAmountVnd: renewalAmount,
    balanceDueVnd: renewalAmount,
    daysLeft,
    orderCode: subscription.id.slice(0, 8).toUpperCase(),
    status: subscription.status,
  });
}

function buildInternalMessage(
  subscription: HydratedPremiumRenewalRow,
  tier: ReminderTier,
  daysLeft: number,
  config: Awaited<ReturnType<typeof getReminderConfig>>,
): string {
  const context = buildReminderContext(subscription, daysLeft);
  const template = config.template_renewal_internal || config.template_renewal;
  const prefix = tier === "EXPIRED"
    ? "🚨 Gói premium đã hết hạn"
    : `⏰ Nhắc gia hạn ${tier}`;

  return [
    prefix,
    renderReminderTemplate(template, context),
  ].join("\n");
}

function buildCustomerMessage(
  subscription: HydratedPremiumRenewalRow,
  tier: ReminderTier,
  daysLeft: number,
  config: Awaited<ReturnType<typeof getReminderConfig>>,
): string {
  const context = buildReminderContext(subscription, daysLeft);
  const template = tier === "EXPIRED"
    ? config.template_expired_zalo || config.template_renewal_zalo || config.template_renewal
    : config.template_renewal_zalo || config.template_renewal;

  return renderReminderTemplate(template, context);
}

async function wasReminderSentToday(
  subscriptionId: string,
  tier: ReminderTier,
  channel: ReminderChannel,
): Promise<boolean> {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  const reminderType = `premium_renewal:${tier}:${subscriptionId}`;

  const { data } = await supabaseAdmin
    .from("reminder_logs")
    .select("id")
    .eq("reminder_type", reminderType)
    .eq("channel", channel)
    .gte("sent_at", `${dateStr}T00:00:00`)
    .lt("sent_at", `${tomorrowStr}T00:00:00`)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

async function logReminder(
  subscription: HydratedPremiumRenewalRow,
  tier: ReminderTier,
  channel: ReminderChannel,
  status: "sent" | "failed" | "skipped",
  message: string,
  errorMessage?: string,
): Promise<void> {
  try {
    await supabaseAdmin.from("reminder_logs").insert({
      account_id: subscription.account_id,
      order_id: null,
      customer_id: subscription.customer_id,
      reminder_type: `premium_renewal:${tier}:${subscription.id}`,
      channel,
      status,
      message_content: message,
      error_message: errorMessage ?? null,
      sent_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Premium Renewal Reminder] Log insert failed:", error);
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const todayKey = formatDateKey(new Date(), { timeZone: "Asia/Ho_Chi_Minh" });
    const yesterdayKey = addDaysToDateKey(todayKey, -1);
    const maxTargetKey = addDaysToDateKey(todayKey, 7);

    const { data: baseSubscriptions, error } = await supabaseAdmin
      .from("customer_premium_subscriptions")
      .select(`
        id,
        account_id,
        customer_id,
        premium_account_id,
        service_type_id,
        package_id,
        expiry_date,
        start_date,
        original_price,
        final_price,
        renewal_status,
        status
      `)
      .in("status", ["active", "expired"])
      .eq("renewal_status", "none")
      .is("deleted_at", null)
      .gte("expiry_date", `${yesterdayKey}T00:00:00+07:00`)
      .lte("expiry_date", `${maxTargetKey}T23:59:59+07:00`)
      .order("expiry_date", { ascending: true });

    if (error) {
      throw error;
    }

    const sortedSubscriptions = ((baseSubscriptions ?? []) as PremiumRenewalRow[])
      .sort((left, right) => new Date(left.expiry_date).getTime() - new Date(right.expiry_date).getTime());

    const subscriptionsByAccount = new Map<string, PremiumRenewalRow[]>();
    for (const subscription of sortedSubscriptions) {
      const list = subscriptionsByAccount.get(subscription.account_id) ?? [];
      list.push(subscription);
      subscriptionsByAccount.set(subscription.account_id, list);
    }

    const configCache = new Map<string, Awaited<ReturnType<typeof getReminderConfig>>>();
    let sentCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const [accountId, subscriptions] of subscriptionsByAccount.entries()) {
      if (sentCount >= MAX_MESSAGES_PER_RUN) break;

      let config = configCache.get(accountId);
      if (!config) {
        config = await getReminderConfig(accountId);
        configCache.set(accountId, config);
      }

      const customerIds = [...new Set(subscriptions.map((item) => item.customer_id).filter(Boolean))];
      const premiumAccountIds = [...new Set(subscriptions.map((item) => item.premium_account_id).filter(Boolean))];
      const packageIds = [...new Set(subscriptions.map((item) => item.package_id).filter(Boolean))];
      const serviceTypeIds = [...new Set(subscriptions.map((item) => item.service_type_id).filter(Boolean))];

      const [customerMap, premiumAccountMap, packageMap, serviceTypeMap] = await Promise.all([
        loadRowsByIds<{ id: string; full_name: string }>(
          supabaseAdmin,
          "customers",
          accountId,
          customerIds,
          "id, full_name",
        ),
        loadRowsByIds<{ id: string; primary_email: string }>(
          supabaseAdmin,
          "premium_accounts",
          accountId,
          premiumAccountIds,
          "id, primary_email",
        ),
        loadRowsByIds<{ id: string; name: string }>(
          supabaseAdmin,
          "premium_packages",
          accountId,
          packageIds,
          "id, name",
        ),
        loadRowsByIds<{ id: string; name: string }>(
          supabaseAdmin,
          "premium_service_types",
          accountId,
          serviceTypeIds,
          "id, name",
        ),
      ]);

      const hydratedSubscriptions: HydratedPremiumRenewalRow[] = subscriptions.map((subscription) => ({
        ...subscription,
        customer_name: customerMap.get(subscription.customer_id)?.full_name ?? "Khách hàng",
        premium_account_email: premiumAccountMap.get(subscription.premium_account_id)?.primary_email ?? null,
        package_name: packageMap.get(subscription.package_id)?.name ?? null,
        service_name: serviceTypeMap.get(subscription.service_type_id)?.name ?? null,
      }));

      for (const subscription of hydratedSubscriptions) {
        if (sentCount >= MAX_MESSAGES_PER_RUN) break;

        const daysLeft = getDaysRemaining(subscription.expiry_date);
        const tier = getReminderTier(daysLeft, subscription.status);

        if (!tier) {
          skippedCount++;
          continue;
        }

        if (!isTierEnabled(tier, config)) {
          skippedCount++;
          continue;
        }

        const internalMessage = buildInternalMessage(subscription, tier, daysLeft, config);
        const customerMessage = buildCustomerMessage(subscription, tier, daysLeft, config);

        if (shouldSendChannel(config, "telegram")) {
          const alreadySent = await wasReminderSentToday(subscription.id, tier, "telegram");
          if (!alreadySent && sentCount < MAX_MESSAGES_PER_RUN) {
            const sent = await sendTelegramMessage(internalMessage);
            await logReminder(
              subscription,
              tier,
              "telegram",
              sent !== false ? "sent" : "failed",
              internalMessage,
              sent !== false ? undefined : "Telegram send failed",
            );

            if (sent !== false) {
              sentCount++;
            } else {
              errors.push(`telegram:${subscription.id}`);
            }
          } else {
            skippedCount++;
          }
        }

        const canSendZalo = config.auto_send && shouldSendChannel(config, "zalo") && sentCount < MAX_MESSAGES_PER_RUN;
        if (canSendZalo) {
          const alreadySent = await wasReminderSentToday(subscription.id, tier, "zalo");
          if (!alreadySent) {
            const targets = await listCustomerZaloReminderTargets(subscription.account_id, subscription.customer_id);
            const target = targets[0];

            if (target?.chatId) {
              const sent = await sendZaloTextMessage(target.chatId, customerMessage);
              await logReminder(
                subscription,
                tier,
                "zalo",
                sent ? "sent" : "failed",
                customerMessage,
                sent ? undefined : "Zalo send failed",
              );

              if (sent) {
                sentCount++;
              } else {
                errors.push(`zalo:${subscription.id}`);
              }
            } else {
              skippedCount++;
            }
          } else {
            skippedCount++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
      skippedCount,
      totalSubscriptions: sortedSubscriptions.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Cron] Premium renewal reminder error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
