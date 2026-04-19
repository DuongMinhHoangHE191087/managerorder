import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse, createErrorResponse } from "@/lib/api/with-error-handler";
import { listShortLinks, createShortLink } from "@/lib/supabase/repositories/short-links.repo";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/short-links — List all short links for the account
export const GET = withErrorHandler(
  withAccount(async (_request: NextRequest, context: { accountId: string }) => {
    const links = await listShortLinks(context.accountId);
    return createSuccessResponse(links);
  })
);

// POST /api/short-links — Create a new short link
export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, context: { accountId: string }) => {
    const body = await request.json();

    if (!body.target_url || typeof body.target_url !== "string") {
      return createErrorResponse("target_url is required", "VALIDATION_ERROR", 400);
    }

    // Validate URL format
    try {
      new URL(body.target_url);
    } catch {
      return createErrorResponse("Invalid target_url format", "VALIDATION_ERROR", 400);
    }

    const maxClicks = Math.min(Math.max(Number(body.max_clicks) || 1, 1), 100);

    const link = await createShortLink(context.accountId, {
      target_url: body.target_url,
      title: body.title ?? null,
      max_clicks: maxClicks,
      expires_at: body.expires_at ?? null,
      order_id: body.order_id ?? null,
      customer_id: body.customer_id ?? null,
      created_by: body.created_by ?? null,
      require_token: body.require_token ?? false,
      notify_clicks: body.notify_clicks ?? false,
    });

    return createSuccessResponse(link, { status: 201 });
  })
);
