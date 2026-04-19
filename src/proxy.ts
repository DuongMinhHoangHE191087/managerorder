import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createClient } from "@supabase/supabase-js";
import { formatDateLabel } from "@/lib/utils";

/**
 * Public routes that do NOT require authentication.
 */
const PUBLIC_ROUTES = [
  "/login",
  "/unauthorized",
  "/s/",                // Public short link redirect (NO auth — customer-facing)
  "/api/auth",          // All auth endpoints (session, callback, google, etc.)
  "/api/v1/auth",       // V1 auth endpoints (login, register, refresh, etc.)
  "/api/telegram",      // Telegram webhook + setup (auth handled by route itself)
  "/api/cron",          // Cron jobs (auth handled by CRON_SECRET)
  "/api/s/",            // Public short link API redirect (NO auth)
];

/**
 * Static asset prefixes that should always be allowed through.
 */
const STATIC_PREFIXES = ["/_next", "/favicon.ico"];
const ADMIN_ACCESS_COOKIE_NAME = "admin_access_grant";
const ADMIN_ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Singleton admin client for middleware admin_users lookup.
 * Created once at module load, NOT per-request.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * In-memory admin lookup cache — avoids DB round-trip on every request.
 * TTL: 5 minutes. Max: 100 entries (auto-prune oldest).
 */
const ADMIN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const ADMIN_CACHE_MAX = 100;
const adminCache = new Map<string, { data: { id: string; email: string | null; role: string; account_id: string | null } | null; ts: number }>();

function getCachedAdmin(email: string) {
  const entry = adminCache.get(email);
  if (entry && Date.now() - entry.ts < ADMIN_CACHE_TTL) return entry.data;
  adminCache.delete(email);
  return undefined; // cache miss
}

function setCachedAdmin(email: string, data: { id: string; email: string | null; role: string; account_id: string | null } | null) {
  // Prune if over limit
  if (adminCache.size >= ADMIN_CACHE_MAX) {
    const oldest = adminCache.keys().next().value;
    if (oldest) adminCache.delete(oldest);
  }
  adminCache.set(email, { data, ts: Date.now() });
}

type TrustedJwtPayload = {
  accountId?: string;
  email?: string;
  role?: string;
  sub?: string;
};

type JwtHeader = {
  alg?: string;
  typ?: string;
};

type JwtClaims = TrustedJwtPayload & {
  exp?: number;
  iat?: number;
  nbf?: number;
};

const JWT_CLOCK_SKEW_SECONDS = 60;

function base64UrlToBytes(value: string): Uint8Array {
  let base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function parseJwtPart<T>(part: string): T {
  const text = new TextDecoder().decode(base64UrlToBytes(part));
  const parsed = JSON.parse(text) as T;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid token payload");
  }
  return parsed;
}

function validateJwtClaims(claims: JwtClaims) {
  const now = Math.floor(Date.now() / 1000);

  if (typeof claims.exp !== "number") {
    throw new Error("Token is missing an expiration claim");
  }
  if (now > claims.exp + JWT_CLOCK_SKEW_SECONDS) {
    throw new Error("Token has expired");
  }

  if (typeof claims.iat !== "number") {
    throw new Error("Token is missing an issued-at claim");
  }
  if (claims.iat > now + JWT_CLOCK_SKEW_SECONDS) {
    throw new Error("Token issue time is invalid");
  }

  if (typeof claims.nbf === "number" && claims.nbf > now + JWT_CLOCK_SKEW_SECONDS) {
    throw new Error("Token is not active yet");
  }
}

