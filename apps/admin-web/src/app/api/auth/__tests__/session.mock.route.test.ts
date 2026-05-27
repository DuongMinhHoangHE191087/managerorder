import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockAccountMocks = vi.hoisted(() => ({
  resolveBestMockAccountId: vi.fn(),
}));

vi.mock("@/lib/mock-account", () => ({
  resolveBestMockAccountId: mockAccountMocks.resolveBestMockAccountId,
}));

import { POST } from "../session/mock/route";

function makeRequest(url: string) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

describe("POST /api/auth/session/mock", () => {
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousMockSession = process.env.E2E_MOCK_SESSION;
  const previousJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    env.NODE_ENV = "development";
    delete env.E2E_MOCK_SESSION;
    env.JWT_SECRET = "test-secret";
    mockAccountMocks.resolveBestMockAccountId.mockResolvedValue("account-local-dev");
  });

  afterAll(() => {
    env.NODE_ENV = previousNodeEnv;
    env.E2E_MOCK_SESSION = previousMockSession;
    env.JWT_SECRET = previousJwtSecret;
  });

  it("allows localhost requests in development without E2E_MOCK_SESSION", async () => {
    const response = await POST(makeRequest("http://localhost:3000/api/auth/session/mock"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.user.accountId).toBe("account-local-dev");
    expect(response.cookies.get("access_token")?.value).toBeTruthy();
    expect(response.cookies.get("refresh_token")?.value).toBeTruthy();
  });

  it("keeps remote hosts blocked when E2E_MOCK_SESSION is disabled", async () => {
    const response = await POST(makeRequest("https://admin.example.com/api/auth/session/mock"));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Not found");
  });
});
