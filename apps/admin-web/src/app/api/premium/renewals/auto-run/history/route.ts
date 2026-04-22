import { NextRequest } from "next/server";
import { createSuccessResponse, withErrorHandler } from "@/lib/api/with-error-handler";
import { withAccount } from "@/lib/api/with-account";
import { requireRole } from "@/lib/api/rbac";
import { getAutoRenewalEngineRunHistory } from "@/lib/services/auto-renewal-engine-audit";

export const dynamic = "force-dynamic";

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

export const GET = withErrorHandler(
  withAccount(
    requireRole(["admin_owner"])(async (request: NextRequest, { accountId }) => {
      const searchParams = new URL(request.url).searchParams;
      const page = parsePositiveInt(searchParams.get("page"), 1, 1000);
      const limit = parsePositiveInt(searchParams.get("limit"), 10, 50);
      const history = await getAutoRenewalEngineRunHistory(accountId, { page, limit });

      return createSuccessResponse(history);
    }),
  ),
);
