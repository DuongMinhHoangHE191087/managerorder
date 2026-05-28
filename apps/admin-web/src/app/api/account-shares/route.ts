import { NextRequest } from "next/server";
import { z } from "zod/v3";
import {
  createAccountShareForAccount,
  listAccountSharesForAccount,
} from "@/domains/account-sharing";
import { withAccount } from "@/lib/api/with-account";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";

export const dynamic = "force-dynamic";

const exposurePolicySchema = z.object({
  fields: z.array(z.enum(["email", "password", "link_join", "2fa", "2fa_backup", "duolingo_id", "other"])).min(1),
  credentialIds: z.array(z.string()).optional(),
  includeLabels: z.boolean().optional(),
  shareTotpSecret: z.boolean().optional(),
});

const createAccountShareSchema = z.object({
  sourceAccountId: z.string().uuid(),
  orderId: z.string().uuid().nullable().optional(),
  orderItemId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  maxViews: z.number().int().min(1).max(500).optional(),
  maxUnlocks: z.number().int().min(1).max(500).optional(),
  passcode: z.string().min(4).max(64).nullable().optional(),
  allowNoPasscode: z.boolean().optional(),
  lockToIp: z.boolean().optional(),
  exposurePolicy: exposurePolicySchema,
});

export const GET = withErrorHandler(
  withAccount(
    requirePermissions(["credentials:share"])(async (request: NextRequest, { accountId }) => {
      const sourceAccountId = request.nextUrl.searchParams.get("sourceAccountId");
      const shares = await listAccountSharesForAccount(
        accountId,
        { sourceAccountId },
        request.nextUrl.origin,
      );
      return createSuccessResponse(shares);
    }),
  ),
);

export const POST = withErrorHandler(
  withAccount(
    requirePermissions(["credentials:share"])(async (request: NextRequest, { accountId, user }) => {
      const body = await request.json();
      const parsed = createAccountShareSchema.safeParse(body);
      if (!parsed.success) {
        return createErrorResponse(
          "Invalid account share payload",
          "VALIDATION_ERROR",
          400,
          parsed.error.flatten().fieldErrors,
        );
      }

      const share = await createAccountShareForAccount(
        accountId,
        parsed.data,
        user.email,
        request.nextUrl.origin,
      );
      return createSuccessResponse(share, { status: 201 });
    }),
  ),
);
