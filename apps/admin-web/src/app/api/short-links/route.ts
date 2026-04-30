import { withAccount } from "@/lib/api/with-account";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api/with-error-handler";
import { createShortLinkInputSchema } from "@/lib/domain/schemas";
import { createShortLinkForAccount, listShortLinksForAccount } from "@/domains/short-links";
import { requirePermissions } from "@/lib/api/rbac";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/short-links - List all short links for the account (no RBAC needed for read)
export const GET = withErrorHandler(
  withAccount(async (_request: NextRequest, context: { accountId: string }) => {
    const links = await listShortLinksForAccount(context.accountId);
    return createSuccessResponse(links);
  }),
);

// POST /api/short-links - Create a new short link
// BUG #5 FIX: Added requirePermissions guard
export const POST = withErrorHandler(
  withAccount(
    requirePermissions(["order:create"])(async (request: NextRequest, context: { accountId: string }) => {
      const body = await request.json();
      const parsed = createShortLinkInputSchema.safeParse(body);

      if (!parsed.success) {
        return createErrorResponse(
          "Dữ liệu đầu vào không hợp lệ",
          "VALIDATION_ERROR",
          400,
          parsed.error.flatten().fieldErrors,
        );
      }

      const link = await createShortLinkForAccount(context.accountId, parsed.data);
      return createSuccessResponse(link, { status: 201 });
    })
  ),
);
