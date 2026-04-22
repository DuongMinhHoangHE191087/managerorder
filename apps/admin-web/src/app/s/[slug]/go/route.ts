import { NextRequest, NextResponse } from "next/server";
import {
  executeShortLink,
  getShortLinkBySlug,
  logShortLinkClick,
} from "@/domains/short-links";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function extractVisitorIP(headers: Headers): string {
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.split(",")[0].trim();

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return "0.0.0.0";
}

function detectDeviceType(ua: string) {
  if (!ua) return "unknown";
  if (/tablet|ipad|nexus 7|nexus 10|kindle/i.test(ua)) return "tablet";
  if (/mobile|android|iphone|ipad|ipod|opera mini|iemobile/i.test(ua)) return "mobile";
  if (/bot|spider|crawler|curl|wget|python|httpie|postman|insomnia/i.test(ua)) return "bot";
  return "desktop";
}

function redirectToLanding(request: NextRequest, slug: string) {
  const url = request.nextUrl.clone();
  url.pathname = `/s/${slug}`;
  url.searchParams.delete("go");
  return NextResponse.redirect(url);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const link = await getShortLinkBySlug(slug);

  if (!link || link.status !== "active") {
    return redirectToLanding(request, slug);
  }

  if (link.expires_at && new Date(link.expires_at) <= new Date()) {
    return redirectToLanding(request, slug);
  }

  if (link.max_clicks > 0 && link.current_clicks >= link.max_clicks) {
    return redirectToLanding(request, slug);
  }

  if (link.require_token && link.access_token) {
    const token = request.nextUrl.searchParams.get("t");
    if (!token || token !== link.access_token) {
      return redirectToLanding(request, slug);
    }
  }

  const visitorIp = extractVisitorIP(request.headers);
  const ipVersion = visitorIp.includes(":") ? "IPv6" : "IPv4";
  const lockedIp = ipVersion === "IPv6" ? link.locked_ipv6 : link.locked_ip;
  if (lockedIp && lockedIp !== visitorIp) {
    await logShortLinkClick(supabase, {
      short_link_id: link.id,
      ip_address: visitorIp,
      user_agent: request.headers.get("user-agent"),
      referer: request.headers.get("referer"),
      device_type: detectDeviceType(request.headers.get("user-agent") ?? ""),
      is_suspicious: true,
      suspicious_reason: `ip_mismatch_${ipVersion}`,
      ip_version: ipVersion,
      event_type: "blocked",
    });
    return redirectToLanding(request, slug);
  }

  const execution = await executeShortLink(slug);
  if (!execution?.is_valid || !execution.target_url) {
    return redirectToLanding(request, slug);
  }

  if (link.require_token) {
    const lockField = ipVersion === "IPv6" ? "locked_ipv6" : "locked_ip";
    const currentLock = ipVersion === "IPv6" ? link.locked_ipv6 : link.locked_ip;
    if (!currentLock) {
      await supabase
        .from("short_links")
        .update({ [lockField]: visitorIp, updated_at: new Date().toISOString() })
        .eq("id", link.id)
        .is(lockField, null);
    }
  }

  await logShortLinkClick(supabase, {
    short_link_id: link.id,
    ip_address: visitorIp,
    user_agent: request.headers.get("user-agent"),
    referer: request.headers.get("referer"),
    device_type: detectDeviceType(request.headers.get("user-agent") ?? ""),
    is_suspicious: false,
    suspicious_reason: null,
    ip_version: ipVersion,
    event_type: "redirect_click",
  });

  const response = NextResponse.redirect(execution.target_url, { status: 302 });
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
