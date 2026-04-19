import type { OrderStatus, RefundMode } from "@/lib/domain/types";
import { ValidationError } from "@/lib/utils/errors";

const ALLOWED_ORDER_RENEWAL_STATUSES = new Set<OrderStatus>(["active", "expired"]);
const ALLOWED_REFUND_MODES = new Set<RefundMode>(["pro_rata", "full"]);

export interface OrderRenewalSnapshot {
  status: OrderStatus | string | null | undefined;
  total_amount_vnd?: number | null;
  total_paid?: number | null;
  expires_at?: string | null;
}

export interface OrderRenewalInput {
  durationMonths: number;
  addAmountVnd: number;
  addPaidVnd: number;
}

export interface OrderRenewalProjection {
  totalAmountVnd: number;
  totalPaidVnd: number;
  expiresAt: string;
  status: OrderStatus;
}

export interface RefundCalculationInput {
  refundMode: unknown;
  consumedDays: unknown;
  totalDays: unknown;
}

export interface NormalizedRefundCalculationInput {
  refundMode: RefundMode;
  consumedDays: number;
  totalDays: number;
}

export interface PremiumSubscriptionRenewalSnapshot {
  status?: string | null;
  renewal_status?: string | null;
}

export interface PremiumSubscriptionRefundSnapshot {
  renewal_status?: string | null;
  original_price?: number | null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function ensureNonNegativeNumber(name: string, value: unknown): number {
  if (!isFiniteNumber(value) || value < 0) {
    throw new ValidationError(`${name} phải là số không âm hợp lệ.`);
  }

  return value;
}

function ensurePositiveInteger(name: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`${name} phải là số nguyên lớn hơn 0.`);
  }

  return value;
}

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
}

export function ensureOrderRenewalAllowed(status: OrderStatus | string | null | undefined): void {
  const normalizedStatus = (status ?? "").trim() as OrderStatus;
  if (!ALLOWED_ORDER_RENEWAL_STATUSES.has(normalizedStatus)) {
    throw new ValidationError("Chỉ có thể gia hạn đơn hàng ở trạng thái active hoặc expired.");
  }
}

export function calculateOrderRenewalProjection(
  order: OrderRenewalSnapshot,
  input: OrderRenewalInput,
): OrderRenewalProjection {
  ensurePositiveInteger("durationMonths", input.durationMonths);
  ensureNonNegativeNumber("addAmountVnd", input.addAmountVnd);
  ensureNonNegativeNumber("addPaidVnd", input.addPaidVnd);

  const currentTotalAmount = Math.max(0, Number(order.total_amount_vnd ?? 0));
  const currentTotalPaid = Math.max(0, Number(order.total_paid ?? 0));
  const totalAmountVnd = currentTotalAmount + input.addAmountVnd;
  const totalPaidVnd = currentTotalPaid + input.addPaidVnd;

  const baseDate = order.expires_at ? new Date(order.expires_at) : new Date();
  const renewalDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  renewalDate.setMonth(renewalDate.getMonth() + input.durationMonths);

  const currentStatus = (order.status ?? "active") as OrderStatus;
  const nextStatus: OrderStatus =
    currentStatus === "expired" && totalPaidVnd >= totalAmountVnd
      ? "active"
      : currentStatus;

  return {
    totalAmountVnd,
    totalPaidVnd,
    expiresAt: renewalDate.toISOString(),
    status: nextStatus,
  };
}

export function ensureOrderRefundRequestAllowed(
  order: { status?: string | null; total_paid?: number | null },
): void {
  if ((order.status ?? "") === "refunded") {
    throw new ValidationError("Đơn hàng đã hoàn tiền, không thể tạo yêu cầu mới.");
  }

  if (Math.max(0, Number(order.total_paid ?? 0)) <= 0) {
    throw new ValidationError("Đơn hàng chưa có thanh toán để hoàn tiền.");
  }
}

export function normalizeRefundCalculationInput(
  input: RefundCalculationInput,
): NormalizedRefundCalculationInput {
  const refundMode = input.refundMode;
  if (typeof refundMode !== "string" || !ALLOWED_REFUND_MODES.has(refundMode as RefundMode)) {
    throw new ValidationError("Phương thức hoàn tiền không hợp lệ.");
  }

  const consumedDays = ensureNonNegativeNumber("consumedDays", input.consumedDays);
  const totalDays = ensurePositiveInteger("totalDays", input.totalDays);

  return {
    refundMode: refundMode as RefundMode,
    consumedDays,
    totalDays,
  };
}

export function ensurePremiumSubscriptionRenewalAllowed(
  subscription: PremiumSubscriptionRenewalSnapshot,
): void {
  if ((subscription.status ?? "") !== "active") {
    throw new ValidationError("Chỉ có thể tạo yêu cầu gia hạn cho subscription đang active.");
  }

  if ((subscription.renewal_status ?? "") === "pending") {
    throw new ValidationError("Yêu cầu gia hạn đã tồn tại cho subscription này.");
  }
}

export function ensurePremiumSubscriptionRefundAllowed(
  subscription: PremiumSubscriptionRefundSnapshot,
): void {
  if ((subscription.renewal_status ?? "") !== "denied") {
    throw new ValidationError("Refund chỉ có thể tính khi renewal đã bị từ chối.");
  }

  if (Math.max(0, Number(subscription.original_price ?? 0)) <= 0) {
    throw new ValidationError("Subscription chưa có giá gốc hợp lệ để hoàn tiền.");
  }
}

export function normalizeProofUrls(value: unknown): string[] {
  return normalizeStringList(value);
}
