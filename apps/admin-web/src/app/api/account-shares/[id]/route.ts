import { z } from "zod/v3";
import {
  deleteAccountShareForAccount,
  getAccountShareForAccount,
  updateAccountShareForAccount,
} from "@/domains/account-sharing";
import { withAccount } from "@/lib/api/with-account";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api/with-error-handler";
import { requirePermissions, type RBACApiHandler } from "@/lib/api/rbac";

export const dynamic = "force-dynamic";

type Ctx = { id: string };

const exposurePolicySchema = z.object({
  fields: z.array(z.enum(["email", "password", "link_join", "2fa", "2fa_backup", "duolingo_id", "other"])).min(1),
  credentialIds: z.array(z.string()).optional(),
  includeLabels: z.boolean().optional(),
});

const updateAccountShareSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  status: z.enum(["active", "disabled", "expired"]).optional(),
  expiresAt: z.string().nullable().optional(),
  maxViews: z.number().int().min(1).max(500).optional(),
  maxUnlocks: z.number().int().min(1).max(500).optional(),
  passcode: z.string().min(4).max(64).nullable().optional(),
  clearPasscode: z.boolean().optional(),
  lockToIp: z.boolean().optional(),
  exposurePolicy: exposurePolicySchema.optional(),
});

export const GET = withErrorHandler(
  withAccount(
    requirePermissions<Ctx>(["credentials:share"])(((request, context) => {
      return (async () => {
        const { id } = await context.params;
        const share = await getAccountShareForAccount(id, context.accountId, request.nextUrl.origin);
        if (!share) {
          return createErrorResponse("Account share link not found", "NOT_FOUND", 404);
        }
        return createSuccessResponse(share);
      })();
    }) as RBACApiHandler<Ctx>),
  ),
);

export const PATCH = withErrorHandler(
  withAccount(
    requirePermissions<Ctx>(["credentials:share"])(((request, context) => {
      return (async () => {
        const { id } = await context.params;
        const body = await request.json();
        const parsed = updateAccountShareSchema.safeParse(body);
        if (!parsed.success) {
          return createErrorResponse(
            "Invalid account share payload",
            "VALIDATION_ERROR",
            400,
            parsed.error.flatten().fieldErrors,
          );
        }

        const updated = await updateAccountShareForAccount(
          id,
          context.accountId,
          parsed.data,
          request.nextUrl.origin,
        );
        if (!updated) {
          return createErrorResponse("Account share link not found", "NOT_FOUND", 404);
        }
        return createSuccessResponse(updated);
      })();
    }) as RBACApiHandler<Ctx>),
  ),
);

export const DELETE = withErrorHandler(
  withAccount(
    requirePermissions<Ctx>(["credentials:share"])(((_request, context) => {
      return (async () => {
        const { id } = await context.params;
        await deleteAccountShareForAccount(id, context.accountId);
        return createSuccessResponse({ deleted: true });
      })();
    }) as RBACApiHandler<Ctx>),
  ),
);
