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
import { updateOrderInputSchema } from "@/lib/domain/schemas";
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
  const includeDeleted = new URL(_request.url).searchParams.get("include_deleted") === "1";
  const order = await getOrderWithItems(id, accountId, { includeDeleted });
  if (!order) return NextResponse.json({ error: "Đơn hàng không tồn tại" }, { status: 404 });
  return NextResponse.json({ data: withFinancialSummary(order) });
}));

export const PUT = withErrorHandler(withAccount<{ id: string }>(async (request, { accountId, params }) => {
  const { id } = await params;

  // BUG #6 FIX: Validate body via Zod instead of raw inline interface cast
  const rawBody = await request.json() as unknown;
  const parseResult = updateOrderInputSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Dữ liệu đầu vào không hợp lệ", details: parseResult.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const body = parseResult.data;

  
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
    payment_source_id: body.payment_source_id ?? undefined,
    sales_channel_id: body.sales_channel_id ?? undefined,
    sales_note: body.sales_note ?? undefined,
    expires_at: body.expires_at ?? undefined,
    created_at: body.created_at,
    proof_image_urls: body.proof_image_urls,
    ...recalculated,
    items: body.items,
  });

  if (result) {
    const sideEffects: Array<Promise<unknown>> = [
      createActivityLog({
        account_id: accountId,
        action_type: 'ORDER_UPDATED',
        customer_id: result.customer_id,
        order_id: id,
        created_by: user.displayName ?? user.email,
        details: {
          changed_fields: Object.keys(body),
          before_snapshot: {
            status: oldStatus ?? null,
            total_paid: order.total_paid ?? null,
            payment_terms: order.payment_terms ?? null,
            payment_source_id: order.payment_source_id ?? null,
            sales_channel_id: order.sales_channel_id ?? null,
            expires_at: order.expires_at ?? null,
            unit_price_vnd: order.unit_price_vnd ?? null,
            cost_price_vnd: order.cost_price_vnd ?? null,
            sales_note: order.sales_note ?? null,
          },
          after_snapshot: {
            status: body.status ?? result.status ?? null,
            total_paid: body.total_paid ?? result.total_paid ?? null,
            payment_method: legacyPaymentMethod ?? result.payment_method ?? null,
            payment_terms: normalizedPaymentTerms ?? result.payment_terms ?? null,
            payment_source_id: body.payment_source_id ?? result.payment_source_id ?? null,
            sales_channel_id: body.sales_channel_id ?? result.sales_channel_id ?? null,
            expires_at: body.expires_at ?? result.expires_at ?? null,
            unit_price_vnd: recalculated.unit_price_vnd ?? result.unit_price_vnd ?? null,
            cost_price_vnd: recalculated.cost_price_vnd ?? result.cost_price_vnd ?? null,
            sales_note: body.sales_note ?? result.sales_note ?? null,
          },
          item_updates: body.items ?? [],
        },
      }),
    ];

    if (oldStatus !== body.status && body.status) {
      sideEffects.push(
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
      );
    }

    await Promise.all(sideEffects);
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
  const order = await getOrderWithItems(id, accountId);
  if (!order) {
    return NextResponse.json({ error: "Đơn hàng không tồn tại" }, { status: 404 });
  }
  // Deallocate before deleting to release any allocated slots/keys
  await deallocateOrder(id, accountId);
  await deleteOrder(id, accountId);
  await createActivityLog({
    account_id: accountId,
    action_type: "ORDER_DELETED",
    customer_id: order.customer_id,
    order_id: id,
    created_by: user.displayName ?? user.email,
    details: {
      before_snapshot: {
        status: order.status,
        total_amount_vnd: order.total_amount_vnd,
        total_paid: order.total_paid,
        expires_at: order.expires_at,
      },
    },
  });
  return NextResponse.json({ success: true });
}));

