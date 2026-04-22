import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolvePublicShortLinkBySlug } from "@/domains/short-links";

export const dynamic = "force-dynamic";

/**
 * LEGACY API ROUTE for short links.
 * All short link traffic is now handled by Edge Middleware (proxy.ts) at /s/[slug].
 * This endpoint exists only for backwards compatibility with previously generated
 * links that used the /api/s/[slug] format.
 * 
 * It simply issues a 301 Moved Permanently to the correct /s/[slug] path,
 * preserving any query parameters (like ?t=token).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const direct = request.nextUrl.searchParams.get("direct") === "1";

  // Validate slug format
  if (!slug || !/^[A-Za-z0-9]{4,32}$/.test(slug)) {
    return NextResponse.json(
      { error: "Invalid link format" },
      { status: 400 }
    );
  }

  if (direct) {
    const detail = await resolvePublicShortLinkBySlug(slug);
    const link = detail?.link ?? null;

    if (link && link.status === "active" && link.target_url) {
      return NextResponse.redirect(link.target_url, 302);
    }
  }

  // Construct new URL: /s/[slug] + existing search params
  const targetUrl = new URL(`/s/${slug}`, request.url);
  // Transfer any query parameters (like ?t= or ?token=)
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key === "token" ? "t" : key, value);
  });

  // 301 Permanent Redirect to the new middleware-powered route
  return NextResponse.redirect(targetUrl, 301);
}


