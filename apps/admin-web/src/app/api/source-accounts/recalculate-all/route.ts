// /api/source-accounts/recalculate-all — Batch recalculate slots for all source accounts
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { recalculateAllSourceAccountsForAccount } from "@/domains/source-accounts";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export const POST = withErrorHandler(
  withAccount(async (_request: NextRequest, { accountId }) => {
    const result = await recalculateAllSourceAccountsForAccount(accountId);
    return createSuccessResponse(result);
  })
);
