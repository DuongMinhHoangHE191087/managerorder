import { withAccount } from "@/lib/api/with-account";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api/with-error-handler";
import { updateShortLinkInputSchema } from "@/lib/domain/schemas";
import {
  deleteShortLink,
  getShortLinkDetailForAccount,
  updateShortLinkForAccount,
} from "@/domains/short-links";
import { getClickAnalytics } from "@/lib/services/fraud-detector";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// PATCH /api/short-links/[id] - Update a short link
export const PATCH = withErrorHandler(
  withAccount(async (
    request: NextRequest,
    context: { accountId: string; params: Promise<{ id: string }> },
  ) => {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateShortLinkInputSchema.safeParse(body);

    if (!parsed.success) {
      return createErrorResponse(
        "Dữ liệu đầu vào không hợp lệ",
        "VALIDATION_ERROR",
        400,
        parsed.error.flatten().fieldErrors,
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return createErrorResponse("Không có trường hợp lệ để cập nhật", "VALIDATION_ERROR", 400);
    }

    const link = await updateShortLinkForAccount(id, context.accountId, parsed.data);
    return createSuccessResponse(link);
  }),
);

// DELETE /api/short-links/[id] - Delete a short link
export const DELETE = withErrorHandler(
  withAccount(async (
    _request: NextRequest,
    context: { accountId: string; params: Promise<{ id: string }> },
  ) => {
    const { id } = await context.params;
    await deleteShortLink(id, context.accountId);
    return createSuccessResponse({ deleted: true });
  }),
);

// GET /api/short-links/[id] - Get link details and analytics
export const GET = withErrorHandler(
  withAccount(async (
    _request: NextRequest,
    context: { accountId: string; params: Promise<{ id: string }> },
  ) => {
    const { id } = await context.params;
    const includeDeleted = new URL(_request.url).searchParams.get("include_deleted") === "1";

    const [detail, analytics] = await Promise.all([
      getShortLinkDetailForAccount(id, context.accountId, { includeDeleted }),
      getClickAnalytics(id),
    ]);

    if (!detail) {
      return createErrorResponse("Không tìm thấy link rút gọn", "NOT_FOUND", 404);
    }

    return createSuccessResponse({
      link: detail.link,
      salesChannel: detail.salesChannel,
      resolvedPolicy: detail.resolvedPolicy,
      ...analytics,
    });
  }),
);
