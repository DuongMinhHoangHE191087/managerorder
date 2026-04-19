// ============================================================
// ESCALATION SERVICE — Auto-Escalation Engine
// ============================================================
// Evaluates configurable escalation rules against overdue orders.
// Actions: reminder → warning → lock_service → notify_admin
// Idempotent: uses reminder_logs to prevent duplicate actions.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTelegramMessage, escapeHtml, formatVnd } from "@/lib/utils/telegram";

// ─── Types ────────────────────────────────────────────────────

export interface EscalationRule {
  id: string;
  account_id: string;
  name: string;
  trigger_type: 'overdue_days' | 'debt_amount' | 'no_payment';
  threshold_value: number;
  action_type: 'reminder' | 'warning' | 'lock_service' | 'notify_admin';
  action_config: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
}

export interface OrderForEscalation {
  id: string;
  order_code: string;
  account_id: string;
  customer_id: string;
  customer_name: string;
  status: string;
  total_amount_vnd: number;
  total_paid: number;
  expires_at: string;
  created_at: string;
}

export interface EscalationAction {
  rule: EscalationRule;
  order: OrderForEscalation;
  overdueDays: number;
  debtAmount: number;
}

export interface EscalationResult {
  processedOrders: number;
  actionsExecuted: number;
  errors: string[];
}

// ─── Rule Evaluation ──────────────────────────────────────────

/**
 * Evaluate which escalation rules match for a given order.
 * Rules are applied in sort_order (lightest first).
 */
export function evaluateEscalationRules(
  order: OrderForEscalation,
  rules: EscalationRule[]
): EscalationAction[] {
  const now = new Date();
  const expiresAt = new Date(order.expires_at);
  const overdueDays = Math.max(0, Math.floor((now.getTime() - expiresAt.getTime()) / (1000 * 60 * 60 * 24)));
  const debtAmount = Math.max(0, order.total_amount_vnd - order.total_paid);

  const activeRules = rules
    .filter(r => r.is_active && r.account_id === order.account_id)
    .sort((a, b) => a.sort_order - b.sort_order);

  const matchedActions: EscalationAction[] = [];

  for (const rule of activeRules) {
    let triggered = false;

    switch (rule.trigger_type) {
      case 'overdue_days':
        triggered = overdueDays >= rule.threshold_value;
        break;
      case 'debt_amount':
        triggered = debtAmount >= rule.threshold_value;
        break;
      case 'no_payment':
        triggered = order.total_paid === 0 && overdueDays >= rule.threshold_value;
        break;
    }

    if (triggered) {
      matchedActions.push({ rule, order, overdueDays, debtAmount });
    }
  }

  return matchedActions;
}

// ─── Action Execution ─────────────────────────────────────────

/**
 * Check if this escalation action was already executed today.
 */
