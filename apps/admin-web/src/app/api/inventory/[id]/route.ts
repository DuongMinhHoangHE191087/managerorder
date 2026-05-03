// /api/inventory/[id]/route.ts - GET single key + Delete a specific license key
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse, createErrorResponse } from "@/lib/api/with-error-handler";
import {
  deleteInventoryKeyForAccount,
  getInventoryKeyForAccount,
} from "@/domains/inventory";
import { requirePermissions } from "@/lib/api/rbac";
import type { NextRequest } from "next/server";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const includeDeleted = new URL(request.url).searchParams.get("include_deleted") === "1";
    const key = await getInventoryKeyForAccount(id, accountId, { includeDeleted });
    if (!key) {
      return createErrorResponse("Không tìm thấy license key", "NOT_FOUND", 404);
    }
    return createSuccessResponse(key);
  })
);

export const DELETE = withErrorHandler(
  withAccount(
    requirePermissions<{ id: string }>(["inventory:adjust"])(async (_request, { accountId, params }) => {
      const { id } = await params;
      await deleteInventoryKeyForAccount(id, accountId);
      return createSuccessResponse({ success: true });
    })
  )
);
