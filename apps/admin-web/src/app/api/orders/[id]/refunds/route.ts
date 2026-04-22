import { NextRequest, NextResponse } from "next/server";
import {
  createOrderRefundRequestForAccount,
  listOrderRefundsForAccount,
} from "@/domains/orders";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { hasPermission, resolveUser } from "@/lib/api/rbac";
import { isApplicationError } from "@/lib/utils/errors";

/**
 * GET /api/orders/[id]/refunds
 * List all refund requests for an order.
 */
export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request, { accountId, params }) => {
    const { id } = await params;
    const refunds = await listOrderRefundsForAccount(id, accountId);
    if (!refunds) {
      return NextResponse.json({ error: "Đơn hàng không tồn tại" }, { status: 404 });
    }

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

    try {
      const body = await request.json() as {
        refund_mode?: "full" | "pro_rata";
        consumed_days?: number;
        total_days?: number;
        reason?: string;
      };
      const refund = await createOrderRefundRequestForAccount({
        accountId,
        orderId: id,
        userEmail: user.email,
        ...body,
      });

      if (!refund) {
        return NextResponse.json({ error: "Đơn hàng không tồn tại" }, { status: 404 });
      }

      return NextResponse.json({ data: refund }, { status: 201 });
    } catch (error) {
      if (isApplicationError(error)) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode });
      }
      throw error;
    }
  })
);
