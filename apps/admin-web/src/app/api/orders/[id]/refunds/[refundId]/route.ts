import { NextRequest, NextResponse } from "next/server";
import {
  updateRefundStatus,
  getRefundById,
  type RefundStatus,
} from "@/lib/supabase/repositories/refund-requests.repo";
import {
  createOrderStatusHistory,
  getOrderStatusHistory,
} from "@/lib/supabase/repositories/order-status-history.repo";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { deallocateOrder } from "@/lib/services/allocation.service";
import { syncOrderToPremium } from "@/lib/services/premium-order-sync.service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { formatMoney } from "@/lib/utils";
import { hasPermission, resolveUser } from "@/lib/api/rbac";

// Valid transitions for refund status
const VALID_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  requested: ["approved", "rejected", "cancelled"],
  approved: ["processing", "rejected", "cancelled"],
  processing: ["completed", "rejected", "cancelled"],
  completed: ["cancelled"],
  rejected: [],
  cancelled: [],
};

const VALID_STATUSES = new Set<string>([
  "requested", "approved", "processing", "completed", "rejected", "cancelled",
]);

function findLatestRefundHistory(
  history: Array<{ new_status: string; old_status: string | null; metadata: Record<string, unknown> }>,
  refundId: string,
) {
  for (const entry of [...history].reverse()) {
    if (entry.new_status !== "refunded") continue;
    const refundHistoryId = entry.metadata.refund_id;
    if (refundHistoryId === refundId) {
      return entry;
    }
  }
  return null;
}

/**
 * PATCH /api/orders/[id]/refunds/[refundId]
 * Update refund status (approve, process, complete, reject).
 */
