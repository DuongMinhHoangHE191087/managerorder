import { NextRequest } from "next/server";
import { getAccountShareLinkById } from "@/domains/account-sharing/repository";
import { getInternalSourceAccountTotpForAccount } from "@/domains/account-sharing/services";
import { withAccount } from "@/lib/api/with-account";
import { createErrorResponse, createSuccessResponse, withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions, type RBACApiHandler } from "@/lib/api/rbac";

export const dynamic = "force-dynamic";

type Ctx = { id: string };

export const GET = withErrorHandler(
  withAccount(
    requirePermissions<Ctx>(["credentials:share"])(((request, context) => {
      return (async () => {
        const { id } = await context.params;
        const credentialId = request.nextUrl.searchParams.get("credentialId");
        if (!credentialId) {
          return createErrorResponse("Missing credentialId", "BAD_REQUEST", 400);
        }

        const row = await getAccountShareLinkById(id, context.accountId);
        if (!row) {
          return createErrorResponse("Account share link not found", "NOT_FOUND", 404);
        }

        const totp = await getInternalSourceAccountTotpForAccount(row.source_account_id, context.accountId, credentialId);
        if (!totp) {
          return createErrorResponse("TOTP generation failed", "INTERNAL_ERROR", 500);
        }

        return createSuccessResponse(totp);
      })();
    }) as RBACApiHandler<Ctx>),
  ),
);
