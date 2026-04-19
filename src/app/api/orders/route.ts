import { NextRequest, NextResponse } from "next/server";
import { getOrdersPaginated } from "@/lib/supabase/repositories/orders.repo";
import { createOrderInputSchema } from "@/lib/domain/schemas";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { createOrderWithItems } from "@/lib/services/order.service";
import { getPaginationParams } from "@/lib/utils/api-helpers";
import { mapLegacyStatusAlias, withFinancialSummary } from "@/lib/domain/financial";
import { requirePermissions } from "@/lib/api/rbac";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);
    
    // Support legacy customer_id filter as well
    const customerId = searchParams.get("customer_id") || undefined;
    
    // Pagination params
    const { page, limit } = getPaginationParams(searchParams);
    const search = searchParams.get("search") || undefined;
    const rawStatus = searchParams.get("status") || undefined;
    const statusFilter = mapLegacyStatusAlias(rawStatus);
    const paymentState = searchParams.get("payment_state") || statusFilter.paymentState;
    const date_from = searchParams.get("date_from") || undefined;
    const date_to = searchParams.get("date_to") || undefined;

    const result = await getOrdersPaginated(accountId, {
      page,
      limit,
      search,
      status: statusFilter.status ?? rawStatus,
      paymentState,
      customerId,
      date_from,
      date_to,
    });

    const decoratedRows = result.data
      .map((row) => withFinancialSummary(row))
      .filter((row) => !paymentState || row.payment_state === paymentState);

    return NextResponse.json({ 
        data: decoratedRows,
        meta: {
            count: paymentState ? decoratedRows.length : result.count,
            page: result.page,
            limit: result.limit,
            totalPages: paymentState ? Math.ceil(decoratedRows.length / result.limit) : result.totalPages
        }
    });
  })
);

export const POST = withErrorHandler(
  withAccount(requirePermissions(["order:create"])(async (request: NextRequest, { accountId }) => {
    // 1. Zod Validation Input
    const body = await request.json();
    const validatedData = createOrderInputSchema.parse(body);

    // 2. Delegate to service layer
    try {
      const result = await createOrderWithItems(accountId, validatedData);
      return NextResponse.json(
        {
          data: {
            ...withFinancialSummary(result.order),
            items: result.items,
            ...(result.warning ? { warning: result.warning } : {}),
          },
        },
        { status: 201 }
      );
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw err;
    }
  }))
);
