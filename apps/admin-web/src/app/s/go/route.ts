import { NextRequest, NextResponse } from "next/server";
import {
  executePublicShortLinkRedirect,
  applyPublicShortLinkSecurityHeaders,
} from "@/domains/short-links/services/public-redirect";
import {
  SHORT_LINK_RELAY_COOKIE_NAME,
  verifyShortLinkRelayCookieValue,
} from "@/domains/short-links/services/public-relay";

export const dynamic = "force-dynamic";

function clearRelayCookie(response: NextResponse) {
  response.cookies.set(SHORT_LINK_RELAY_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/s",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function GET(request: NextRequest) {
  const relay = await verifyShortLinkRelayCookieValue(
    request.cookies.get(SHORT_LINK_RELAY_COOKIE_NAME)?.value,
    { userAgent: request.headers.get("user-agent") },
  );

  if (!relay) {
    return clearRelayCookie(
      applyPublicShortLinkSecurityHeaders(
        new NextResponse("Not Found", {
          status: 404,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        }),
      ),
    );
  }

  return clearRelayCookie(
    await executePublicShortLinkRedirect(request, {
      slug: relay.slug,
      token: relay.token,
    }),
  );
}
