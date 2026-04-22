import { NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getOrderStatusHistory } from "@/lib/supabase/repositories/order-status-history.repo";
import { getOrderById } from "@/lib/supabase/repositories/orders.repo";

/**
 * GET /api/orders/[id]/status-history
 * Returns the full audit trail of status transitions for an order.
 * Used by the Order Status Timeline UI component.
 */
export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request, { accountId, params }) => {
    const { id } = await params;

    // Verify the order belongs to this account before returning history
    const order = await getOrderById(id, accountId);
    if (!order) {
      return NextResponse.json({ error: "Đơn hàng không tồn tại" }, { status: 404 });
    }

    const history = await getOrderStatusHistory(id);

    return NextResponse.json({ data: history });
  })
);
