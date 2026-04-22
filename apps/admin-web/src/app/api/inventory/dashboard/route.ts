// ============================================================
// INVENTORY DASHBOARD API — Aggregated metrics
// Returns KPI data for source accounts + license keys
// ============================================================

import { NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getInventoryDashboardMetrics } from "@/domains/inventory";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (_request, { accountId }) => {
    return NextResponse.json(await getInventoryDashboardMetrics(accountId));
  }),
);
