import { test as setup, expect } from "@playwright/test";
import jwt from "jsonwebtoken";

const AUTH_FILE = "e2e/.auth/user.json";
const DEFAULT_MOCK_ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const DEFAULT_MOCK_USER_ID = "00000000-0000-4000-8000-000000000002";
const DEFAULT_MOCK_EMAIL = "e2e-mock@managerorder.local";
const DEFAULT_MOCK_ROLE = "admin_owner";

function getCookieDomain() {
  const rawBaseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";
  return new URL(rawBaseUrl).hostname;
}

function issueLocalMockSession() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("[E2E auth.setup] JWT_SECRET is required to create local mock session");
  }

  const accountId = process.env.E2E_MOCK_ACCOUNT_ID || DEFAULT_MOCK_ACCOUNT_ID;
  const payload = {
    sub: DEFAULT_MOCK_USER_ID,
    accountId,
    role: DEFAULT_MOCK_ROLE,
    email: DEFAULT_MOCK_EMAIL,
  };

  const accessToken = jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: "24h" });
  const refreshToken = jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: "7d" });

  return { accessToken, refreshToken, accountId };
}

setup("authenticate", async ({ page }) => {
  setup.setTimeout(180_000);

  const accountId = process.env.E2E_MOCK_ACCOUNT_ID || DEFAULT_MOCK_ACCOUNT_ID;
  const mockSessionResponse = await page.request
    .post("/api/auth/session/mock", {
      data: process.env.E2E_MOCK_ACCOUNT_ID ? { accountId } : {},
      timeout: 30_000,
    })
    .catch(() => null);

  if (mockSessionResponse?.ok()) {
    await page.context().storageState({ path: AUTH_FILE });
    return;
  }

  if (process.env.E2E_ALLOW_LOCAL_MOCK_FALLBACK !== "1") {
    const status = mockSessionResponse ? mockSessionResponse.status() : "request failed";
    throw new Error(
      `[E2E auth.setup] Mock session endpoint failed (${status}). ` +
        "Fix /api/auth/session/mock or set E2E_MOCK_ACCOUNT_ID to an existing account."
    );
  }

  const mockSession = issueLocalMockSession();
  expect(mockSession.accountId).toBeTruthy();
  const cookieDomain = getCookieDomain();

  await page.context().addCookies([
    {
      name: "access_token",
      value: mockSession.accessToken,
      domain: cookieDomain,
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "refresh_token",
      value: mockSession.refreshToken,
      domain: cookieDomain,
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  await page.context().storageState({ path: AUTH_FILE });
});
