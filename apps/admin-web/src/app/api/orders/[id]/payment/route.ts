import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { createPayment } from "@/lib/supabase/repositories/payments.repo";
import { createOrderStatusHistory } from "@/lib/supabase/repositories/order-status-history.repo";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createErrorResponse } from "@/lib/api/with-error-handler";
import { hasPermission, resolveUser } from "@/lib/api/rbac";
import { normalizePaymentTerms, toLegacyPaymentMethod } from "@/lib/domain/financial";
import { formatMoney } from "@/lib/utils";

/**
 * POST /api/orders/[id]/payment
 *
 * Records a payment against an order.
 *
 * Key invariant: reconciliation is ALWAYS done against `order.total_amount_vnd`,
 * which is frozen at order-creation time.  Changing the product's current price
 * NEVER affects this calculation.
 */
export const POST = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const user = await resolveUser(request, accountId);
    if (!user) {
      return createErrorResponse("Không thể xác thực người dùng", "UNAUTHORIZED", 401);
    }
    if (!hasPermission(user.role, "payment:record")) {
      return createErrorResponse("Bạn không có quyền ghi nhận thanh toán", "FORBIDDEN", 403);
    }
    const body = await request.json() as {
      amount: number;
      payment_source?: string;
      payment_source_id?: string;
      payment_terms?: string;
      payment_method?: string;
      proof_image_url?: string;
      note?: string;
    };

    if (!body.amount || body.amount <= 0) {
      return createErrorResponse("Số tiền thanh toán phải lớn hơn 0", "INVALID_AMOUNT", 400);
    }

    const normalizedPaymentTerms = body.payment_terms !== undefined
      ? normalizePaymentTerms(body.payment_terms)
      : null;

    if (body.payment_terms !== undefined && !normalizedPaymentTerms) {
      return createErrorResponse("Điều khoản thanh toán không hợp lệ", "INVALID_PAYMENT_TERMS", 400);
    }

    const orderPaymentMethod = normalizedPaymentTerms
      ? toLegacyPaymentMethod(normalizedPaymentTerms)
      : null;
    const resolvedPaymentSourceId = body.payment_source_id ?? body.payment_source ?? null;
    const paymentRecordMethod = normalizedPaymentTerms
      ? orderPaymentMethod
      : body.payment_method ?? null;

    // 1. Fetch order — use ONLY the frozen snapshot fields for reconciliation
    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, status, total_amount_vnd, total_paid, unit_price_vnd, product_name_snapshot, quantity, customer_id")
      .eq("id", id)
      .eq("account_id", accountId)
      .single();
    if (fetchError || !order) {
      console.error("[Payment] Order not found:", id, fetchError?.message);
      return createErrorResponse("Đơn hàng không tồn tại", "ORDER_NOT_FOUND", 404);
    }

    if (order.status === "refunded") {
      return createErrorResponse("Đơn hàng đã được hoàn tiền, không thể ghi nợ thêm", "ORDER_REFUNDED", 409);
    }

    // total_amount_vnd = unit_price_vnd × quantity — FROZEN at creation, never
    // recalculated from the live product price.
    const frozenTotal = Number(order.total_amount_vnd);
    const currentPaid = Number(order.total_paid ?? 0);
    const remaining = frozenTotal - currentPaid;

    if (remaining <= 0) {
      return createErrorResponse(
        "Đơn hàng đã được thanh toán đầy đủ",
        "ALREADY_PAID",
        409,
        { total: frozenTotal, paid: currentPaid, remaining: 0 },
      );
    }

    if (body.amount > remaining) {
      return createErrorResponse(
        `Số tiền vượt quá số còn lại (${formatMoney(remaining)})`,
        "AMOUNT_EXCEEDS_REMAINING",
        422,
        { total: frozenTotal, paid: currentPaid, remaining, attempted: body.amount },
      );
    }

    const newPaid = currentPaid + body.amount;
    const isFullyPaid = newPaid >= frozenTotal;

    // 2. Update order atomically — use optimistic locking to prevent race condition
    // The WHERE clause ensures no concurrent payment has changed total_paid
    const updateData: Record<string, unknown> = {
      total_paid: newPaid,
      updated_at: new Date().toISOString(),
    };
    if (normalizedPaymentTerms) {
      updateData.payment_terms = normalizedPaymentTerms;
      updateData.payment_method = orderPaymentMethod;
    }
    if (body.payment_source_id !== undefined || body.payment_source !== undefined) {
      updateData.payment_source_id = resolvedPaymentSourceId;
    }
    if (isFullyPaid && order.status === "pending_payment") {
      updateData.status = "paid";
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updateData)
      .eq("id", id)
      .eq("account_id", accountId)
      .eq("total_paid", currentPaid) // Optimistic lock: fail if another payment modified total_paid
      .select()
      .single();
    
    if (updateError || !updated) {
      // If no row was updated, a concurrent payment changed total_paid → conflict
      console.error("[Payment] Optimistic lock conflict:", id, updateError?.message);
      return createErrorResponse(
        "Thanh toán xung đột — vui lòng thử lại. Một giao dịch khác đã được ghi nhận.",
        "PAYMENT_CONFLICT",
        409,
      );
    }

    // 3. Create payment record first so audit logs can reference the exact payment id.
    const paymentRecord = await createPayment(accountId, {
      order_id: id,
      amount: body.amount,
      payment_method: paymentRecordMethod,
      payment_source_id: resolvedPaymentSourceId,
      proof_image_url: body.proof_image_url ?? null,
      note: body.note ?? null,
      paid_by: user.email,
    });

    await Promise.all([
      createActivityLog({
        account_id: accountId,
        action_type: "PAYMENT_ADDED",
        customer_id: order.customer_id,
        order_id: id,
        created_by: user.displayName ?? user.email,
        details: {
          amount: body.amount,
          payment_method: paymentRecordMethod,
          payment_terms: normalizedPaymentTerms,
          payment_source_id: resolvedPaymentSourceId,
          note: body.note || null,
          before_snapshot: {
            total_paid: currentPaid,
            total_amount_vnd: frozenTotal,
            remaining,
            status: order.status,
          },
          after_snapshot: {
            total_paid: newPaid,
            total_amount_vnd: frozenTotal,
            remaining: Math.max(frozenTotal - newPaid, 0),
            status: isFullyPaid && order.status === "pending_payment" ? "paid" : order.status,
          },
          payment_record_id: paymentRecord?.id ?? null,
          fully_paid: isFullyPaid,
        },
      }),
      // Log status history if auto-transitioned
      isFullyPaid && order.status === "pending_payment"
        ? createOrderStatusHistory({
            order_id: id,
            old_status: "pending_payment",
            new_status: "paid",
            change_reason: `Thanh toán đủ (${formatMoney(newPaid)})`,
          })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      data: updated,
      payment: {
        ...paymentRecord,
        new_total_paid: newPaid,
        remaining: Math.max(frozenTotal - newPaid, 0),
        fully_paid: isFullyPaid,
        order_unit_price: order.unit_price_vnd,
        order_product_name: order.product_name_snapshot,
        order_quantity: order.quantity,
        order_total: frozenTotal,
      },
    });
  })
);
