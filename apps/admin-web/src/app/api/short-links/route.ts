import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse, createErrorResponse } from "@/lib/api/with-error-handler";
import { createShortLinkInputSchema } from "@/lib/domain/schemas";
import { createShortLinkForAccount, listShortLinksForAccount } from "@/domains/short-links";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/short-links — List all short links for the account
export const GET = withErrorHandler(
  withAccount(async (_request: NextRequest, context: { accountId: string }) => {
    const links = await listShortLinksForAccount(context.accountId);
    return createSuccessResponse(links);
  })
);

// POST /api/short-links — Create a new short link
export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, context: { accountId: string }) => {
    const body = await request.json() as unknown;
    const parsed = createShortLinkInputSchema.safeParse(body);

    if (!parsed.success) {
      return createErrorResponse("Dữ liệu đầu vào không hợp lệ", "VALIDATION_ERROR", 400, parsed.error.flatten().fieldErrors);
    }

    const link = await createShortLinkForAccount(context.accountId, parsed.data);

    return createSuccessResponse(link, { status: 201 });
  })
);
