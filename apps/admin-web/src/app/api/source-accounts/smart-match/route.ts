import type { NextRequest } from "next/server";
import { scanSmartMatchesForAccount } from "@/domains/source-accounts";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (_request: NextRequest, { accountId }) => {
    const suggestions = await scanSmartMatchesForAccount(accountId);
    return createSuccessResponse(suggestions);
  }),
);
