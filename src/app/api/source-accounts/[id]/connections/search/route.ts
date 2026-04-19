import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { searchUnconnectedByNickOrNote } from "@/lib/services/smart-matching.service";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (!query.trim()) {
      return createSuccessResponse([]);
    }

    const results = await searchUnconnectedByNickOrNote(id, accountId, query);
    return createSuccessResponse(results);
  })
);
