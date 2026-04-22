import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { connectSourceAccountToOrderItemForAccount } from "@/domains/source-accounts";
import type { NextRequest } from "next/server";

export const POST = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id: sourceAccountId } = await params;
    const body = await request.json() as { orderItemId: string; quantity: number };

    await connectSourceAccountToOrderItemForAccount(sourceAccountId, body.orderItemId, accountId);

    return createSuccessResponse({ success: true });
  })
);
