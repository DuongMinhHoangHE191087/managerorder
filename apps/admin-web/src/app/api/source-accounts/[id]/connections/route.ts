import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { getSourceAccountConnectionsForAccount } from "@/domains/source-accounts";
import type { NextRequest } from "next/server";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const connections = await getSourceAccountConnectionsForAccount(id, accountId);
    return createSuccessResponse(connections);
  })
);