export const PATCH = withErrorHandler(
  withAccount<{ id: string; refundId: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id, refundId } = await params;
    const user = await resolveUser(request, accountId);
    if (!user) {
      return NextResponse.json({ error: "Không thể xác thực người dùng" }, { status: 401 });
    }
    if (!hasPermission(user.role, "payment:refund")) {
      return NextResponse.json({ error: "Bạn không có quyền cập nhật hoàn tiền" }, { status: 403 });
    }
    const body = await request.json() as {
      status?: string;
      admin_note?: string;
    };

    // Input validation
    if (!body.status || !VALID_STATUSES.has(body.status)) {
      return NextResponse.json(
        { error: `Trạng thái không hợp lệ. Cho phép: ${[...VALID_STATUSES].join(", ")}` },
        { status: 400 }
      );
    }
    const newStatus = body.status as RefundStatus;

    // 1. Verify order ownership
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .eq("id", id)
      .eq("account_id", accountId)
      .single();
    if (orderError || !order) {
      return NextResponse.json({ error: "Đơn hàng không tồn tại" }, { status: 404 });
    }

    // 2. Fetch current refund
    const current = await getRefundById(refundId);
    if (!current || current.order_id !== id) {
      return NextResponse.json({ error: "Yêu cầu hoàn tiền không tồn tại" }, { status: 404 });
    }

    // 3. Validate transition
    const allowed = VALID_TRANSITIONS[current.status];
    if (!allowed?.includes(newStatus)) {
      return NextResponse.json({
        error: `Không thể chuyển từ "${current.status}" → "${newStatus}"`,
      }, { status: 422 });
    }

    let orderHistorySnapshot: { old_status: string | null; metadata: Record<string, unknown> } | null = null;

    // 4. If completed, deallocate inventory first, then update order: status → refunded AND deduct total_paid
    if (newStatus === "completed") {
      const actualOldStatus = order.status;
      const refundAmount = current.refundable_amount_vnd;

      // Fetch current total_paid to calculate new value
      const { data: orderData } = await supabaseAdmin
        .from("orders")
        .select("total_paid")
        .eq("id", id)
        .single();
      const currentPaid = Number(orderData?.total_paid ?? 0);
      const newTotalPaid = Math.max(0, currentPaid - refundAmount);

      await deallocateOrder(id, accountId);

      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({
          status: "refunded",
          total_paid: newTotalPaid,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("account_id", accountId);

      if (updateError) {
        throw new Error(`Không thể cập nhật đơn hàng sau hoàn tiền: ${updateError.message}`);
      }

      await createOrderStatusHistory({
        order_id: id,
        old_status: actualOldStatus,
        new_status: "refunded",
        changed_by: user.email,
        change_reason: `Hoàn tiền ${formatMoney(refundAmount)} (${current.refund_mode}) — total_paid: ${formatMoney(currentPaid)} → ${formatMoney(newTotalPaid)}`,
        metadata: {
          refund_id: refundId,
          refund_mode: current.refund_mode,
          refund_amount_vnd: refundAmount,
          previous_status: actualOldStatus,
          previous_total_paid: currentPaid,
          new_total_paid: newTotalPaid,
        },
      });

      orderHistorySnapshot = {
        old_status: actualOldStatus,
        metadata: {
          refund_id: refundId,
          refund_mode: current.refund_mode,
          refund_amount_vnd: refundAmount,
          previous_status: actualOldStatus,
          previous_total_paid: currentPaid,
          new_total_paid: newTotalPaid,
        },
      };
    }

    // 4b. If cancelled from completed → revert order using status history snapshot
    if (newStatus === "cancelled" && current.status === "completed") {
      const refundAmount = current.refundable_amount_vnd;
      const history = await getOrderStatusHistory(id);
      const latestRefundHistory = findLatestRefundHistory(history, refundId);
      const restoredStatus = (latestRefundHistory?.metadata.previous_status as string | undefined) ?? latestRefundHistory?.old_status ?? "pending_payment";

      // Fetch current total_paid to calculate restored value
      const { data: orderData } = await supabaseAdmin
        .from("orders")
        .select("total_paid")
        .eq("id", id)
        .single();
      const currentPaid = Number(orderData?.total_paid ?? 0);
      const restoredPaid = Number(latestRefundHistory?.metadata.previous_total_paid ?? currentPaid + refundAmount);

      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({
          status: restoredStatus,
          total_paid: restoredPaid,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("account_id", accountId);

      if (updateError) {
        throw new Error(`Không thể khôi phục đơn hàng sau huỷ hoàn tiền: ${updateError.message}`);
      }

      await createOrderStatusHistory({
        order_id: id,
        old_status: "refunded",
        new_status: restoredStatus,
        changed_by: user.email,
        change_reason: `Huỷ hoàn tiền ${formatMoney(refundAmount)} — total_paid: ${formatMoney(currentPaid)} → ${formatMoney(restoredPaid)}`,
        metadata: {
          refund_id: refundId,
          restored_from_status: latestRefundHistory?.old_status ?? null,
          restored_total_paid: restoredPaid,
        },
      });

      orderHistorySnapshot = {
        old_status: "refunded",
        metadata: {
          refund_id: refundId,
          restored_from_status: latestRefundHistory?.old_status ?? null,
          restored_total_paid: restoredPaid,
        },
      };
    }

    const updateArgs: { admin_note?: string; approved_by?: string; processed_by?: string } = {
      admin_note: body.admin_note,
    };
    if (newStatus === "approved") {
      updateArgs.approved_by = user.email;
    }
    if (newStatus === "completed" || newStatus === "rejected" || newStatus === "cancelled" || newStatus === "processing") {
      updateArgs.processed_by = user.email;
    }

    const updated = await updateRefundStatus(refundId, newStatus, updateArgs);
    if (!updated) {
      throw new Error("Không thể cập nhật trạng thái hoàn tiền");
    }

    // 6. Log activity
    await createActivityLog({
      account_id: accountId,
      action_type: `REFUND_${newStatus.toUpperCase()}`,
      customer_id: current.customer_id ?? undefined,
      order_id: id,
      details: {
        refund_id: refundId,
        new_status: newStatus,
        admin_note: body.admin_note ?? null,
        refundable_amount: current.refundable_amount_vnd,
        order_history: orderHistorySnapshot,
      },
    });

    let premiumSync: { success: boolean; detail?: unknown; error?: string } | undefined;
    if (newStatus === "completed" || (newStatus === "cancelled" && current.status === "completed")) {
      try {
        premiumSync = {
          success: true,
          detail: await syncOrderToPremium(accountId, id, { syncedBy: user.email }),
        };
      } catch (syncError) {
        console.error("[Refund PATCH] premium sync failed:", syncError);
        premiumSync = {
          success: false,
          error: syncError instanceof Error ? syncError.message : "Premium sync failed",
        };
      }
    }

    return NextResponse.json({ data: updated, premium_sync: premiumSync });
  })
);
