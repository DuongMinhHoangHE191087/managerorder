import { NextRequest } from "next/server";
import { getInternalSourceAccountTotpForAccount } from "@/domains/account-sharing";
import { withAccount } from "@/lib/api/with-account";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(
    requirePermissions<{ id: string }>(["credentials:read"])(async (request: NextRequest, { accountId, params }) => {
      const { id } = await params;
      const credentialId = request.nextUrl.searchParams.get("credentialId");
      if (!credentialId) {
        return createErrorResponse("credentialId is required", "VALIDATION_ERROR", 400);
      }

      const result = await getInternalSourceAccountTotpForAccount(id, accountId, credentialId);
      if (!result) {
        return createErrorResponse("TOTP credential not found", "NOT_FOUND", 404);
      }

      return createSuccessResponse(result);
    }),
  ),
);
