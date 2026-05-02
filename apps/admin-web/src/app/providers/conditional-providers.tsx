"use client";

import { usePathname } from "next/navigation";
import { QueryProvider } from "@/shared/providers/query-provider";
import { AdminChromeProvider } from "@/shared/providers/admin-chrome-context";
import { AppChrome } from "@/widgets/layout/app-layout";
import { ClientOnlyProviders } from "@/shared/providers/client-only-providers";

const PUBLIC_EXACT_PATHS = new Set([
  "/api-docs",
  "/blocked-by-security-404",
  "/login",
  "/unauthorized",
]);

const PUBLIC_PREFIXES = ["/s/"] as const;

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
      <ClientOnlyProviders />
      <QueryProvider>
        <AdminChromeProvider>
          <AppChrome>{children}</AppChrome>
        </AdminChromeProvider>
      </QueryProvider>
    </>
  );
}
