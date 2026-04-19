import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createRefundRequest,
  getRefundsByOrder,
} from "@/lib/supabase/repositories/refund-requests.repo";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { calculateRefund } from "@/lib/domain/refund-policy";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { hasPermission, resolveUser } from "@/lib/api/rbac";
import type { RefundMode } from "@/lib/domain/types";
import { loadRowsByIds } from "@/lib/supabase/relation-fallback";
import {
  ensureOrderRefundRequestAllowed,
  normalizeRefundCalculationInput,
} from "@/lib/domain/sales-workflow-guards";

/**
 * GET /api/orders/[id]/refunds
 * List all refund requests for an order.
 */
export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request, { accountId, params }) => {
    const { id } = await params;

    // Verify order ownership
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("id", id)
      .eq("account_id", accountId)
      .single();
    if (error || !order) {
      return NextResponse.json({ error: "Đơn hàng không tồn tại" }, { status: 404 });
    }

    const refunds = await getRefundsByOrder(id);
    return NextResponse.json({ data: refunds });
  })
);

/**
 * POST /api/orders/[id]/refunds
 * Create a new refund request with auto-calculated pro-rata amount.
 */
export const POST = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const user = await resolveUser(request, accountId);
    if (!user) {
      return NextResponse.json({ error: "Không thể xác thực người dùng" }, { status: 401 });
    }
    if (!hasPermission(user.role, "payment:refund")) {
      return NextResponse.json({ error: "Bạn không có quyền tạo yêu cầu hoàn tiền" }, { status: 403 });
    }
    const body = await request.json() as {
      refund_mode?: RefundMode;
      consumed_days?: number;
      total_days?: number;
      reason?: string;
    };

    // 1. Fetch order data and load product duration info separately
    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, status, total_amount_vnd, total_paid, customer_id, created_at, product_id")
      .eq("id", id)
      .eq("account_id", accountId)
      .single();
    if (fetchError || !order) {
      return NextResponse.json({ error: "Đơn hàng không tồn tại" }, { status: 404 });
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
          accountId,
          [order.product_id],
          "id, duration_value, duration_type",
        )
      : new Map<string, { id: string; duration_value: number | null; duration_type: string | null }>();

    const paidAmount = Number(order.total_paid ?? 0);

    // 2. Auto-calculate consumed_days and total_days if not provided
    const productInfo = order.product_id ? productMap.get(order.product_id) ?? null : null;

    let totalDays = body.total_days ?? 30;
    if (!body.total_days && productInfo?.duration_value) {
      const dv = productInfo.duration_value;
      const dt = productInfo.duration_type ?? "days";
      totalDays = dt === "months" ? dv * 30 : dt === "years" ? dv * 365 : dv;
    }

    let consumedDays = body.consumed_days ?? 0;
    if (body.consumed_days === undefined && order.created_at) {
      const orderDate = new Date(order.created_at);
      const now = new Date();
      consumedDays = Math.max(0, Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)));
    }

    // 3. Calculate refund — default to pro-rata when mode is omitted
    const mode = body.refund_mode ?? "pro_rata";
    const normalizedRefundInput = normalizeRefundCalculationInput({
      refundMode: mode,
      consumedDays,
      totalDays,
    });
    const refundCalc = calculateRefund({
      paidAmountVnd: paidAmount,
      consumedDays: normalizedRefundInput.consumedDays,
      totalDays: normalizedRefundInput.totalDays,
      mode: normalizedRefundInput.refundMode,
    });

    // 4. Create refund request
    const refund = await createRefundRequest({
      order_id: id,
      customer_id: order.customer_id,
      paid_amount_vnd: paidAmount,
      consumed_days: normalizedRefundInput.consumedDays,
      total_days: normalizedRefundInput.totalDays,
      refund_mode: normalizedRefundInput.refundMode,
      refundable_amount_vnd: refundCalc.refundableAmountVnd,
      reason: body.reason ?? null,
      requested_by: user.email,
    });

    // 5. Log activity
    await createActivityLog({
      account_id: accountId,
      action_type: "REFUND_REQUESTED",
      customer_id: order.customer_id,
      order_id: id,
      details: {
        refund_id: refund.id,
        mode: normalizedRefundInput.refundMode,
        consumed_ratio: refundCalc.consumedRatio,
        refundable_amount: refundCalc.refundableAmountVnd,
        reason: body.reason ?? null,
      },
    });

    return NextResponse.json({ data: refund }, { status: 201 });
  })
);