// Helper to verify HS256 JWT using Web Crypto API (Edge Runtime compatible)
async function verifyJwtEdge(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const header = parseJwtPart<JwtHeader>(parts[0]);
  if (header.alg !== "HS256") {
    throw new Error("Unsupported token algorithm");
  }
  if (header.typ && header.typ !== "JWT") {
    throw new Error("Unsupported token type");
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signature = base64UrlToBytes(parts[2]);
  const signatureBuffer = new Uint8Array(signature).slice().buffer;
  const data = encoder.encode(`${parts[0]}.${parts[1]}`);
  const isValid = await crypto.subtle.verify("HMAC", key, signatureBuffer, data);
  if (!isValid) {
    throw new Error("Invalid signature");
  }

  const claims = parseJwtPart<JwtClaims>(parts[1]);
  validateJwtClaims(claims);
  return claims;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawUa = request.headers.get("user-agent") ?? "";
  const ua = rawUa.toLowerCase();

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL SECURITY: Block Malicious Scanners & Scripts
  // ═══════════════════════════════════════════════════════════════
  const isMaliciousScanner = /nmap|nikto|sqlmap|ahrefs|semrush|python-requests|python-urllib|go-http-client|zgrab|masscan|censys/i.test(ua);
  if (isMaliciousScanner) {
    return new NextResponse("Forbidden - Access Denied", { status: 403 });
  }

  // ═══════════════════════════════════════════════════════════════
  // SHORT LINK INSTANT REDIRECT — Fastest possible layer
  // Bot crawlers (Zalo, Facebook, Telegram) get OG-rich HTML to
  // increase trust score and avoid spam flags — NO click consumed.
  // Humans get instant 302 redirect via use_short_link RPC.
  // Target URL is NEVER exposed in HTML/JS — pure server redirect.
  // ═══════════════════════════════════════════════════════════════
  if (pathname.startsWith("/s/")) {
    const slug = pathname.split("/")[2];
    if (slug && /^[A-Za-z0-9]{4,32}$/.test(slug)) {

      // ── Detect social bot/crawler BEFORE any DB call ──
      // Ignore crawler flag if UA belongs to real mobile device (excludes real WebView users blocked by 'zalo' or 'preview')
      const isMobileDevice = /iphone|ipad|android|mobile/i.test(ua);
      const isExplicitBot = /facebookexternalhit|facebot|telegrambot|twitterbot|discordbot|linkedinbot|googlebot|bingbot|crawl|spider|slurp|ia_archiver/i.test(ua);
      const hasSuspiciousAppKw = /zalo|whatsapp|preview/i.test(ua);
      
      const isCrawler = isExplicitBot || (!isMobileDevice && hasSuspiciousAppKw);

      // ── Extract real visitor IP & Geolocation ──
      const visitorIp = extractVisitorIP(request.headers);
      const ipVersion = visitorIp.includes(':') ? 'IPv6' : 'IPv4';
      const country = request.headers.get("x-vercel-ip-country") || null;
      const city = request.headers.get("x-vercel-ip-city") || null;
      const region = request.headers.get("x-vercel-ip-country-region") || null;
      const referer = request.headers.get("referer");

      try {
        // Single abort controller for entire operation (5s total budget)
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);

        // ── Step 1: Get link metadata (both paths need it) ──
        const { data: linkMeta } = await supabaseAdmin
          .from("short_links")
          .select("id, target_url, status, max_clicks, current_clicks, expires_at, title, notify_clicks, locked_ip, locked_ipv6, require_token, access_token")
          .eq("slug", slug)
          .single();

        if (!linkMeta || linkMeta.status !== "active") {
          clearTimeout(timer);
          // Link not found or inactive → fall through to expired page

        } else if (isCrawler) {
          clearTimeout(timer);
          // ── Crawler path: READ-ONLY — return OG-rich HTML (no click consumed) ──
          const notExpired = !linkMeta.expires_at || new Date(linkMeta.expires_at) > new Date();
          const notMaxed = !linkMeta.max_clicks || linkMeta.current_clicks < linkMeta.max_clicks;

          if (notExpired && notMaxed) {
            // Fire-and-forget: log crawler visit (for analytics)
            const crawlerBrowser = parseBrowserInMiddleware(rawUa);
            logClickInMiddleware(supabaseAdmin, {
              linkId: linkMeta.id, ip: visitorIp, ua: rawUa, referer,
              deviceType: "bot", isSuspicious: false, reason: "bot_preview",
              country, city, region, ipVersion, browser: crawlerBrowser,
            });

            const siteName = "DuolingoDMH";
            const linkTitle = escapeHtmlMiddleware(linkMeta.title || `${siteName} — Liên kết an toàn`);
            const description = "Truy cập nội dung được chia sẻ qua DuolingoDMH. Liên kết được bảo mật và xác thực.";
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
            const tokenParam = request.nextUrl.searchParams.get("t");
            const canonicalUrl = tokenParam ? `${siteUrl}/s/${slug}?t=${tokenParam}` : `${siteUrl}/s/${slug}`;

            // OG-only HTML — NO redirect, NO meta-refresh, NO target_url exposure
            // Bots only get OG tags for rich preview. Target URL is NEVER leaked.
            const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${linkTitle}</title>
<meta name="description" content="${description}"/>
<meta name="robots" content="noindex,nofollow"/>
<meta name="referrer" content="no-referrer"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="${siteName}"/>
<meta property="og:title" content="${linkTitle}"/>
<meta property="og:description" content="${description}"/>
<meta property="og:url" content="${canonicalUrl}"/>
<meta name="twitter:card" content="summary"/>
<meta name="twitter:title" content="${linkTitle}"/>
<meta name="twitter:description" content="${description}"/>
<link rel="canonical" href="${canonicalUrl}"/>
</head>
<body>
<p>${escapeHtmlMiddleware(linkTitle)}</p>
<p>Nội dung được bảo mật. Vui lòng mở link trực tiếp từ tin nhắn.</p>
</body>
</html>`;

            return new NextResponse(html, {
              status: 200,
              headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "public, max-age=60, s-maxage=300",
                "X-Robots-Tag": "noindex, nofollow",
                "X-Content-Type-Options": "nosniff",
              },
            });
          }

        } else {
          // ── Human path ──

          // ── Security: Token verification (if enabled) ──
          if (linkMeta.require_token && linkMeta.access_token) {
            const token = request.nextUrl.searchParams.get("t");
            if (!token || token !== linkMeta.access_token) {
              clearTimeout(timer);
              // Invalid/missing token → fall through to expired page
              const requestHeaders = new Headers(request.headers);
              requestHeaders.set("x-next-pathname", pathname);
              return NextResponse.next({ request: { headers: requestHeaders } });
            }
          }

          // ── Security: Dual IP Lock check (supports IPv4 + IPv6) ──
          const isIpv6 = ipVersion === 'IPv6';
          const relevantLockedIp = isIpv6 ? linkMeta.locked_ipv6 : linkMeta.locked_ip;
          if (relevantLockedIp && relevantLockedIp !== visitorIp) {
            clearTimeout(timer);
            // Different IP → log as suspicious, deny access
            const lockBrowser = parseBrowserInMiddleware(rawUa);
            logClickInMiddleware(supabaseAdmin, {
              linkId: linkMeta.id, ip: visitorIp, ua: rawUa, referer,
              deviceType: detectDeviceInMiddleware(rawUa),
              isSuspicious: true, reason: `ip_mismatch_${ipVersion}`,
              country, city, region, ipVersion, browser: lockBrowser,
            });
            console.warn(`[ShortLink] IP Lock denied: ${visitorIp} (${ipVersion}) ≠ locked ${relevantLockedIp} | slug=${slug}`);
            // Fall through to expired page
            const requestHeaders = new Headers(request.headers);
            requestHeaders.set("x-next-pathname", pathname);
            return NextResponse.next({ request: { headers: requestHeaders } });
          }

          // ── Atomic click: use_short_link RPC (consumes 1 click) ──
          const { data } = await supabaseAdmin.rpc("use_short_link", { p_slug: slug }, {
            signal: controller.signal,
          } as unknown as Record<string, unknown>);
          clearTimeout(timer);

          const rows = data as unknown as Array<{ target_url: string; is_valid: boolean; remaining: number }>;

          if (rows?.[0]?.is_valid && rows[0].target_url) {
            // ── Fire-and-forget: log click with real IP + UA + Browser ──
            const deviceType = detectDeviceInMiddleware(rawUa);
            const browser = parseBrowserInMiddleware(rawUa);
            logClickInMiddleware(supabaseAdmin, {
              linkId: linkMeta.id, ip: visitorIp, ua: rawUa, referer,
              deviceType, isSuspicious: false, reason: null,
              country, city, region, ipVersion, browser,
            });
            console.log(`[ShortLink] Click: slug=${slug} ip=${visitorIp}(${ipVersion}) device=${deviceType} browser=${browser} country=${country} city=${city}`);

            // ── Fire-and-forget: Dual IP Lock on first click ──
            if (linkMeta.require_token) {
              const lockField = isIpv6 ? 'locked_ipv6' : 'locked_ip';
              const currentLock = isIpv6 ? linkMeta.locked_ipv6 : linkMeta.locked_ip;
              if (!currentLock) {
                Promise.resolve(
                  supabaseAdmin
                    .from("short_links")
                    .update({ [lockField]: visitorIp, updated_at: new Date().toISOString() })
                    .eq("id", linkMeta.id)
                    .is(lockField, null)
                ).catch(() => {});
              }
            }

            // ── Fire-and-forget: send Telegram notification if enabled ──
            if (linkMeta.notify_clicks) {
              sendClickNotificationInMiddleware({
                slug, title: linkMeta.title, ip: visitorIp, ua: rawUa, referer,
                deviceType, clickCount: (linkMeta.current_clicks ?? 0) + 1,
                maxClicks: linkMeta.max_clicks ?? 0,
                country, city, ipVersion, browser,
              });
            }

            return new NextResponse(null, {
              status: 302,
              headers: {
                "Location": rows[0].target_url,
                "Referrer-Policy": "no-referrer",
                "X-Frame-Options": "DENY",
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "no-store, no-cache, must-revalidate, private",
                "Pragma": "no-cache",
              },
            });
          }
        }
      } catch (e: unknown) {
        console.error("[Middleware] Short link error:", e instanceof Error ? e.message : e);
      }
    }
    // Invalid/expired → fall through to page with pathname header
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-next-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Allow static assets through without any processing
  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const accessGrantResponse = maybeGrantAdminAccessByKey(request);
  if (accessGrantResponse) {
    return accessGrantResponse;
  }

  // ═══════════════════════════════════════════════════════════════
  // LOGIN AUTO-REDIRECT & OBFUSCATION
  // ═══════════════════════════════════════════════════════════════
  if (pathname === "/login") {
    // ── SECURITY BY OBSCURITY: Block public access to /login ──
    const expectedKey = process.env.ADMIN_SECRET_KEY;
    // Kiểm tra khoá từ môi trường thay vì fix cứng bảo mật
    const hasKey = Boolean(expectedKey && request.nextUrl.searchParams.get("key") === expectedKey);
    const hasCookie = request.cookies.has(ADMIN_ACCESS_COOKIE_NAME);

    // Check JWT first (if authenticated, they bypass the lock)
    const jwt = request.cookies.get("access_token")?.value;
    let isAuthenticated = false;
    
    if (jwt) {
      try {
        const jwtSecret = process.env.JWT_SECRET;
        if (jwtSecret) {
          await verifyJwtEdge(jwt, jwtSecret);
          isAuthenticated = true;
        } else {
          console.warn("[Middleware] JWT_SECRET is missing; skipping JWT login shortcut.");
        }
      } catch {}
    }

    if (!isAuthenticated && !hasKey && !hasCookie) {
      // Impersonate a 404 Not Found to fool hackers - Chuyển qua Sales Landing Page dằn mặt
      return NextResponse.rewrite(new URL("/blocked-by-security-404", request.url));
    }

    // Set cookie if accessing with key securely for the first time
    if (!isAuthenticated && hasKey && !hasCookie) {
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.searchParams.delete("key"); // strip key from url
      return createAdminAccessGrantRedirect(cleanUrl);
    }

    if (isAuthenticated) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      return NextResponse.redirect(dashboardUrl);
    }

    // Check Supabase session (Google OAuth users)
    const { user, supabaseResponse } = await updateSession(request);
    if (user) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      return NextResponse.redirect(dashboardUrl);
    }
    return supabaseResponse;
  }

  // Allow other public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    // Still update session cookies even for public routes
    const { supabaseResponse } = await updateSession(request);
    return supabaseResponse;
  }

  const isApiRoute = pathname.startsWith("/api/");

  // === Priority 1: JWT (Email/Password or API clients) ===
  // Look in cookies first, then Authorization Header
  let accessToken = request.cookies.get("access_token")?.value;
  if (!accessToken) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      accessToken = authHeader.substring(7);
    }
  }

  if (accessToken) {
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error("JWT_SECRET is not configured");
      }
      const payload = await verifyJwtEdge(accessToken, jwtSecret) as TrustedJwtPayload;

      // JWT is valid — inject account info into request headers
      const requestHeaders = new Headers(request.headers);
      if (payload.accountId) {
        requestHeaders.set("x-account-id", payload.accountId);
      }
      if (payload.email) {
        requestHeaders.set("x-user-email", payload.email);
      }
      if (payload.role) {
        requestHeaders.set("x-user-role", payload.role);
      }
      if (payload.sub) {
        requestHeaders.set("x-user-id", payload.sub);
      }

      // Still update Supabase cookies for any supabase-related operations
      const { supabaseResponse } = await updateSession(request);

      const response = NextResponse.next({
        request: { headers: requestHeaders },
      });

      // Copy Supabase cookies to new response
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, cookie);
      });

      return finalizeAuthenticatedResponse(response, pathname, isApiRoute);
    } catch (e: unknown) {
      const error = e instanceof Error ? e : null;
      console.error("[Middleware] Edge JWT Verify Error details:", error?.message ?? e, "\nStack:", error?.stack);
      // JWT invalid/expired — fall through to Supabase auth check
    }
  }

  // === Priority 2: Supabase session auth (Google OAuth users) ===
  const { user, supabaseResponse } = await updateSession(request);

  // No session → redirect to login (web) or 401 (API)
  if (!user) {
    if (isApiRoute) {
      return withPrivateNoStore(
        NextResponse.json(
          { error: "Unauthorized", message: "Authentication required" },
          { status: 401 }
        )
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return withPrivateNoStore(NextResponse.redirect(loginUrl));
  }

  // Check admin cache first, then DB if miss
  const email = user.email!;
  let adminUser = getCachedAdmin(email);

  if (adminUser === undefined) {
    // Cache miss — query DB
    const { data, error: adminError } = await supabaseAdmin
      .from("admin_users")
      .select("id, email, role, account_id")
      .eq("email", email)
      .single();

    if (adminError) {
      console.error("[Middleware] admin_users lookup failed:", adminError.message, "| email:", email);
    }
    adminUser = data;
    setCachedAdmin(email, adminUser);
  }

  // User exists in Supabase Auth but NOT in admin_users → unauthorized
  if (!adminUser) {
    if (isApiRoute) {
      return withPrivateNoStore(
        NextResponse.json(
          { error: "Forbidden", message: "Admin access required" },
          { status: 403 }
        )
      );
    }
    const unauthorizedUrl = request.nextUrl.clone();
    unauthorizedUrl.pathname = "/unauthorized";
    return withPrivateNoStore(NextResponse.redirect(unauthorizedUrl));
  }

  // Inject account_id into request headers so withAccount can read it
  // without re-verifying session (avoids stale cookie timing issues)
  if (adminUser.account_id) {
    // Clone request headers and add account_id
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-account-id", adminUser.account_id);
    requestHeaders.set("x-user-email", adminUser.email ?? email);
    requestHeaders.set("x-user-role", adminUser.role);
    requestHeaders.set("x-user-id", adminUser.id);

    // Create a new response that forwards the modified request headers
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    // Copy all cookies from supabaseResponse (session refresh) to new response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie);
    });

    return finalizeAuthenticatedResponse(response, pathname, isApiRoute);
  }

  return finalizeAuthenticatedResponse(supabaseResponse, pathname, isApiRoute);
}

function maybeGrantAdminAccessByKey(request: NextRequest): NextResponse | null {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return null;
  }

  const expectedKey = process.env.ADMIN_SECRET_KEY;
  const providedKey = request.nextUrl.searchParams.get("key");
  const hasGrantCookie = request.cookies.has(ADMIN_ACCESS_COOKIE_NAME);

  if (!expectedKey || providedKey !== expectedKey || hasGrantCookie) {
    return null;
  }

  const cleanUrl = request.nextUrl.clone();
  cleanUrl.searchParams.delete("key");
  return createAdminAccessGrantRedirect(cleanUrl);
}

function createAdminAccessGrantRedirect(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.cookies.set(ADMIN_ACCESS_COOKIE_NAME, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_ACCESS_COOKIE_MAX_AGE,
    path: "/",
  });

  return withPrivateNoStore(response);
}

function finalizeAuthenticatedResponse(response: NextResponse, pathname: string, isApiRoute: boolean): NextResponse {
  if (!isApiRoute && !STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return withPrivateNoStore(response);
  }

  return response;
}

function withPrivateNoStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("x-middleware-cache", "no-cache");
  response.headers.append("Vary", "Cookie");
  response.headers.append("Vary", "Authorization");
  return response;
}

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE HELPERS — Edge Runtime compatible, fire-and-forget
// ═══════════════════════════════════════════════════════════════

/** Extract real visitor IP from reverse proxy headers */
function extractVisitorIP(headers: Headers): string {
  // Priority: CF-Connecting-IP > X-Real-IP > X-Forwarded-For > fallback
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.split(",")[0].trim();

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return "0.0.0.0";
}

/** Escape HTML to prevent XSS in middleware templates */
function escapeHtmlMiddleware(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Detect device type from User-Agent */
function detectDeviceInMiddleware(ua: string): string {
  if (!ua) return "unknown";
  if (/bot|spider|crawler|curl|wget|python|httpie|postman|insomnia|zalo|facebookexternalhit|facebot|telegrambot|twitterbot|discordbot|linkedinbot|whatsapp|preview|slurp|ia_archiver/i.test(ua)) return "bot";
  if (/tablet|ipad|nexus 7|nexus 10|kindle/i.test(ua)) return "tablet";
  if (/mobile|android|iphone|ipad|ipod|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

/** Parse browser name from User-Agent for middleware */
function parseBrowserInMiddleware(ua: string): string {
  if (!ua) return "Unknown";
  const patterns: [RegExp, string][] = [
    [/Zalo\//i, "Zalo"],
    [/TelegramBot/i, "Telegram Bot"],
    [/facebookexternalhit|FBAN|FBAV/i, "Facebook"],
    [/WhatsApp/i, "WhatsApp"],
    [/Discordbot/i, "Discord"],
    [/LinkedInBot/i, "LinkedIn"],
    [/Twitterbot/i, "Twitter"],
    [/Edg\//i, "Edge"],
    [/OPR\/|Opera/i, "Opera"],
    [/Chrome\/[\d.]+.*Safari/i, "Chrome"],
    [/Version\/[\d.]+.*Safari/i, "Safari"],
    [/Firefox\//i, "Firefox"],
    [/curl|wget|python|httpie|postman|insomnia/i, "CLI/Bot"],
    [/Googlebot|Google-Read-Aloud/i, "Google Bot"],
    [/bingbot|BingPreview/i, "Bing Bot"],
  ];
  for (const [re, name] of patterns) {
    if (re.test(ua)) return name;
  }
  return "Other";
}

/** Fire-and-forget click insert into short_link_clicks table */
function logClickInMiddleware(
  db: typeof supabaseAdmin,
  info: {
    linkId: string; ip: string; ua: string; referer: string | null;
    deviceType: string; isSuspicious: boolean; reason: string | null;
    country?: string | null; city?: string | null; region?: string | null;
    ipVersion?: string | null; browser?: string | null;
  },
): void {
  // Non-blocking — never delay redirect
  Promise.resolve(
    db.from("short_link_clicks").insert({
      short_link_id: info.linkId,
      ip_address: info.ip,
      user_agent: info.ua,
      referer: info.referer,
      device_type: info.deviceType,
      is_suspicious: info.isSuspicious,
      suspicious_reason: info.reason,
      country: info.country,
      city: info.city,
      country_region: info.region,
      ip_version: info.ipVersion,
      browser: info.browser,
    })
  ).then(({ error }) => {
    if (error) console.error("[Middleware] Click log error:", error.message);
  }).catch((err: unknown) => {
    console.error("[Middleware] Click log exception:", err);
  });
}

/** Fire-and-forget Telegram click notification */
function sendClickNotificationInMiddleware(info: {
  slug: string; title: string | null; ip: string; ua: string; referer: string | null;
  deviceType: string; clickCount: number; maxClicks: number;
  country?: string | null; city?: string | null; ipVersion?: string | null; browser?: string | null;
}): void {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!botToken || !chatId) return;

  const progressPct = info.maxClicks > 0 ? Math.round((info.clickCount / info.maxClicks) * 100) : 0;
  const filled = Math.round(progressPct / 10);
  const bar = `${"▓".repeat(filled)}${"░".repeat(10 - filled)} ${progressPct}%`;

  const deviceEmoji: Record<string, string> = {
    mobile: "📱", desktop: "🖥️", tablet: "📟", bot: "🤖", unknown: "❓",
  };

  const ts = formatDateLabel(new Date());

  // Use passed browser or parse from UA
  const browser = info.browser || parseBrowserInMiddleware(info.ua);

  // Parse referer domain
  let refDomain = "🎯 Trực tiếp";
  if (info.referer) {
    try { refDomain = new URL(info.referer).hostname; } catch { refDomain = info.referer.slice(0, 40); }
  }

  // Geolocation line
  const geoLine = info.country
    ? `📍 <b>Vị trí:</b> ${info.city || '?'}, ${info.country}`
    : '';

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const msg = [
    `🔔 <b>Click mới</b> — <code>${esc(info.slug)}</code>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    info.title ? `📌 <b>${esc(info.title)}</b>` : "",
    ``,
    `${deviceEmoji[info.deviceType] ?? "❓"} <b>Thiết bị:</b> ${info.deviceType}`,
    `🌐 <b>IP:</b> <code>${info.ip}</code> (${info.ipVersion || 'IPv4'})`,
    `🔍 <b>Trình duyệt:</b> ${browser}`,
    `🔗 <b>Nguồn:</b> ${refDomain}`,
    geoLine,
    ``,
    `📊 <b>Click:</b> ${info.clickCount}/${info.maxClicks} (${progressPct}%)`,
    `${bar}`,
    ``,
    `⏰ ${ts}`,
  ].filter(Boolean).join("\n");

  fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId, text: msg, parse_mode: "HTML",
      disable_notification: true,
    }),
  }).catch(() => {}); // fire-and-forget
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - Public images
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
