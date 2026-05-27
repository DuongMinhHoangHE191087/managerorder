import { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNT_SHARE_UNLOCK_COOKIE,
  applyAccountSharePublicSecurityHeaders,
  createAccountSharePublicErrorResponse,
  getAccountSharePublicPayload,
  getShareVisitorContext,
} from "@/domains/account-sharing";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const result = await getAccountSharePublicPayload(
      slug,
      request.cookies.get(ACCOUNT_SHARE_UNLOCK_COOKIE)?.value,
      getShareVisitorContext(request),
    );

    if (!result.payload) {
      return applyAccountSharePublicSecurityHeaders(NextResponse.json({ error: result.error }, { status: result.status }));
    }

    return applyAccountSharePublicSecurityHeaders(NextResponse.json({ data: result.payload }));
  } catch (error) {
    return createAccountSharePublicErrorResponse(error);
  }
}
