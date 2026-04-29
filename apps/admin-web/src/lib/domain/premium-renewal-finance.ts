export type PremiumBillingCycle = "1month" | "3months" | "6months" | "1year";

const BILLING_CYCLE_MONTHS: Record<PremiumBillingCycle, number> = {
  "1month": 1,
  "3months": 3,
  "6months": 6,
  "1year": 12,
};

const BILLING_CYCLE_LABELS: Record<PremiumBillingCycle, string> = {
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
  return value in BILLING_CYCLE_MONTHS;
}

export function getCycleMonths(billingCycle: string): number {
  if (isPremiumBillingCycle(billingCycle)) {
    return BILLING_CYCLE_MONTHS[billingCycle];
  }

  return 1;
}

export function getBillingCycleLabel(billingCycle: string | null | undefined): string {
  if (!billingCycle || !isPremiumBillingCycle(billingCycle)) {
    return "1 tháng";
  }

  return BILLING_CYCLE_LABELS[billingCycle];
}

export function calculateExpiryDate(startDate: string, billingCycle: string): string {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid start date");
  }

  const months = getCycleMonths(billingCycle);
  const expiry = new Date(start);
  expiry.setMonth(expiry.getMonth() + months);
  return expiry.toISOString().split("T")[0];
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
