import { NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCustomerDebtSummaryForAccount } from "@/domains/customers";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (_request, { accountId }) => {
    const data = await getCustomerDebtSummaryForAccount(accountId);
    return NextResponse.json(data);
  })
);
