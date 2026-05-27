import { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNT_SHARE_UNLOCK_COOKIE,
  applyAccountSharePublicSecurityHeaders,
  createAccountSharePublicErrorResponse,
  getAccountSharePublicTotp,
  getShareVisitorContext,
} from "@/domains/account-sharing";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const credentialId = request.nextUrl.searchParams.get("credentialId");
    if (!credentialId) {
      return applyAccountSharePublicSecurityHeaders(NextResponse.json({ error: "credentialId is required" }, { status: 400 }));
    }

    const result = await getAccountSharePublicTotp(
      slug,
      credentialId,
      request.cookies.get(ACCOUNT_SHARE_UNLOCK_COOKIE)?.value,
      getShareVisitorContext(request),
    );

    if (!("data" in result)) {
      return applyAccountSharePublicSecurityHeaders(NextResponse.json({ error: result.error }, { status: result.status }));
    }

    return applyAccountSharePublicSecurityHeaders(NextResponse.json({ data: result.data }));
  } catch (error) {
    return createAccountSharePublicErrorResponse(error);
  }
}
