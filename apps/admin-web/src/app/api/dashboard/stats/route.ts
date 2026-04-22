import { NextRequest } from "next/server";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { withAccount } from "@/lib/api/with-account";
import { getDashboardStats } from "@/domains/dashboard";
import type { DashboardStats } from "@/shared/types/dashboard";

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);
    const requestedDays = Number.parseInt(searchParams.get("days") || "30", 10);
    const days = Number.isFinite(requestedDays) && requestedDays > 0 ? Math.min(requestedDays, 365) : 30;
    const stats = await getDashboardStats(accountId, days);
    return createSuccessResponse(stats as DashboardStats);
  })
);
