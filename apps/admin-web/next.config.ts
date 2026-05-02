import type { NextConfig } from "next";

const publicShortLinkCsp = [
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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Standalone output for Docker/DigitalOcean deployment only.
  // Set BUILD_STANDALONE=true in Docker/DO build env.
  // Netlify/Vercel must NOT use standalone (conflicts with their adapters).
  ...(process.env.BUILD_STANDALONE === "true" ? { output: "standalone" as const } : {}),
  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "recharts",
      "date-fns",
      "zod",
      "@supabase/supabase-js",
      "@tanstack/react-query",
      "@tanstack/react-table",
      "lucide-react",
    ],
  },
  // SECURITY: Global headers for all routes
  async headers() {
    return [
      // 1. GLOBAL SECURITY HEADERS (For ALL routes)
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Permissions-Policy", value: "accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), microphone=(), midi=(), payment=(), usb=(), clipboard-read=(), clipboard-write=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Origin-Agent-Cluster", value: "?1" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
      // Short link redirect pages — maximum privacy (no-referrer)
      {
        source: "/s/:slug*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
          { key: "Pragma", value: "no-cache" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Content-Security-Policy", value: publicShortLinkCsp },
        ],
      },
      // API short link redirect legacy — same privacy
      {
        source: "/api/s/:slug*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store, private" },
        ],
      },
      // Auth and security entry pages should never be cached at the CDN layer,
      // otherwise stale HTML can reference chunk hashes from an older deploy.
      {
        source: "/login",
        headers: [
          { key: "Cache-Control", value: "private, no-store, no-cache, max-age=0, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
      {
        source: "/unauthorized",
        headers: [
          { key: "Cache-Control", value: "private, no-store, no-cache, max-age=0, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
      {
        source: "/blocked-by-security-404",
        headers: [
          { key: "Cache-Control", value: "private, no-store, no-cache, max-age=0, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
};

export default nextConfig;
