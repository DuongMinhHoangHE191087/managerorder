export function resolveInternalRedirectPath(
  nextValue: string | null | undefined,
  redirectValue: string | null | undefined,
  fallback = "/dashboard",
): string {
  const candidates = [nextValue, redirectValue, fallback];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value) {
      continue;
    }

    if (value.startsWith("/") && !value.startsWith("//")) {
      return value;
    }
  }

  return fallback;
}

export function buildLoginCallbackUrl(origin: string, nextPath: string): string {
  const callbackUrl = new URL("/api/auth/callback", origin);
  callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl.toString();
}

export function buildGoogleAdminLoginUrl(nextPath: string): string {
  const searchParams = new URLSearchParams();
  searchParams.set("mode", "login");
  searchParams.set("next", nextPath);
  return `/api/auth/google/login?${searchParams.toString()}`;
}
