import { addMonths } from "date-fns";

export type PremiumBillingCycle = "1month" | "3months" | "6months" | "1year" | `${number}months`;
export type PremiumRenewalStatus = "pending" | "confirmed" | "denied" | "not_renewing";

const BILLING_CYCLE_MONTHS: Record<"1month" | "3months" | "6months" | "1year", number> = {
  "1month": 1,
  "3months": 3,
  "6months": 6,
  "1year": 12,
};

const BILLING_CYCLE_LABELS: Record<"1month" | "3months" | "6months" | "1year", string> = {
  "1month": "1 tháng",
  "3months": "3 tháng",
  "6months": "6 tháng",
  "1year": "12 tháng",
};

function clampCurrency(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

export function isPremiumBillingCycle(value: string): value is PremiumBillingCycle {
  return value in BILLING_CYCLE_MONTHS || /^([1-9]\d*)months$/.test(value);
}

export function getCycleMonths(billingCycle: string): number {
  if (isPremiumBillingCycle(billingCycle)) {
    const dynamicMatch = billingCycle.match(/^([1-9]\d*)months$/);
    if (dynamicMatch) {
      return Number(dynamicMatch[1]);
    }

    return BILLING_CYCLE_MONTHS[billingCycle as keyof typeof BILLING_CYCLE_MONTHS];
  }

  return 1;
}

export function getBillingCycleLabel(billingCycle: string | null | undefined): string {
  if (!billingCycle || !isPremiumBillingCycle(billingCycle)) {
    return "1 tháng";
  }

  return BILLING_CYCLE_LABELS[billingCycle as keyof typeof BILLING_CYCLE_LABELS] ?? `${getCycleMonths(billingCycle)} thÃ¡ng`;
}

export function resolvePremiumBillingCycle(
  billingCycle: string | null | undefined,
  fallback?: PremiumBillingCycle,
): PremiumBillingCycle {
  const normalized = String(billingCycle ?? "").trim();

  if (isPremiumBillingCycle(normalized)) {
    return normalized;
  }

  if (normalized.length === 0 && fallback) {
    return fallback;
  }

  throw new Error(`Invalid premium billing cycle: ${billingCycle ?? "empty"}`);
}

export function calculateExpiryDate(startDate: string, billingCycle: string): string {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid start date");
  }

  const months = getCycleMonths(billingCycle);
  return addMonths(start, months).toISOString().split("T")[0];
}

export function billingCycleFromMonths(months: number): PremiumBillingCycle {
  const normalizedMonths = Math.max(1, Math.round(Number(months) || 1));

  if (normalizedMonths === 1) {
    return "1month";
  }
  if (normalizedMonths === 3) {
    return "3months";
  }
  if (normalizedMonths === 6) {
    return "6months";
  }
  if (normalizedMonths === 12) {
    return "1year";
  }

  return `${normalizedMonths}months`;
}

export function durationToMonths(
  durationType: string | null | undefined,
  durationValue: number | null | undefined,
): number {
  const value = Math.max(1, Math.round(Number(durationValue ?? 1) || 1));

  if (durationType === "years") {
    return value * 12;
  }
  if (durationType === "days") {
    return Math.max(1, Math.round(value / 30));
  }

  return value;
}

export function normalizeRenewalStatus(
  status: string | null | undefined,
): PremiumRenewalStatus {
  const normalized = String(status ?? "").trim().toLowerCase();

  if (normalized === "confirmed" || normalized === "completed") {
    return "confirmed";
  }

  if (normalized === "denied") {
    return "denied";
  }

  if (normalized === "not_renewing") {
    return "not_renewing";
  }

  return "pending";
}

export function scaleAmountByCycle(
  amount: number | null | undefined,
  currentCycleMonths: number | null | undefined,
  nextBillingCycle: string,
): number {
  const safeAmount = clampCurrency(Number(amount ?? 0));
  const currentMonths = Math.max(1, Number(currentCycleMonths ?? 1));
  const nextMonths = getCycleMonths(nextBillingCycle);

  if (safeAmount <= 0) {
    return 0;
  }

  return clampCurrency((safeAmount / currentMonths) * nextMonths);
}

export function normalizeRenewalCurrency(
  value: number | string | null | undefined,
  fallback = 0,
): number {
  if (typeof value === "number") {
    return clampCurrency(value);
  }

  if (typeof value === "string") {
    const normalized = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(normalized) ? clampCurrency(normalized) : clampCurrency(fallback);
  }

  return clampCurrency(fallback);
}

export type RenewalFinanceInput = {
  renewalPrice: number;
  collectedAmount: number;
  costPrice: number;
};

export type RenewalFinanceSnapshot = {
  renewalPrice: number;
  collectedAmount: number;
  costPrice: number;
  outstandingAmount: number;
  revenueAmount: number;
  profitAmount: number;
  marginPercent: number | null;
};

export function calculateRenewalFinanceSnapshot(
  input: RenewalFinanceInput,
): RenewalFinanceSnapshot {
  const renewalPrice = clampCurrency(input.renewalPrice);
  const collectedAmount = clampCurrency(input.collectedAmount);
  const costPrice = clampCurrency(input.costPrice);
  const revenueAmount = collectedAmount;
  const outstandingAmount = Math.max(0, renewalPrice - collectedAmount);
  const profitAmount = revenueAmount - costPrice;
  const marginPercent = revenueAmount > 0
    ? Math.round((profitAmount / revenueAmount) * 1000) / 10
    : null;

  return {
    renewalPrice,
    collectedAmount,
    costPrice,
    outstandingAmount,
    revenueAmount,
    profitAmount,
    marginPercent,
  };
}
