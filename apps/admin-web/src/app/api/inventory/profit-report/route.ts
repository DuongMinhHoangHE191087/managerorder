// /api/inventory/profit-report — Profit report per source account
import { NextRequest, NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getInventoryProfitReport } from "@/domains/inventory";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (_request: NextRequest, { accountId }) => {
    return NextResponse.json(await getInventoryProfitReport(accountId));
  }),
);
