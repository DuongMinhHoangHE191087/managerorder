import { NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { recalculateCustomersRfmForAccount } from "@/domains/customers";

export const dynamic = "force-dynamic";

export const POST = withErrorHandler(
  withAccount(async (_request, { accountId }) => {
    const data = await recalculateCustomersRfmForAccount(accountId);
    return NextResponse.json(data);
  })
);
