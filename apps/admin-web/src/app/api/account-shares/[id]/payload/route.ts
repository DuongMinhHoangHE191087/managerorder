import { NextRequest } from "next/server";
import { getAccountShareLinkById } from "@/domains/account-sharing/repository";
import { getDecryptedSourceAccountSecretsForAccount } from "@/domains/source-accounts";
import { buildSharePayload, parseExposurePolicy } from "@/domains/account-sharing/services";
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
        const row = await getAccountShareLinkById(id, context.accountId);
        if (!row) {
          return createErrorResponse("Account share link not found", "NOT_FOUND", 404);
        }

        const secrets = await getDecryptedSourceAccountSecretsForAccount(row.source_account_id, context.accountId);
        if (!secrets) {
          return createErrorResponse("Source account not found", "NOT_FOUND", 404);
        }

        const exposurePolicy = parseExposurePolicy(row.exposure_policy);
        const payload = buildSharePayload(row, exposurePolicy, secrets);
        
        return createSuccessResponse(payload);
      })();
    }) as RBACApiHandler<Ctx>),
  ),
);
