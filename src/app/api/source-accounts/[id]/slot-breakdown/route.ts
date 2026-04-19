// /api/source-accounts/[id]/slot-breakdown — Get detailed slot breakdown
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { getSlotBreakdown } from "@/lib/supabase/repositories/source-accounts.repo";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const breakdown = await getSlotBreakdown(id, accountId);
    return createSuccessResponse(breakdown);
  })
);
