// /api/source-accounts/[id]/connections-enriched — Get enriched connections
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { getConnectionsEnriched } from "@/lib/supabase/repositories/source-accounts.repo";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const connections = await getConnectionsEnriched(id, accountId);
    return createSuccessResponse(connections);
  })
);