async function wasAlreadyExecutedToday(
  orderId: string,
  reminderType: string
): Promise<boolean> {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  const { data } = await supabaseAdmin
    .from('reminder_logs')
    .select('id')
    .eq('order_id', orderId)
    .eq('reminder_type', reminderType)
    .gte('sent_at', `${dateStr}T00:00:00`)
    .lt('sent_at', `${tomorrowStr}T00:00:00`)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

/**
 * Log a reminder/escalation action to the reminder_logs table.
 */
async function logReminderAction(
  action: EscalationAction,
  reminderType: string,
  status: 'sent' | 'failed',
  messageContent: string,
  errorMessage?: string
): Promise<void> {
  await supabaseAdmin.from('reminder_logs').insert({
    account_id: action.order.account_id,
    order_id: action.order.id,
    customer_id: action.order.customer_id,
    reminder_type: reminderType,
    channel: 'telegram',
    status,
    message_content: messageContent,
    error_message: errorMessage ?? null,
  });
}

/**
 * Execute a single escalation action.
 */
export async function executeEscalationAction(action: EscalationAction): Promise<boolean> {
  const { rule, order, overdueDays, debtAmount } = action;
  const reminderType = `escalation_${rule.action_type}`;

  // Idempotency check
  const alreadyDone = await wasAlreadyExecutedToday(order.id, reminderType);
  if (alreadyDone) return false;

  let message = '';
  let success = false;

  switch (rule.action_type) {
    case 'reminder': {
      message = [
        `📝 <b>NHẮC NHỞ THU TIỀN</b>`,
        `━━━━━━━━━━━━━━━━━━━`,
        `📦 Đơn: <b>${escapeHtml(order.order_code)}</b>`,
        `👤 KH: ${escapeHtml(order.customer_name)}`,
        `💰 Còn nợ: <b>${formatVnd(debtAmount)}</b>`,
        `⏰ Quá hạn: <b>${overdueDays} ngày</b>`,
        `━━━━━━━━━━━━━━━━━━━`,
        `<i>Rule: ${escapeHtml(rule.name)}</i>`,
      ].join('\n');
      success = (await sendTelegramMessage(message)) !== false;
      break;
    }

    case 'warning': {
      message = [
        `⚠️ <b>CẢNH BÁO CÔNG NỢ</b>`,
        `━━━━━━━━━━━━━━━━━━━`,
        `📦 Đơn: <b>${escapeHtml(order.order_code)}</b>`,
        `👤 KH: ${escapeHtml(order.customer_name)}`,
        `💰 Còn nợ: <b>${formatVnd(debtAmount)}</b>`,
        `⏰ Quá hạn: <b>${overdueDays} ngày</b>`,
        `🔴 Cần xử lý NGAY!`,
        `━━━━━━━━━━━━━━━━━━━`,
        `<i>Rule: ${escapeHtml(rule.name)}</i>`,
      ].join('\n');
      success = (await sendTelegramMessage(message)) !== false;
      break;
    }

    case 'lock_service': {
      // Update order status to 'expired' (soft lock)
      const { error } = await supabaseAdmin
        .from('orders')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', order.id)
        .eq('status', 'active'); // Only lock active orders

      if (error) {
        await logReminderAction(action, reminderType, 'failed', '', error.message);
        return false;
      }

      message = [
        `🔒 <b>DỊCH VỤ ĐÃ BỊ KHÓA</b>`,
        `━━━━━━━━━━━━━━━━━━━`,
        `📦 Đơn: <b>${escapeHtml(order.order_code)}</b>`,
        `👤 KH: ${escapeHtml(order.customer_name)}`,
        `💰 Còn nợ: <b>${formatVnd(debtAmount)}</b>`,
        `⏰ Quá hạn: <b>${overdueDays} ngày</b>`,
        `❌ Dịch vụ đã bị tạm ngưng do quá hạn thanh toán`,
        `━━━━━━━━━━━━━━━━━━━`,
        `<i>Rule: ${escapeHtml(rule.name)}</i>`,
      ].join('\n');
      success = (await sendTelegramMessage(message)) !== false;
      break;
    }

    case 'notify_admin': {
      message = [
        `🚨 <b>THÔNG BÁO ADMIN</b>`,
        `━━━━━━━━━━━━━━━━━━━`,
        `📦 Đơn: <b>${escapeHtml(order.order_code)}</b>`,
        `👤 KH: ${escapeHtml(order.customer_name)}`,
        `💰 Còn nợ: <b>${formatVnd(debtAmount)}</b>`,
        `⏰ Quá hạn: <b>${overdueDays} ngày</b>`,
        `📋 Cần can thiệp thủ công`,
        `━━━━━━━━━━━━━━━━━━━`,
        `<i>Rule: ${escapeHtml(rule.name)}</i>`,
      ].join('\n');
      success = (await sendTelegramMessage(message)) !== false;
      break;
    }
  }

  await logReminderAction(
    action,
    reminderType,
    success ? 'sent' : 'failed',
    message,
    success ? undefined : 'Telegram send failed'
  );

  return success;
}

// ─── Batch Processing ─────────────────────────────────────────

/**
 * Process all overdue orders against escalation rules.
 * Called by the auto-escalation cron job.
 */
export async function processAllEscalations(accountId?: string): Promise<EscalationResult> {
  const result: EscalationResult = {
    processedOrders: 0,
    actionsExecuted: 0,
    errors: [],
  };

  try {
    // Fetch active escalation rules
    let rulesQuery = supabaseAdmin
      .from('escalation_rules')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (accountId) {
      rulesQuery = rulesQuery.eq('account_id', accountId);
    }

    const { data: rules, error: rulesErr } = await rulesQuery;
    if (rulesErr) throw rulesErr;
    if (!rules || rules.length === 0) return result;

    // Fetch overdue orders (expired or active past expiry)
    const now = new Date().toISOString();
    let ordersQuery = supabaseAdmin
      .from('orders')
      .select(`
        id, order_code, account_id, customer_id, status,
        total_amount_vnd, total_paid, expires_at, created_at
      `)
      .in('status', ['active', 'pending_payment'])
      .lt('expires_at', now)
      .limit(100); // Safety limit

    if (accountId) {
      ordersQuery = ordersQuery.eq('account_id', accountId);
    }

    const { data: orders, error: ordersErr } = await ordersQuery;
    if (ordersErr) throw ordersErr;
    if (!orders || orders.length === 0) return result;

    const customerIds = [...new Set(orders.map((order) => order.customer_id).filter(Boolean))];
    const customerQuery = supabaseAdmin
      .from('customers')
      .select('id, full_name')
      .in('id', customerIds);
    if (accountId) {
      customerQuery.eq('account_id', accountId);
    }

    const { data: customers, error: customersErr } = await customerQuery;
    if (customersErr) throw customersErr;
    const customerMap = new Map((customers ?? []).map((row) => [row.id, row.full_name] as const));

    // Process each order
    for (const raw of orders) {
      result.processedOrders++;

      const order: OrderForEscalation = {
        id: raw.id,
        order_code: raw.order_code ?? `ORD-${raw.id.slice(0, 8)}`,
        account_id: raw.account_id,
        customer_id: raw.customer_id,
        customer_name: customerMap.get(raw.customer_id) ?? 'N/A',
        status: raw.status,
        total_amount_vnd: Number(raw.total_amount_vnd ?? 0),
        total_paid: Number(raw.total_paid ?? 0),
        expires_at: raw.expires_at,
        created_at: raw.created_at,
      };

      try {
        const actions = evaluateEscalationRules(order, rules as EscalationRule[]);

        for (const action of actions) {
          const executed = await executeEscalationAction(action);
          if (executed) result.actionsExecuted++;
        }
      } catch (err) {
        const msg = `Order ${order.order_code}: ${err instanceof Error ? err.message : String(err)}`;
        result.errors.push(msg);
        console.error('[Escalation]', msg);
      }
    }
  } catch (err) {
    const msg = `Fatal: ${err instanceof Error ? err.message : String(err)}`;
    result.errors.push(msg);
    console.error('[Escalation]', msg);
  }

  return result;
}
