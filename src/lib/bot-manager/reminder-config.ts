import type { ReminderConfig } from "@/lib/domain/types";
import type { Database } from "@/lib/supabase/database.types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatDateShort, formatNumber } from "@/lib/utils";

type ReminderConfigRow = Database["public"]["Tables"]["reminder_config"]["Row"];

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  t7_enabled: true,
  t3_enabled: true,
  t1_enabled: true,
  channel: "telegram",
  template_renewal:
    "Xin chào {customer_name}, dịch vụ {product_name} sẽ hết hạn vào {expiry_date}. Vui lòng gia hạn sớm!",
  template_debt:
    "Xin chào {customer_name}, bạn đang có công nợ {debt_amount} cần thanh toán trước {due_date}.",
  template_renewal_internal:
    "📌 Nhắc hạn đơn {order_code}\nKhách hàng: {customer_name}\nSản phẩm: {product_name}\nHết hạn: {expiry_date}\nCòn {days_left} ngày\nCòn nợ: {balance_due}",
  template_renewal_zalo:
    "Xin chào {customer_name}, dịch vụ {product_name} sẽ hết hạn vào {expiry_date}. Vui lòng gia hạn sớm để tránh gián đoạn.",
  template_expired_zalo:
    "Xin chào {customer_name}, dịch vụ {product_name} đã hết hạn vào {expiry_date}. Nếu cần tiếp tục sử dụng, bạn vui lòng nhắn lại để được hỗ trợ gia hạn.",
  auto_send: false,
};

type ReminderConfigLike = Partial<ReminderConfigRow & ReminderConfig>;

export interface ReminderTemplateContext {
  customer_name: string;
  product_name: string;
  expiry_date: string;
  due_date: string;
  debt_amount: string;
  balance_due: string;
  days_left: string;
  order_code: string;
  order_status: string;
}

export function normalizeReminderConfig(input?: ReminderConfigLike | null): ReminderConfig {
  return {
    ...DEFAULT_REMINDER_CONFIG,
    ...(input ?? {}),
    t7_enabled: input?.t7_enabled ?? DEFAULT_REMINDER_CONFIG.t7_enabled,
    t3_enabled: input?.t3_enabled ?? DEFAULT_REMINDER_CONFIG.t3_enabled,
    t1_enabled: input?.t1_enabled ?? DEFAULT_REMINDER_CONFIG.t1_enabled,
    channel: input?.channel ?? DEFAULT_REMINDER_CONFIG.channel,
    template_renewal: input?.template_renewal ?? DEFAULT_REMINDER_CONFIG.template_renewal,
    template_debt: input?.template_debt ?? DEFAULT_REMINDER_CONFIG.template_debt,
    template_renewal_internal:
      input?.template_renewal_internal ?? DEFAULT_REMINDER_CONFIG.template_renewal_internal,
    template_renewal_zalo:
      input?.template_renewal_zalo ?? DEFAULT_REMINDER_CONFIG.template_renewal_zalo,
    template_expired_zalo:
      input?.template_expired_zalo ?? DEFAULT_REMINDER_CONFIG.template_expired_zalo,
    auto_send: input?.auto_send ?? DEFAULT_REMINDER_CONFIG.auto_send,
  };
}

export async function getReminderConfig(accountId: string): Promise<ReminderConfig> {
  const { data, error } = await supabaseAdmin
    .from("reminder_config")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeReminderConfig(data);
}

export function renderReminderTemplate(
  template: string,
  context: ReminderTemplateContext,
): string {
  return template.replace(/\{([a-z_]+)\}/gi, (raw, key: keyof ReminderTemplateContext) => {
    const value = context[key];
    return value === undefined || value === null || value === "" ? raw : value;
  });
}

export function buildReminderTemplateContext(input: {
  customerName?: string | null;
  productName?: string | null;
  expiryDate?: string | null;
  debtAmountVnd?: number | null;
  balanceDueVnd?: number | null;
  daysLeft?: number | null;
  orderCode?: string | null;
  status?: string | null;
}): ReminderTemplateContext {
  return {
    customer_name: input.customerName?.trim() || "Khách hàng",
    product_name: input.productName?.trim() || "dịch vụ",
    expiry_date: formatDateShort(input.expiryDate),
    due_date: formatDateShort(input.expiryDate),
    debt_amount: `${formatNumber(Math.max(0, Math.round(input.debtAmountVnd ?? 0)))}đ`,
    balance_due: `${formatNumber(Math.max(0, Math.round(input.balanceDueVnd ?? 0)))}đ`,
    days_left: String(Math.max(0, Math.round(input.daysLeft ?? 0))),
    order_code: input.orderCode?.trim() || "N/A",
    order_status: input.status?.trim() || "unknown",
  };
}
