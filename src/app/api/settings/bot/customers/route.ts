import { withAccount } from "@/lib/api/with-account";
import { createSuccessResponse, withErrorHandler } from "@/lib/api/with-error-handler";
import { findBotCustomerMatchCandidates } from "@/lib/bot-manager/bot-contacts";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const query = request.nextUrl.searchParams.get("q") ?? "";
    const data = await findBotCustomerMatchCandidates(accountId, query);
    return createSuccessResponse(data);
  }),
);
