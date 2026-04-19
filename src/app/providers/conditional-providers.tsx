"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { QueryProvider } from "@/shared/providers/query-provider";
import { AdminChromeProvider } from "@/shared/providers/admin-chrome-context";
import { AppChrome } from "@/widgets/layout/app-layout";

const PUBLIC_EXACT_PATHS = new Set([
  "/api-docs",
  "/blocked-by-security-404",
  "/login",
  "/unauthorized",
]);

const PUBLIC_PREFIXES = ["/s/"] as const;

const LazyClientOnlyProviders = dynamic(
  () => import("@/shared/providers/client-only-providers").then((module) => ({ default: module.ClientOnlyProviders })),
  { ssr: false, loading: () => null }
);

function isPublicRoute(pathname: string) {
  return PUBLIC_EXACT_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Wraps children with admin providers ONLY for admin routes.
 * Public routes get children only — no QueryProvider, no Motion, no admin bootstrap.
 */
export function ConditionalProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <LazyClientOnlyProviders />
      <QueryProvider>
        <AdminChromeProvider>
          <AppChrome>{children}</AppChrome>
        </AdminChromeProvider>
      </QueryProvider>
    </>
  );
}
