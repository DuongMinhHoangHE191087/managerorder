import { NextResponse } from "next/server";
import { getPaymentsByOrder } from "@/lib/supabase/repositories/payments.repo";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";

/**
 * GET /api/orders/[id]/payments
 * Lists all individual payment records for an order.
 */
export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request, { accountId, params }) => {
    const { id } = await params;

    // getPaymentsByOrder now enforces tenant isolation internally
    const payments = await getPaymentsByOrder(id, accountId);
    return NextResponse.json({ data: payments });
  })
);

