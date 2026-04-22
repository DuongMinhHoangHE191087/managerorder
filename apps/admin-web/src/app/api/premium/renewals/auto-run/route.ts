import { NextRequest } from "next/server";
import { createSuccessResponse, withErrorHandler } from "@/lib/api/with-error-handler";
import { withAccount } from "@/lib/api/with-account";
import { requireRole } from "@/lib/api/rbac";
import { runAutoRenewalEngine } from "@/lib/services/auto-renewal-engine";

export const dynamic = "force-dynamic";

type AutoRenewalRunBody = {
  days_threshold?: unknown;
  max_created?: unknown;
  min_reliability_score?: unknown;
  daysThreshold?: unknown;
  maxCreated?: unknown;
  minReliabilityScore?: unknown;
};

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const POST = withErrorHandler(
  withAccount(
    requireRole(["admin_owner"])(async (request: NextRequest, { accountId }) => {
      const body = (await request.json().catch(() => ({}))) as AutoRenewalRunBody;
      const searchParams = new URL(request.url).searchParams;

      const report = await runAutoRenewalEngine({
        accountId,
        daysThreshold: parseOptionalNumber(
          body.daysThreshold ?? body.days_threshold ?? searchParams.get("days_threshold"),
        ),
        maxCreated: parseOptionalNumber(
          body.maxCreated ?? body.max_created ?? searchParams.get("max_created"),
        ),
        minReliabilityScore: parseOptionalNumber(
          body.minReliabilityScore ?? body.min_reliability_score ?? searchParams.get("min_reliability_score"),
        ),
      });

      return createSuccessResponse(report, {
        meta: {
          accountId,
          mode: "manual",
        },
      });
    }),
  ),
);
