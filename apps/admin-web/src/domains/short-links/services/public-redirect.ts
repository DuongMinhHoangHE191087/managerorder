import { NextRequest, NextResponse } from "next/server";
import { executeShortLink, getShortLinkBySlug, logShortLinkClick } from "@/domains/short-links";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import { createShortLinkClickRecord, getShortLinkVisitorFingerprint } from "./visitor";

const PUBLIC_SHORT_LINK_CSP = [
  "default-src 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "img-src 'self' https: data: blob:",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https:",
  "font-src 'self' https: data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "manifest-src 'self'",
].join("; ");

export function applyPublicShortLinkSecurityHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set(
    "Permissions-Policy",
    "accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), microphone=(), midi=(), payment=(), usb=(), clipboard-read=(), clipboard-write=()",
  );
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("Origin-Agent-Cluster", "?1");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("Content-Security-Policy", PUBLIC_SHORT_LINK_CSP);
  return response;
}

export function redirectToShortLinkLanding(request: NextRequest, slug: string) {
  const url = request.nextUrl.clone();
  url.pathname = `/s/${slug}`;
  url.searchParams.delete("go");
  return applyPublicShortLinkSecurityHeaders(NextResponse.redirect(url));
}

export async function executePublicShortLinkRedirect(
  request: NextRequest,
  options: {
    slug: string;
    token?: string | null;
  },
) {
  const link = await getShortLinkBySlug(options.slug);
  const visitor = getShortLinkVisitorFingerprint(request.headers);

  if (!link || link.status !== "active") {
    if (link) {
      await logShortLinkClick(
        supabase,
        createShortLinkClickRecord(link.id, "blocked", visitor, {
          is_suspicious: visitor.isAutomated,
          suspicious_reason: visitor.suspiciousReason ?? "inactive_link",
        }),
      );
    }
    return redirectToShortLinkLanding(request, options.slug);
  }

  if (link.expires_at && new Date(link.expires_at) <= new Date()) {
    await logShortLinkClick(
      supabase,
      createShortLinkClickRecord(link.id, "blocked", visitor, {
        is_suspicious: visitor.isAutomated,
        suspicious_reason: visitor.suspiciousReason ?? "expired_link",
      }),
    );
    return redirectToShortLinkLanding(request, options.slug);
  }

  if (link.max_clicks > 0 && link.current_clicks >= link.max_clicks) {
    await logShortLinkClick(
      supabase,
      createShortLinkClickRecord(link.id, "blocked", visitor, {
        is_suspicious: visitor.isAutomated,
        suspicious_reason: visitor.suspiciousReason ?? "click_limit_reached",
      }),
    );
    return redirectToShortLinkLanding(request, options.slug);
  }

  if (link.require_token && link.access_token) {
    const token = options.token ?? request.nextUrl.searchParams.get("t");
    if (!token || token !== link.access_token) {
      await logShortLinkClick(
        supabase,
        createShortLinkClickRecord(link.id, "blocked", visitor, {
          is_suspicious: true,
          suspicious_reason: token ? "invalid_token" : "missing_token",
        }),
      );
      return redirectToShortLinkLanding(request, options.slug);
    }
  }

  if (visitor.isAutomated) {
    await logShortLinkClick(
      supabase,
      createShortLinkClickRecord(link.id, "bot_preview", visitor, {
        is_suspicious: true,
        suspicious_reason: visitor.suspiciousReason ?? "automated_redirect_attempt",
      }),
    );
    return redirectToShortLinkLanding(request, options.slug);
  }

  const lockedIp = visitor.ipVersion === "IPv6" ? link.locked_ipv6 : link.locked_ip;
  if (lockedIp && lockedIp !== visitor.ipAddress) {
    await logShortLinkClick(
      supabase,
      createShortLinkClickRecord(link.id, "blocked", visitor, {
        is_suspicious: true,
        suspicious_reason: `ip_mismatch_${visitor.ipVersion}`,
      }),
    );
    return redirectToShortLinkLanding(request, options.slug);
  }

  const execution = await executeShortLink(options.slug);
  if (!execution?.is_valid || !execution.target_url) {
    return redirectToShortLinkLanding(request, options.slug);
  }

  if (link.require_token) {
    const lockField = visitor.ipVersion === "IPv6" ? "locked_ipv6" : "locked_ip";
    const currentLock = visitor.ipVersion === "IPv6" ? link.locked_ipv6 : link.locked_ip;
    if (!currentLock) {
      await supabase
        .from("short_links")
        .update({ [lockField]: visitor.ipAddress, updated_at: new Date().toISOString() })
        .eq("id", link.id)
        .is(lockField, null);
    }
  }

  await logShortLinkClick(
    supabase,
    createShortLinkClickRecord(link.id, "redirect_click", visitor, {
      is_suspicious: false,
      suspicious_reason: null,
    }),
  );

  return applyPublicShortLinkSecurityHeaders(
    NextResponse.redirect(execution.target_url, { status: 302 }),
  );
}
