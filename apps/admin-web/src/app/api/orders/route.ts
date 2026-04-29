import { NextRequest, NextResponse } from "next/server";
import {
  createOrderInputSchema,
  createOrderWithItems,
  getOrdersPaginated,
  mapLegacyStatusAlias,
  withFinancialSummary,
} from "@/domains/orders";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getPaginationParams } from "@/lib/utils/api-helpers";
import { requirePermissions } from "@/lib/api/rbac";
import { createOrderStatusHistory } from "@/lib/supabase/repositories/order-status-history.repo";

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

    const decoratedRows = result.data.map((row) => withFinancialSummary(row));

    return NextResponse.json({ 
        data: decoratedRows,
        meta: {
            count: result.count,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages
        }
    });
  })
);

export const POST = withErrorHandler(
  withAccount(requirePermissions(["order:create"])(async (request: NextRequest, { accountId, user }) => {
    // 1. Zod Validation Input
    const body = await request.json();
    const validatedData = createOrderInputSchema.parse(body);

    // 2. Delegate to service layer
    try {
      const result = await createOrderWithItems(accountId, {
        ...validatedData,
        createdBy: user.displayName ?? user.email,
      });
      await createOrderStatusHistory({
        order_id: result.order.id,
        old_status: null,
        new_status: result.order.status,
        changed_by: user.displayName ?? user.email,
        change_reason: "Tạo đơn hàng mới",
        metadata: {
          source: "admin-web",
          items_count: result.items.length,
          payment_terms: validatedData.paymentTerms ?? validatedData.paymentMethod ?? null,
        },
      });

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
