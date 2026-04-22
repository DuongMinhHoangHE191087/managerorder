import { NextRequest, NextResponse } from "next/server";
import { buildReminderTemplateContext, getReminderConfig, renderReminderTemplate } from "@/lib/bot-manager/reminder-config";
import { listCustomerZaloReminderTargets } from "@/lib/bot-manager/bot-contacts";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadRowsByIds } from "@/lib/supabase/relation-fallback";
import { addDaysToDateKey, formatDateKey } from "@/lib/utils";
import { sendTelegramMessage } from "@/lib/utils/telegram";
import { sendZaloTextMessage } from "@/lib/zalo/outbound";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const MAX_MESSAGES_PER_RUN = 24;

type ReminderTier = "T-7" | "T-3" | "T-1" | "EXPIRED";
type ReminderChannel = "telegram" | "zalo";

interface ExpiringOrder {
  id: string;
  order_code: string;
  account_id: string;
  customer_id: string;
  customer_name: string;
  product_name_snapshot: string | null;
  total_amount_vnd: number;
  total_paid: number;
  expires_at: string;
  status: string;
}

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
  return (
    config.channel === "both" ||
    config.channel === channel
  );
}

function buildInternalReminderMessage(order: ExpiringOrder, tier: ReminderTier, daysLeft: number) {
  const context = buildReminderTemplateContext({
    customerName: order.customer_name,
    productName: order.product_name_snapshot,
    expiryDate: order.expires_at,
    debtAmountVnd: Math.max(order.total_amount_vnd - order.total_paid, 0),
    balanceDueVnd: Math.max(order.total_amount_vnd - order.total_paid, 0),
    daysLeft,
    orderCode: order.order_code,
    status: order.status,
  });

  const prefix =
    tier === "EXPIRED"
      ? "🚨 Đơn đã hết hạn"
      : `⏰ Nhắc hạn ${tier}`;

  return [
    `${prefix}`,
    renderReminderTemplate(
      "Đơn {order_code}\nKhách hàng: {customer_name}\nSản phẩm: {product_name}\nHết hạn: {expiry_date}\nCòn nợ: {balance_due}\nTrạng thái: {order_status}",
      context,
    ),
  ].join("\n");
}

function getMessageTemplate(
  config: Awaited<ReturnType<typeof getReminderConfig>>,
  channel: ReminderChannel,
  tier: ReminderTier,
): string {
  if (channel === "telegram") {
    return config.template_renewal_internal || config.template_renewal;
  }

  if (tier === "EXPIRED") {
    return config.template_expired_zalo || config.template_renewal_zalo;
  }

  return config.template_renewal_zalo || config.template_renewal;
}

