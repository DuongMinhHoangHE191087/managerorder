// /api/inventory/[id]/route.ts — GET single key + Delete a specific license key
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse, createErrorResponse } from "@/lib/api/with-error-handler";
import { deleteInventoryKeyForAccount, listInventoryKeysForAccount } from "@/domains/inventory";
import { requirePermissions } from "@/lib/api/rbac";
import type { NextRequest } from "next/server";


// BUG #1 FIX: Added GET handler for single license key lookup
export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    // List all keys for account and find the specific one
    // (no dedicated getById in repo — use list + filter for now)
    const allKeys = await listInventoryKeysForAccount(accountId);
    const key = allKeys.find((k) => k.id === id);
    if (!key) {
      return createErrorResponse("Không tìm thấy license key", "NOT_FOUND", 404);
    }
    return createSuccessResponse(key);
  })
);

// BUG #4 FIX: Added requirePermissions guard
export const DELETE = withErrorHandler(
  withAccount(
    requirePermissions<{ id: string }>(["inventory:adjust"])(async (_request, { accountId, params }) => {
      const { id } = await params;
      await deleteInventoryKeyForAccount(id, accountId);
      return createSuccessResponse({ success: true });
    })
  )
);
