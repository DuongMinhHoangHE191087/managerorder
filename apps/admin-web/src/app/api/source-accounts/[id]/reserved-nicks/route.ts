import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { addReservedNickForSourceAccount, removeReservedNickForSourceAccount } from "@/domains/source-accounts";
import type { NextRequest } from "next/server";

// POST /api/source-accounts/[id]/reserved-nicks — add a nick
export const POST = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const { nick } = await request.json() as { nick: string };
    const updated = await addReservedNickForSourceAccount(id, accountId, nick);
    return createSuccessResponse(updated);
  })
);

// DELETE /api/source-accounts/[id]/reserved-nicks — remove a nick
export const DELETE = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const { nick } = await request.json() as { nick: string };
    const updated = await removeReservedNickForSourceAccount(id, accountId, nick);
    return createSuccessResponse(updated);
  })
);
