import { NextResponse } from "next/server";
import { isApplicationError } from "@/lib/utils/errors";

const ACCOUNT_SHARE_PUBLIC_CSP = [
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

export function applyAccountSharePublicSecurityHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set(
    "Permissions-Policy",
    "accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), microphone=(), midi=(), payment=(), usb=(), clipboard-read=(), clipboard-write=(self)",
  );
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("Origin-Agent-Cluster", "?1");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("Content-Security-Policy", ACCOUNT_SHARE_PUBLIC_CSP);
  return response;
}

export function createAccountSharePublicErrorResponse(error: unknown) {
  if (isApplicationError(error)) {
    return applyAccountSharePublicSecurityHeaders(
      NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      ),
    );
  }

  return applyAccountSharePublicSecurityHeaders(
    NextResponse.json(
      { error: "Không thể xử lý link share lúc này", code: "INTERNAL_SERVER_ERROR" },
      { status: 500 },
    ),
  );
}
