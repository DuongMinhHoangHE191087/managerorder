const LOCAL_DEV_MOCK_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);
const E2E_MOCK_USER_ID = "00000000-0000-4000-8000-000000000002";
const E2E_MOCK_EMAIL = "e2e-mock@managerorder.local";

function normalizeHostname(hostOrUrl: string | null | undefined): string | null {
  const value = hostOrUrl?.trim();
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return value.replace(/:\d+$/, "").toLowerCase();
  }
}

export function isLocalDevMockSessionHost(hostOrUrl: string | null | undefined): boolean {
  const hostname = normalizeHostname(hostOrUrl);
  if (!hostname) {
    return false;
  }

  return process.env.NODE_ENV === "development" && LOCAL_DEV_MOCK_HOSTNAMES.has(hostname);
}

export function isMockSessionEnabled(hostOrUrl?: string | null | undefined): boolean {
  return process.env.E2E_MOCK_SESSION === "1" || isLocalDevMockSessionHost(hostOrUrl);
}

export function isMockSessionTokenAllowed(
  decoded: { sub?: string; email?: string },
  hostOrUrl?: string | null | undefined,
): boolean {
  const isMockIdentity = decoded.sub === E2E_MOCK_USER_ID || decoded.email === E2E_MOCK_EMAIL;
  return !isMockIdentity || isMockSessionEnabled(hostOrUrl);
}
