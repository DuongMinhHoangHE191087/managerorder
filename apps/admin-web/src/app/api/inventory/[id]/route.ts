// /api/inventory/[id]/route.ts — Delete a specific license key
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { deleteInventoryKeyForAccount } from "@/domains/inventory";

export const DELETE = withErrorHandler(
  withAccount<{ id: string }>(async (_request, { accountId, params }) => {
    const { id } = await params;
    await deleteInventoryKeyForAccount(id, accountId);
    return createSuccessResponse({ success: true });
  })
);
