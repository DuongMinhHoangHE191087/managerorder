import type { OrderStatus, PaymentMethod, PaymentState, PaymentTerms } from "@/lib/domain/types";

export const PAYMENT_TERMS_VALUES = ["prepaid", "credit", "cod"] as const;
export const PAYMENT_STATE_VALUES = ["unpaid", "partial", "paid", "overpaid"] as const;
export const LEGACY_PAYMENT_METHOD_VALUES = ["paid", "debt", "cod"] as const;
export const PAYMENT_TERM_DISPLAY_LABELS: Record<PaymentTerms, string> = {
  prepaid: "Trả trước",
  credit: "Công nợ",
  cod: "COD / trực tiếp",
};
export const PAYMENT_METHOD_DISPLAY_LABELS: Record<string, string> = {
  bank_transfer: "Chuyển khoản",
  cash: "Tiền mặt",
  wallet: "Ví điện tử",
  momo: "MoMo",
  zalo_pay: "ZaloPay",
  other: "Khác",
};

const CANONICAL_ORDER_STATUSES = new Set<OrderStatus>([
  "draft",
  "pending_payment",
  "paid",
  "provisioning",
  "active",
  "expired",
  "refunded",
]);

const PAYMENT_TERMS_BY_INPUT: Record<string, PaymentTerms> = {
  paid: "prepaid",
  prepaid: "prepaid",
  debt: "credit",
  credit: "credit",
  cod: "cod",
};

const LEGACY_METHOD_BY_TERMS: Record<PaymentTerms, PaymentMethod> = {
  prepaid: "paid",
  credit: "debt",
  cod: "cod",
};

export interface FinancialSummary {
  payment_terms: PaymentTerms | null;
  payment_state: PaymentState;
  balance_due_vnd: number;
  overpaid_amount_vnd: number;
  is_fully_paid: boolean;
  debt_age_days: number;
}

export function withFinancialSummary<T extends {
  total_amount_vnd?: number | null;
  total_paid?: number | null;
  payment_terms?: string | null;
  payment_method?: string | null;
  created_at?: string | null;
}>(row: T): T & FinancialSummary {
  return {
    ...row,
    ...buildFinancialSummary(row),
  };
}

export function isCanonicalOrderStatus(value: string | null | undefined): value is OrderStatus {
  return Boolean(value && CANONICAL_ORDER_STATUSES.has(value as OrderStatus));
}

export function normalizePaymentTerms(value: string | null | undefined): PaymentTerms | null {
  if (!value) return null;
  return PAYMENT_TERMS_BY_INPUT[String(value).trim().toLowerCase()] ?? null;
}

export function normalizeLegacyPaymentMethod(value: string | null | undefined): PaymentMethod | null {
  const terms = normalizePaymentTerms(value);
  return terms ? LEGACY_METHOD_BY_TERMS[terms] : null;
}

export function toLegacyPaymentMethod(value: PaymentTerms | string | null | undefined): PaymentMethod | null {
  const terms = normalizePaymentTerms(value);
  return terms ? LEGACY_METHOD_BY_TERMS[terms] : null;
}

export function formatPaymentTermsLabel(value: string | null | undefined): string {
  const terms = normalizePaymentTerms(value);
  return terms ? PAYMENT_TERM_DISPLAY_LABELS[terms] : "";
}

export function formatPaymentMethodLabel(value: string | null | undefined): string {
  const termLabel = formatPaymentTermsLabel(value);
  if (termLabel) return termLabel;

  const normalized = value ? String(value).trim().toLowerCase() : "";
  if (!normalized) return "";

  return PAYMENT_METHOD_DISPLAY_LABELS[normalized] ?? "";
}

export function derivePaymentState(
  totalAmountVnd: number | null | undefined,
  totalPaidVnd: number | null | undefined
): PaymentState {
  const total = Number(totalAmountVnd ?? 0);
  const paid = Number(totalPaidVnd ?? 0);

  if (paid <= 0) return "unpaid";
  if (paid < total) return "partial";
  if (paid === total) return "paid";
  return "overpaid";
}

export function calculateBalanceDue(
  totalAmountVnd: number | null | undefined,
  totalPaidVnd: number | null | undefined
): number {
  const total = Number(totalAmountVnd ?? 0);
  const paid = Number(totalPaidVnd ?? 0);
  return Math.max(total - paid, 0);
}

export function calculateOverpaidAmount(
  totalAmountVnd: number | null | undefined,
  totalPaidVnd: number | null | undefined
): number {
  const total = Number(totalAmountVnd ?? 0);
  const paid = Number(totalPaidVnd ?? 0);
  return Math.max(paid - total, 0);
}

export function isFullyPaid(
  totalAmountVnd: number | null | undefined,
  totalPaidVnd: number | null | undefined
): boolean {
  const state = derivePaymentState(totalAmountVnd, totalPaidVnd);
  return state === "paid" || state === "overpaid";
}

export function mapLegacyStatusAlias(
  input: string | null | undefined
): { status?: OrderStatus; paymentState?: PaymentState } {
  if (!input) return {};

  const normalized = input.trim().toLowerCase();
  if (normalized === "unpaid") {
    return { paymentState: "unpaid" };
  }

  if (isCanonicalOrderStatus(normalized)) {
    return { status: normalized };
  }

  return {};
}

export function buildFinancialSummary(input: {
  total_amount_vnd?: number | null;
  total_paid?: number | null;
  payment_terms?: string | null;
  payment_method?: string | null;
  created_at?: string | null;
}): FinancialSummary {
  const paymentTerms = normalizePaymentTerms(input.payment_terms ?? input.payment_method);
  const totalAmount = Number(input.total_amount_vnd ?? 0);
  const totalPaid = Number(input.total_paid ?? 0);
  const paymentState = derivePaymentState(totalAmount, totalPaid);
  const balanceDue = calculateBalanceDue(totalAmount, totalPaid);
  const debtAgeDays =
    balanceDue > 0 && input.created_at
      ? Math.max(
          0,
          Math.floor((Date.now() - new Date(input.created_at).getTime()) / (1000 * 60 * 60 * 24))
        )
      : 0;

  return {
    payment_terms: paymentTerms,
    payment_state: paymentState,
    balance_due_vnd: balanceDue,
    overpaid_amount_vnd: calculateOverpaidAmount(totalAmount, totalPaid),
    is_fully_paid: isFullyPaid(totalAmount, totalPaid),
    debt_age_days: debtAgeDays,
  };
}
