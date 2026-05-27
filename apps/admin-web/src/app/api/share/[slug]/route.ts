import { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNT_SHARE_UNLOCK_COOKIE,
  applyAccountSharePublicSecurityHeaders,
  createAccountSharePublicErrorResponse,
  getShareVisitorContext,
  resolveAccountShareSummary,
} from "@/domains/account-sharing";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const summary = await resolveAccountShareSummary(
      slug,
      request.cookies.get(ACCOUNT_SHARE_UNLOCK_COOKIE)?.value,
      getShareVisitorContext(request),
    );
    return applyAccountSharePublicSecurityHeaders(
      NextResponse.json({ data: summary }, { status: summary.status === "not_found" ? 404 : 200 }),
    );
  } catch (error) {
    return createAccountSharePublicErrorResponse(error);
  }
}
