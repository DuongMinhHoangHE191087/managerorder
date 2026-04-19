import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { scanSmartMatches } from "@/lib/services/smart-matching.service";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (_request: NextRequest, { accountId }) => {
    const suggestions = await scanSmartMatches(accountId);
    return createSuccessResponse(suggestions);
  })
);
