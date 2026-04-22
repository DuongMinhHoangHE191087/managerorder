import type { NextRequest } from "next/server";
import { searchUnconnectedSourceAccountsForAccount } from "@/domains/source-accounts";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (!query.trim()) {
      return createSuccessResponse([]);
    }

    const results = await searchUnconnectedSourceAccountsForAccount(id, accountId, query);
    return createSuccessResponse(results);
  }),
);
