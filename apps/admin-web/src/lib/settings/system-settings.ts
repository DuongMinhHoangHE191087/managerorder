import type { SystemSettings } from "@/lib/domain/types";
import {
  DEFAULT_SALES_LANDING_CONFIG,
  normalizeSalesLandingConfig,
} from "@/lib/settings/sales-landing";

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  company_name: "",
  tax_id: "",
  company_address: "",
  personal_name: "",
  bank_name: "",
  bank_account: "",
  default_notes: "",
  qr_transfer_content: "",
  default_currency: "VND",
  locale: "vi-VN",
  timezone: "Asia/Ho_Chi_Minh",
  invoice_prefix: "INV",
  tax_label: "VAT",
  tax_rate_default: 0,
  payment_instruction_template: "",
  sales_landing_config: DEFAULT_SALES_LANDING_CONFIG,
};

export interface FormattingPreferences {
  locale: string;
  timeZone: string;
  currency: string;
}

export function normalizeSystemSettings(
  value?: Partial<SystemSettings> | Record<string, unknown> | null
): SystemSettings {
  const merged = {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...(value ?? {}),
  } as Record<string, unknown>;

  return {
    ...DEFAULT_SYSTEM_SETTINGS,
    company_name: String(merged.company_name ?? DEFAULT_SYSTEM_SETTINGS.company_name),
    tax_id: String(merged.tax_id ?? DEFAULT_SYSTEM_SETTINGS.tax_id),
    company_address: String(merged.company_address ?? DEFAULT_SYSTEM_SETTINGS.company_address),
    personal_name: String(merged.personal_name ?? DEFAULT_SYSTEM_SETTINGS.personal_name),
    bank_name: String(merged.bank_name ?? DEFAULT_SYSTEM_SETTINGS.bank_name),
    bank_account: String(merged.bank_account ?? DEFAULT_SYSTEM_SETTINGS.bank_account),
    default_notes: String(merged.default_notes ?? DEFAULT_SYSTEM_SETTINGS.default_notes),
    qr_transfer_content: String(merged.qr_transfer_content ?? DEFAULT_SYSTEM_SETTINGS.qr_transfer_content),
    default_currency: normalizeCurrency(merged.default_currency),
    locale: normalizeLocale(merged.locale),
    timezone: normalizeTimeZone(merged.timezone),
    invoice_prefix: String(merged.invoice_prefix ?? DEFAULT_SYSTEM_SETTINGS.invoice_prefix).trim() || DEFAULT_SYSTEM_SETTINGS.invoice_prefix,
    tax_label: String(merged.tax_label ?? DEFAULT_SYSTEM_SETTINGS.tax_label).trim() || DEFAULT_SYSTEM_SETTINGS.tax_label,
    tax_rate_default: Number(merged.tax_rate_default ?? DEFAULT_SYSTEM_SETTINGS.tax_rate_default) || 0,
    payment_instruction_template: String(
      merged.payment_instruction_template ?? DEFAULT_SYSTEM_SETTINGS.payment_instruction_template
    ),
    sales_landing_config: normalizeSalesLandingConfig(
      merged.sales_landing_config as Partial<Parameters<typeof normalizeSalesLandingConfig>[0]> | Record<string, unknown> | null | undefined
    ),
  };
}

export function getFormattingPreferences(
  settings?: Partial<SystemSettings> | Record<string, unknown> | null
): FormattingPreferences {
  const normalized = normalizeSystemSettings(settings);
  return {
    locale: normalized.locale,
    timeZone: normalized.timezone,
    currency: normalized.default_currency,
  };
}

export function hasConfiguredPaymentInstructions(
  settings?: Partial<SystemSettings> | Record<string, unknown> | null
): boolean {
  const normalized = normalizeSystemSettings(settings);
  return Boolean(
    normalized.bank_name.trim() &&
      normalized.bank_account.trim() &&
      normalized.personal_name.trim()
  );
}

export function buildInvoiceNumber(
  settings: Partial<SystemSettings> | Record<string, unknown> | null | undefined,
  createdAt: string,
  orderId: string
): string {
  const normalized = normalizeSystemSettings(settings);
  const dateStr = new Date(createdAt).toISOString().slice(0, 10).replace(/-/g, "");
  const shortId = orderId.slice(-6).toUpperCase();
  return `${normalized.invoice_prefix}-${dateStr}-${shortId}`;
}

export function buildTaxSummary(
  subtotalVnd: number,
  settings?: Partial<SystemSettings> | Record<string, unknown> | null
) {
  const normalized = normalizeSystemSettings(settings);
  const taxRate = Number(normalized.tax_rate_default ?? 0);
  const taxAmount = Math.round((subtotalVnd * taxRate) / 100);

  return {
    label: normalized.tax_label,
    rate: taxRate,
    amount_vnd: taxAmount,
  };
}

export function buildPaymentInstructionText(
  settings?: Partial<SystemSettings> | Record<string, unknown> | null,
  transferContent?: string | null
): string | null {
  const normalized = normalizeSystemSettings(settings);
  if (!hasConfiguredPaymentInstructions(normalized)) {
    return null;
  }

  const content = transferContent?.trim() || "";
  const template =
    normalized.payment_instruction_template.trim() ||
    normalized.qr_transfer_content?.trim() ||
    [
      "Ngân hàng: {{bank_name}}",
      "Số tài khoản: {{bank_account}}",
      "Chủ tài khoản: {{account_name}}",
      "{{transfer_line}}",
    ].join("\n");

  return template
    .replaceAll("{{bank_name}}", normalized.bank_name)
    .replaceAll("{{bank_account}}", normalized.bank_account)
    .replaceAll("{{account_name}}", normalized.personal_name)
    .replaceAll(
      "{{transfer_line}}",
      content ? `Nội dung chuyển khoản: ${content}` : ""
    )
    .trim();
}

function normalizeLocale(value: unknown): string {
  return String(value ?? DEFAULT_SYSTEM_SETTINGS.locale).trim() || DEFAULT_SYSTEM_SETTINGS.locale;
}

function normalizeTimeZone(value: unknown): string {
  return String(value ?? DEFAULT_SYSTEM_SETTINGS.timezone).trim() || DEFAULT_SYSTEM_SETTINGS.timezone;
}

function normalizeCurrency(value: unknown): string {
  return String(value ?? DEFAULT_SYSTEM_SETTINGS.default_currency)
    .trim()
    .toUpperCase() || DEFAULT_SYSTEM_SETTINGS.default_currency;
}
