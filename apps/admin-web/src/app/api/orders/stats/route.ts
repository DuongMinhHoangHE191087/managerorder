import { NextRequest, NextResponse } from "next/server";
import { getOrdersStats } from "@/lib/supabase/repositories/orders.repo";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const customerId = searchParams.get("customer_id") || undefined;
    const date_from = searchParams.get("date_from") || undefined;
    const date_to = searchParams.get("date_to") || undefined;

    const stats = await getOrdersStats(accountId, {
      search,
      status,
      customerId,
      date_from,
      date_to,
    });

    return NextResponse.json({ data: stats });
  })
);
