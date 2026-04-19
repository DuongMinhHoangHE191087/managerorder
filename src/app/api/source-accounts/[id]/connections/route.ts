import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { getSourceAccountConnections } from "@/lib/supabase/repositories/source-accounts.repo";
import type { NextRequest } from "next/server";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const connections = await getSourceAccountConnections(id, accountId);
    return createSuccessResponse(connections);
  })
);
