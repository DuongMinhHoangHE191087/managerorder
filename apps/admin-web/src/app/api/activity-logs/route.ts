import { NextRequest, NextResponse } from "next/server";
import { getActivityLogsPaginated } from "@/lib/supabase/repositories/activity-logs.repo";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    // 1. Get URL parameters 
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const search = searchParams.get("search") || undefined;
    const actionType = searchParams.get("actionType") || undefined;
    
    // Entity filters
    const customerId = searchParams.get("customerId") || undefined;
    const orderId = searchParams.get("orderId") || undefined;
    const sourceAccountId = searchParams.get("sourceAccountId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    let page = 1;
    let limit = 20;
    
    if (pageParam && !isNaN(Number(pageParam))) {
      page = Number(pageParam);
    }
    if (limitParam && !isNaN(Number(limitParam))) {
      limit = Number(limitParam);
    }

    // 2. Fetch data
    const result = await getActivityLogsPaginated(accountId, { 
      page, 
      limit, 
      search, 
      actionType,
      customerId,
      orderId,
      sourceAccountId,
      startDate,
      endDate
    });

    // 3. Return JSON format { data, meta }
    return NextResponse.json(result);
  })
);
