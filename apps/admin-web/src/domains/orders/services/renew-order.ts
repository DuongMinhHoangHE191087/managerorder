import { formatDateShort } from "@/lib/utils";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { createOrderStatusHistory } from "@/lib/supabase/repositories/order-status-history.repo";
import { getOrderWithItems } from "@/lib/supabase/repositories/orders.repo";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  calculateOrderRenewalProjection,
  ensureOrderRenewalAllowed,
  normalizeProofUrls,
} from "@/lib/domain/sales-workflow-guards";

export interface RenewOrderInput {
  accountId: string;
  orderId: string;
  userEmail: string;
  durationMonths: number;
  addAmountVnd: number;
  addPaidVnd: number;
  note?: string;
  proofUrls?: string[];
}

export interface RenewOrderResult {
  newExpiresAt: string;
  previousStatus: string | null;
  nextStatus: string;
}

export async function renewOrderForAccount(
  input: RenewOrderInput,
): Promise<RenewOrderResult | null> {
  const order = await getOrderWithItems(input.orderId, input.accountId);
  if (!order) {
    return null;
  }

  ensureOrderRenewalAllowed(order.status);

  const renewal = calculateOrderRenewalProjection(order, {
    durationMonths: Number(input.durationMonths),
    addAmountVnd: Number(input.addAmountVnd),
    addPaidVnd: Number(input.addPaidVnd),
  });

  const existingProofs = normalizeProofUrls(order.proof_image_urls);
  const newProofs = normalizeProofUrls(input.proofUrls);
  const mergedProofs = [...existingProofs, ...newProofs];

  let newSalesNote = order.sales_note || "";
  if (input.note) {
    const today = formatDateShort(new Date());
    const appendText = `\n[Gia hạn ${today} - ${input.durationMonths} tháng]: ${input.note}`;
    newSalesNote = newSalesNote ? newSalesNote + appendText : appendText.trim();
  }

  const updatePayload: Record<string, unknown> = {
    total_amount_vnd: renewal.totalAmountVnd,
    total_paid: renewal.totalPaidVnd,
    expires_at: renewal.expiresAt,
    proof_image_urls: mergedProofs.length > 0 ? mergedProofs : null,
    sales_note: newSalesNote || null,
    updated_at: new Date().toISOString(),
  };

  if (renewal.status) {
    updatePayload.status = renewal.status;
  }

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update(updatePayload)
    .eq("id", input.orderId)
    .eq("account_id", input.accountId);

  if (updateError) {
    throw new Error(`Failed to renew order: ${updateError.message}`);
  }

  if (renewal.status !== order.status) {
    await createOrderStatusHistory({
      order_id: input.orderId,
      old_status: order.status,
      new_status: renewal.status,
      changed_by: input.userEmail,
      change_reason: input.note ? `Gia hạn: ${input.note}` : "Gia hạn đơn hàng",
      metadata: {
        added_months: input.durationMonths,
        added_amount_vnd: input.addAmountVnd,
        added_paid_vnd: input.addPaidVnd,
      },
    });
  }

  await createActivityLog({
    account_id: input.accountId,
    action_type: "ORDER_RENEWED",
    customer_id: order.customer_id,
    order_id: input.orderId,
    created_by: input.userEmail,
    details: {
      added_months: input.durationMonths,
      added_amount: input.addAmountVnd,
      added_paid: input.addPaidVnd,
      previous_expires_at: order.expires_at,
      new_expires_at: renewal.expiresAt,
      previous_status: order.status,
      new_status: renewal.status,
      note: input.note || null,
      renewed_by: input.userEmail,
    },
  });

  return {
    newExpiresAt: renewal.expiresAt,
    previousStatus: order.status,
    nextStatus: renewal.status,
  };
}
