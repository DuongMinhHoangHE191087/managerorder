import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse, createErrorResponse } from "@/lib/api/with-error-handler";
import { updateShortLink, deleteShortLink, getShortLinkById } from "@/lib/supabase/repositories/short-links.repo";
import { getClickAnalytics } from "@/lib/services/fraud-detector";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// PATCH /api/short-links/[id] — Update a short link (with anti-fraud fields)
export const PATCH = withErrorHandler(
  withAccount(async (request: NextRequest, context: { accountId: string; params: { id: string } | Promise<{ id: string }> }) => {
    const { id } = await Promise.resolve(context.params);
    const body = await request.json();

    const allowedFields = ["title", "target_url", "max_clicks", "expires_at", "status", "require_token", "locked_ip", "notify_clicks"] as const;
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return createErrorResponse("No valid fields to update", "VALIDATION_ERROR", 400);
    }

    const link = await updateShortLink(id, context.accountId, updates as Parameters<typeof updateShortLink>[2]);
    return createSuccessResponse(link);
  })
);

// DELETE /api/short-links/[id] — Delete a short link
export const DELETE = withErrorHandler(
  withAccount(async (_request: NextRequest, context: { accountId: string; params: { id: string } | Promise<{ id: string }> }) => {
    const { id } = await Promise.resolve(context.params);
    await deleteShortLink(id, context.accountId);
    return createSuccessResponse({ deleted: true });
  })
);

// GET /api/short-links/[id] — Get link details + analytics
export const GET = withErrorHandler(
  withAccount(async (_request: NextRequest, context: { accountId: string; params: { id: string } | Promise<{ id: string }> }) => {
    const { id } = await Promise.resolve(context.params);

    // Fetch link data and analytics in parallel
    const [link, analytics] = await Promise.all([
      getShortLinkById(id, context.accountId),
      getClickAnalytics(id),
    ]);

    if (!link) {
      return createErrorResponse("Short link not found", "NOT_FOUND", 404);
    }

    return createSuccessResponse({
      link,
      ...analytics,
    });
  })
);
