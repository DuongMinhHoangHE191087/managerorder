import { calculateRefund } from "@/lib/domain/refund-policy";
import {
  ensureOrderRefundRequestAllowed,
  normalizeRefundCalculationInput,
} from "@/lib/domain/sales-workflow-guards";
import { resolveOrderDuration, toDurationDays } from "@/lib/domain/order-duration";
import type { RefundMode } from "@/lib/domain/types";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import {
  createRefundRequest,
  getRefundsByOrder,
  type RefundRequestRow,
} from "@/lib/supabase/repositories/refund-requests.repo";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadRowsByIds } from "@/lib/supabase/relation-fallback";

export interface CreateOrderRefundRequestInput {
  accountId: string;
  orderId: string;
  userEmail: string;
  refund_mode?: RefundMode;
  consumed_days?: number;
  total_days?: number;
  reason?: string;
}

type RefundableOrderRow = {
  id: string;
  status: string;
  total_amount_vnd: number | null;
  total_paid: number | null;
  customer_id: string | null;
  created_at: string | null;
  product_id: string | null;
  invoice_snapshot: Record<string, unknown> | null;
};

async function getRefundableOrder(
  orderId: string,
  accountId: string,
): Promise<RefundableOrderRow | null> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, status, total_amount_vnd, total_paid, customer_id, created_at, product_id, invoice_snapshot")
    .eq("id", orderId)
    .eq("account_id", accountId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as RefundableOrderRow;
}

export async function listOrderRefundsForAccount(
  orderId: string,
  accountId: string,
): Promise<RefundRequestRow[] | null> {
  const order = await getRefundableOrder(orderId, accountId);
  if (!order) {
    return null;
  }

  return getRefundsByOrder(orderId);
}

export async function createOrderRefundRequestForAccount(
  input: CreateOrderRefundRequestInput,
): Promise<RefundRequestRow | null> {
  const order = await getRefundableOrder(input.orderId, input.accountId);
  if (!order) {
    return null;
  }

  ensureOrderRefundRequestAllowed(order);

  const productMap = order.product_id
    ? await loadRowsByIds<{
        id: string;
        duration_value: number | null;
        duration_type: string | null;
      }>(
        supabaseAdmin,
        "products",
        input.accountId,
        [order.product_id],
        "id, duration_value, duration_type",
      )
    : new Map<string, { id: string; duration_value: number | null; duration_type: string | null }>();

  const paidAmount = Number(order.total_paid ?? 0);
  const productInfo = order.product_id ? productMap.get(order.product_id) ?? null : null;

  let totalDays = input.total_days ?? 30;
  const invoiceSnapshot = order.invoice_snapshot ?? null;
  const salesContext = invoiceSnapshot && typeof invoiceSnapshot === "object"
    ? (invoiceSnapshot.sales_context as Record<string, unknown> | undefined)
    : undefined;
  const primaryDuration = salesContext && typeof salesContext === "object"
    ? (salesContext.primary_duration as Record<string, unknown> | undefined)
    : undefined;

  if (!input.total_days && primaryDuration) {
    totalDays = toDurationDays(resolveOrderDuration({
      durationType: typeof primaryDuration.duration_type === "string" ? primaryDuration.duration_type : undefined,
      durationValue: Number(primaryDuration.duration_value ?? 1),
      bonusDurationValue: Number(primaryDuration.bonus_duration_value ?? 0),
    }));
  } else if (!input.total_days && productInfo?.duration_value) {
    totalDays = toDurationDays(resolveOrderDuration({
      durationType: productInfo.duration_type ?? "days",
      durationValue: productInfo.duration_value,
    }));
  }

  let consumedDays = input.consumed_days ?? 0;
  if (input.consumed_days === undefined && order.created_at) {
    const orderDate = new Date(order.created_at);
    const now = new Date();
    consumedDays = Math.max(
      0,
      Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)),
    );
  }

  const refundMode = input.refund_mode ?? "pro_rata";
  const normalizedRefundInput = normalizeRefundCalculationInput({
    refundMode,
    consumedDays,
    totalDays,
  });
  const refundCalc = calculateRefund({
    paidAmountVnd: paidAmount,
    consumedDays: normalizedRefundInput.consumedDays,
    totalDays: normalizedRefundInput.totalDays,
    mode: normalizedRefundInput.refundMode,
  });

  const refund = await createRefundRequest({
    order_id: input.orderId,
    customer_id: order.customer_id,
    paid_amount_vnd: paidAmount,
    consumed_days: normalizedRefundInput.consumedDays,
    total_days: normalizedRefundInput.totalDays,
    refund_mode: normalizedRefundInput.refundMode,
    refundable_amount_vnd: refundCalc.refundableAmountVnd,
    reason: input.reason ?? null,
    requested_by: input.userEmail,
  });

  await createActivityLog({
    account_id: input.accountId,
    action_type: "REFUND_REQUESTED",
    customer_id: order.customer_id,
    order_id: input.orderId,
    created_by: input.userEmail,
    details: {
      refund_id: refund.id,
      mode: normalizedRefundInput.refundMode,
      consumed_ratio: refundCalc.consumedRatio,
      refundable_amount: refundCalc.refundableAmountVnd,
      total_days: normalizedRefundInput.totalDays,
      consumed_days: normalizedRefundInput.consumedDays,
      reason: input.reason ?? null,
    },
  });

  return refund;
}