async function wasReminderSentToday(orderId: string, tier: ReminderTier, channel: ReminderChannel): Promise<boolean> {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  const { data } = await supabaseAdmin
    .from("reminder_logs")
    .select("id")
    .eq("order_id", orderId)
    .eq("reminder_type", tier)
    .eq("channel", channel)
    .gte("sent_at", `${dateStr}T00:00:00`)
    .lt("sent_at", `${tomorrowStr}T00:00:00`)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

async function logReminder(
  order: ExpiringOrder,
  tier: ReminderTier,
  channel: ReminderChannel,
  status: "sent" | "failed" | "skipped",
  message: string,
  errorMessage?: string,
): Promise<void> {
  try {
    await supabaseAdmin.from("reminder_logs").insert({
      account_id: order.account_id,
      order_id: order.id,
      customer_id: order.customer_id,
      reminder_type: tier,
      channel,
      status,
      message_content: message,
      error_message: errorMessage ?? null,
      sent_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Reminder Log] Insert failed:", error);
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

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select(`
        id,
        order_code,
        account_id,
        customer_id,
        product_name_snapshot,
        total_amount_vnd,
        total_paid,
        expires_at,
        status
      `)
      .in("status", ["active", "expired"])
      .is("deleted_at", null)
      .gte("expires_at", `${yesterdayKey}T00:00:00+07:00`)
      .lte("expires_at", `${maxTargetKey}T23:59:59+07:00`);

    if (error) throw error;

    const customerIds = [...new Set((orders ?? []).map((order) => order.customer_id).filter(Boolean))];
    const customerMap = await loadRowsByIds<{ id: string; full_name: string }>(
      supabaseAdmin,
      "customers",
      null,
      customerIds,
      "id, full_name",
    );

    const configCache = new Map<string, Awaited<ReturnType<typeof getReminderConfig>>>();
    let sentCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const raw of orders ?? []) {
      if (sentCount >= MAX_MESSAGES_PER_RUN) break;

      const order: ExpiringOrder = {
        id: raw.id,
        order_code: raw.order_code ?? `ORD-${raw.id.slice(0, 8)}`,
        account_id: raw.account_id,
        customer_id: raw.customer_id,
        customer_name: customerMap.get(raw.customer_id)?.full_name ?? "Khách hàng",
        product_name_snapshot: raw.product_name_snapshot,
        total_amount_vnd: Number(raw.total_amount_vnd ?? 0),
        total_paid: Number(raw.total_paid ?? 0),
        expires_at: raw.expires_at,
        status: raw.status,
      };

      const expiresKey = formatDateKey(order.expires_at, { timeZone: "Asia/Ho_Chi_Minh" });
      const diffMs = Date.parse(`${expiresKey}T00:00:00+07:00`) - Date.parse(`${todayKey}T00:00:00+07:00`);
      const daysLeft = Math.ceil(diffMs / 86_400_000);
      const tier = getReminderTier(daysLeft, order.status);

      if (!tier) {
        skippedCount++;
        continue;
      }

      let config = configCache.get(order.account_id);
      if (!config) {
        config = await getReminderConfig(order.account_id);
        configCache.set(order.account_id, config);
      }

      if (!isTierEnabled(tier, config)) {
        skippedCount++;
        continue;
      }

      const context = buildReminderTemplateContext({
        customerName: order.customer_name,
        productName: order.product_name_snapshot,
        expiryDate: order.expires_at,
        debtAmountVnd: Math.max(order.total_amount_vnd - order.total_paid, 0),
        balanceDueVnd: Math.max(order.total_amount_vnd - order.total_paid, 0),
        daysLeft,
        orderCode: order.order_code,
        status: order.status,
      });

      if (shouldSendChannel(config, "telegram")) {
        const alreadySent = await wasReminderSentToday(order.id, tier, "telegram");
        if (!alreadySent && sentCount < MAX_MESSAGES_PER_RUN) {
          const message = renderReminderTemplate(getMessageTemplate(config, "telegram", tier), context)
            || buildInternalReminderMessage(order, tier, daysLeft);
          const sent = await sendTelegramMessage(message);
          await logReminder(order, tier, "telegram", sent ? "sent" : "failed", message, sent ? undefined : "Telegram send failed");
          if (sent) sentCount++;
          else errors.push(`telegram:${order.order_code}`);
        } else {
          skippedCount++;
        }
      }

      const canSendZalo = config.auto_send && shouldSendChannel(config, "zalo") && sentCount < MAX_MESSAGES_PER_RUN;
      if (canSendZalo) {
        const alreadySent = await wasReminderSentToday(order.id, tier, "zalo");
        if (!alreadySent) {
          const targets = await listCustomerZaloReminderTargets(order.account_id, order.customer_id);
          const target = targets[0];

          if (target?.chatId) {
            const message = renderReminderTemplate(getMessageTemplate(config, "zalo", tier), context);
            const sent = await sendZaloTextMessage(target.chatId, message);
            await logReminder(order, tier, "zalo", sent ? "sent" : "failed", message, sent ? undefined : "Zalo send failed");
            if (sent) sentCount++;
            else errors.push(`zalo:${order.order_code}`);
          } else {
            skippedCount++;
          }
        } else {
          skippedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
      skippedCount,
      totalOrders: orders?.length ?? 0,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Cron] Order expiry reminder error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
