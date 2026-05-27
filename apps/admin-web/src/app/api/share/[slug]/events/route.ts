import { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNT_SHARE_UNLOCK_COOKIE,
  applyAccountSharePublicSecurityHeaders,
  createAccountSharePublicErrorResponse,
  getShareVisitorContext,
  logAccountSharePublicEvent,
} from "@/domains/account-sharing";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const body = await request.json().catch(() => ({})) as {
      eventType?: "copy" | "view" | "totp_view";
      metadata?: Record<string, unknown>;
    };
    const eventType = body.eventType;
    if (eventType !== "copy" && eventType !== "view" && eventType !== "totp_view") {
      return applyAccountSharePublicSecurityHeaders(NextResponse.json({ error: "Invalid event type" }, { status: 400 }));
    }

    const result = await logAccountSharePublicEvent(
      slug,
      eventType,
      request.cookies.get(ACCOUNT_SHARE_UNLOCK_COOKIE)?.value,
      getShareVisitorContext(request),
      body.metadata,
    );
    if (!result.ok) {
      return applyAccountSharePublicSecurityHeaders(NextResponse.json({ error: result.error }, { status: result.status }));
    }
    return applyAccountSharePublicSecurityHeaders(NextResponse.json({ data: { recorded: true } }));
  } catch (error) {
    return createAccountSharePublicErrorResponse(error);
  }
}
