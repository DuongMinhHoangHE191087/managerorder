import { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNT_SHARE_UNLOCK_COOKIE,
  applyAccountSharePublicSecurityHeaders,
  createAccountSharePublicErrorResponse,
  getShareVisitorContext,
  unlockAccountShare,
} from "@/domains/account-sharing";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const body = await request.json().catch(() => ({})) as { passcode?: string | null };
    const result = await unlockAccountShare(slug, body.passcode, getShareVisitorContext(request));

    if (!result.ok) {
      return applyAccountSharePublicSecurityHeaders(NextResponse.json({ error: result.error }, { status: result.status }));
    }
    if (!result.cookieValue) {
      return applyAccountSharePublicSecurityHeaders(NextResponse.json({ error: "Unlock cookie could not be created" }, { status: 500 }));
    }

    const response = NextResponse.json({ data: { unlocked: true } });
    response.cookies.set(ACCOUNT_SHARE_UNLOCK_COOKIE, result.cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60,
      path: "/",
    });
    return applyAccountSharePublicSecurityHeaders(response);
  } catch (error) {
    return createAccountSharePublicErrorResponse(error);
  }
}
