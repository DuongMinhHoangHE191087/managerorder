import { NextResponse } from "next/server";
import { getOrderWithItems } from "@/lib/supabase/repositories/orders.repo";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { createOrderStatusHistory } from "@/lib/supabase/repositories/order-status-history.repo";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withAccount } from "@/lib/api/with-account";
import { createSuccessResponse, withErrorHandler } from "@/lib/api/with-error-handler";
import { hasPermission, resolveUser } from "@/lib/api/rbac";
import { formatDateShort } from "@/lib/utils";
import {
  calculateOrderRenewalProjection,
  ensureOrderRenewalAllowed,
  normalizeProofUrls,
} from "@/lib/domain/sales-workflow-guards";

export const POST = withErrorHandler(withAccount<{ id: string }>(async (request, { accountId, params }) => {
  const { id } = await params;
  const user = await resolveUser(request, accountId);
  if (!user) {
    return NextResponse.json({ error: "Không thể xác thực người dùng" }, { status: 401 });
  }
  if (!hasPermission(user.role, "order:update")) {
    return NextResponse.json({ error: "Bạn không có quyền gia hạn đơn hàng" }, { status: 403 });
  }
  const body = await request.json() as { 
    durationMonths: number;
    addAmountVnd: number;
    addPaidVnd: number;
    note?: string;
    proofUrls?: string[];
  };

  const order = await getOrderWithItems(id, accountId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  ensureOrderRenewalAllowed(order.status);
  const renewal = calculateOrderRenewalProjection(order, {
    durationMonths: Number(body.durationMonths),
    addAmountVnd: Number(body.addAmountVnd),
    addPaidVnd: Number(body.addPaidVnd),
  });

  // Merge proof images
  const existingProofs = normalizeProofUrls(order.proof_image_urls);
  const newProofs = normalizeProofUrls(body.proofUrls);
  const mergedProofs = [...existingProofs, ...newProofs];

  // Append note
  let newSalesNote = order.sales_note || "";
  if (body.note) {
    const today = formatDateShort(new Date());
    const appendText = `\n[Gia hạn ${today} - ${body.durationMonths} tháng]: ${body.note}`;
    newSalesNote = newSalesNote ? newSalesNote + appendText : appendText.trim();
  }

  const updatePayload: Record<string, unknown> = {
    total_amount_vnd: renewal.totalAmountVnd,
    total_paid: renewal.totalPaidVnd,
    expires_at: renewal.expiresAt,
    proof_image_urls: mergedProofs.length > 0 ? mergedProofs : null,
    sales_note: newSalesNote || null,
    updated_at: new Date().toISOString()
  };
  
  if (renewal.status) updatePayload.status = renewal.status;

  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update(updatePayload)
    .eq('id', id)
    .eq('account_id', accountId);

  if (updateError) {
    throw new Error(`Failed to renew order: ${updateError.message}`);
  }

  if (renewal.status !== order.status) {
    await createOrderStatusHistory({
      order_id: id,
      old_status: order.status,
      new_status: renewal.status,
      changed_by: user.email,
      change_reason: body.note ? `Gia hạn: ${body.note}` : "Gia hạn đơn hàng",
      metadata: {
        added_months: body.durationMonths,
        added_amount_vnd: body.addAmountVnd,
        added_paid_vnd: body.addPaidVnd,
      },
    });
  }

  // Log activity
  await createActivityLog({
    account_id: accountId,
    action_type: 'ORDER_RENEWED',
    customer_id: order.customer_id,
    order_id: id,
      details: {
        added_months: body.durationMonths,
        added_amount: body.addAmountVnd,
        added_paid: body.addPaidVnd,
        new_expires_at: renewal.expiresAt,
        note: body.note || null,
        renewed_by: user.email,
      },
    });

  return createSuccessResponse({ newExpiresAt: renewal.expiresAt });
}));
