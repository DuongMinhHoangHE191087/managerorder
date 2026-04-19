import { NextResponse } from "next/server";
import { updateOrderPaymentAndStatus, deleteOrder, getOrderWithItems } from "@/lib/supabase/repositories/orders.repo";
import type { Database } from "@/lib/supabase/database.types";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { createOrderStatusHistory } from "@/lib/supabase/repositories/order-status-history.repo";
import { deallocateOrder } from "@/lib/services/allocation.service";
import { canTransitionOrder } from "@/lib/domain/order-state-machine";
import { hasPermission, resolveUser } from "@/lib/api/rbac";
import {
  normalizePaymentTerms,
  toLegacyPaymentMethod,
  withFinancialSummary,
} from "@/lib/domain/financial";

type OrderStatus = Database['public']['Tables']['orders']['Row']['status'];

// Statuses that indicate inventory has been allocated
const ALLOCATED_STATUSES = new Set(['provisioning', 'active']);
// Statuses that require deallocation when transitioning to
const DEALLOC_TARGET_STATUSES = new Set(['pending_payment', 'paid', 'refunded']);

/**
 * GET /api/orders/[id]
 * Returns the order header + all line items.
 * This is the single source of truth for order detail views and the invoice page.
 */
export const GET = withErrorHandler(withAccount<{ id: string }>(async (_request, { accountId, params }) => {
  const { id } = await params;
  const order = await getOrderWithItems(id, accountId);
  if (!order) return NextResponse.json({ error: "Đơn hàng không tồn tại" }, { status: 404 });
  return NextResponse.json({ data: withFinancialSummary(order) });
}));

export const PUT = withErrorHandler(withAccount<{ id: string }>(async (request, { accountId, params }) => {
  const { id } = await params;
  const body = await request.json() as { 
    customer_id?: string;
    status?: string;
    total_paid?: number;
    payment_method?: string;
    payment_terms?: string;
    payment_source_id?: string;
    sales_channel_id?: string;
    sales_note?: string;
    expires_at?: string;
    created_at?: string;
    unit_price_vnd?: number;
    cost_price_vnd?: number;
    proof_image_urls?: string[];
    items?: { id: string, notes?: string, customer_nick_used?: string, assigned_source_account_id?: string | null }[];
  };
  
  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  
  const order = await getOrderWithItems(id, accountId);
  if (!order) {
    return NextResponse.json({ error: "Đơn hàng không tồn tại" }, { status: 404 });
  }

  const user = await resolveUser(request, accountId);
  if (!user) {
    return NextResponse.json({ error: "Không thể xác thực người dùng" }, { status: 401 });
  }
  if (!hasPermission(user.role, "order:update")) {
    return NextResponse.json({ error: "Bạn không có quyền chỉnh sửa đơn hàng" }, { status: 403 });
  }

  const oldStatus = order.status;
  const normalizedPaymentTerms = normalizePaymentTerms(body.payment_terms ?? body.payment_method);
  const legacyPaymentMethod =
    body.payment_method !== undefined
      ? body.payment_method
      : toLegacyPaymentMethod(normalizedPaymentTerms);

  // Validate state machine transition
  if (body.status && oldStatus !== body.status) {
    if (!canTransitionOrder(oldStatus as OrderStatus, body.status as OrderStatus)) {
      return NextResponse.json(
        { error: `Không thể chuyển từ "${oldStatus}" sang "${body.status}". Chuyển trạng thái không hợp lệ.` },
        { status: 422 }
      );
    }
  }

  // Auto-deallocate when moving from allocated status to non-allocated status
  if (body.status && ALLOCATED_STATUSES.has(oldStatus) && DEALLOC_TARGET_STATUSES.has(body.status)) {
    await deallocateOrder(id, accountId);
  }

  // Auto-recalculate totals when price changes
  const quantity = order?.quantity ?? 1;

  const recalculated: Record<string, unknown> = {};
  if (body.unit_price_vnd !== undefined) {
    recalculated.unit_price_vnd = body.unit_price_vnd;
    recalculated.total_amount_vnd = quantity * body.unit_price_vnd;
  }
  if (body.cost_price_vnd !== undefined) {
    recalculated.cost_price_vnd = body.cost_price_vnd;
    recalculated.total_cost_vnd = quantity * body.cost_price_vnd;
  }

  const result = await updateOrderPaymentAndStatus(id, accountId, {
    customer_id: body.customer_id,
    status: body.status as OrderStatus | undefined,
    total_paid: body.total_paid,
    payment_method: legacyPaymentMethod ?? undefined,
    payment_terms: normalizedPaymentTerms ?? undefined,
    payment_source_id: body.payment_source_id,
    sales_channel_id: body.sales_channel_id,
    sales_note: body.sales_note,
    expires_at: body.expires_at,
    created_at: body.created_at,
    proof_image_urls: body.proof_image_urls,
    ...recalculated,
    items: body.items,
  });

  if (result && oldStatus !== body.status && body.status) {
    // Log to both audit trail and activity log in parallel
    await Promise.all([
      createOrderStatusHistory({
        order_id: id,
        old_status: oldStatus,
        new_status: body.status,
        changed_by: user.email,
        change_reason: body.sales_note ?? null,
        metadata: {
          total_paid: body.total_paid ?? null,
          payment_method: body.payment_method ?? null,
        },
      }),
      createActivityLog({
        account_id: accountId,
        action_type: 'ORDER_UPDATED',
        customer_id: result.customer_id,
        order_id: id,
        details: {
          old_status: oldStatus ?? null,
          new_status: body.status ?? null,
          total_paid: body.total_paid ?? null,
          payment_method: legacyPaymentMethod ?? null,
          payment_terms: normalizedPaymentTerms ?? null,
        },
      }),
    ]);
  }

  return NextResponse.json({ data: withFinancialSummary(result) });
}));

export const DELETE = withErrorHandler(withAccount<{ id: string }>(async (_request, { accountId, params }) => {
  const { id } = await params;
  const user = await resolveUser(_request, accountId);
  if (!user) {
    return NextResponse.json({ error: "Không thể xác thực người dùng" }, { status: 401 });
  }
  if (!hasPermission(user.role, "order:delete")) {
    return NextResponse.json({ error: "Bạn không có quyền xoá đơn hàng" }, { status: 403 });
  }
  // Deallocate before deleting to release any allocated slots/keys
  await deallocateOrder(id, accountId);
  await deleteOrder(id, accountId);
  return NextResponse.json({ success: true });
}));

