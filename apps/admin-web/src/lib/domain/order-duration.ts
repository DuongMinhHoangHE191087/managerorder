export type OrderDurationType = "days" | "months" | "years";

export interface ProductDurationSource {
  durationType?: string | null;
  durationValue?: number | null;
}

export interface OrderDurationInput {
  durationType?: OrderDurationType | string | null;
  durationValue?: number | null;
  bonusDurationValue?: number | null;
}

export interface ResolvedOrderDuration {
  durationType: OrderDurationType;
  durationValue: number;
  bonusDurationValue: number;
  effectiveDurationValue: number;
}

function parseWholeNumber(
  value: number | string | null | undefined,
  minimum: number,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.max(minimum, Math.trunc(numericValue));
}

export function normalizeOrderDurationType(value?: string | null): OrderDurationType {
  if (value === "months" || value === "years") {
    return value;
  }

  return "days";
}

export function resolveOrderDuration(
  input?: OrderDurationInput | null,
  fallback?: ProductDurationSource | null,
): ResolvedOrderDuration {
  const durationType = normalizeOrderDurationType(input?.durationType ?? fallback?.durationType);
  const durationValue =
    parseWholeNumber(input?.durationValue, 1) ??
    parseWholeNumber(fallback?.durationValue, 1) ??
    1;
  const bonusDurationValue = parseWholeNumber(input?.bonusDurationValue, 0) ?? 0;

  return {
    durationType,
    durationValue,
    bonusDurationValue,
    effectiveDurationValue: durationValue + bonusDurationValue,
  };
}

export function addOrderDuration(baseDate: Date, duration: ResolvedOrderDuration): Date {
  const next = new Date(baseDate);

  if (duration.durationType === "years") {
    next.setFullYear(next.getFullYear() + duration.effectiveDurationValue);
    return next;
  }

  if (duration.durationType === "months") {
    next.setMonth(next.getMonth() + duration.effectiveDurationValue);
    return next;
  }

  next.setDate(next.getDate() + duration.effectiveDurationValue);
  return next;
}

export function formatOrderDurationLabel(
  duration: ResolvedOrderDuration,
  options?: { includeBonus?: boolean; compact?: boolean },
): string {
  const unitLabel =
    duration.durationType === "months"
      ? options?.compact
        ? "th"
        : "tháng"
      : duration.durationType === "years"
        ? options?.compact
          ? "năm"
          : "năm"
        : options?.compact
          ? "ngày"
          : "ngày";

  if (!options?.includeBonus || duration.bonusDurationValue <= 0) {
    return `${duration.effectiveDurationValue} ${unitLabel}`;
  }

  return `${duration.durationValue} + ${duration.bonusDurationValue} = ${duration.effectiveDurationValue} ${unitLabel}`;
}

export function toDurationDays(duration: ResolvedOrderDuration): number {
  if (duration.durationType === "years") {
    return duration.effectiveDurationValue * 365;
  }

  if (duration.durationType === "months") {
    return duration.effectiveDurationValue * 30;
  }

  return duration.effectiveDurationValue;
}
