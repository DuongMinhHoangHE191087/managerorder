import { NextRequest, NextResponse } from "next/server";
import { isMockSessionEnabled } from "@/lib/auth/mock-session";
import { generateAccessToken, generateRefreshToken } from "@/lib/utils/jwt";
import { resolveBestMockAccountId } from "@/lib/mock-account";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

const DEFAULT_MOCK_USER_ID = "00000000-0000-4000-8000-000000000002";
const DEFAULT_MOCK_EMAIL = "e2e-mock@managerorder.local";
const DEFAULT_MOCK_ROLE = "admin_owner";

type MockSessionBody = {
  accountId?: string;
  userId?: string;
  email?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
};

async function resolveMockAccountId(explicitAccountId?: string) {
  return resolveBestMockAccountId(explicitAccountId);
}

export async function POST(request: NextRequest) {
  if (!isMockSessionEnabled(request.nextUrl.hostname)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as MockSessionBody;

  const email = body.email?.trim() || DEFAULT_MOCK_EMAIL;
  const role = body.role?.trim() || DEFAULT_MOCK_ROLE;
  const userId = body.userId?.trim() || DEFAULT_MOCK_USER_ID;
  const accountId = await resolveMockAccountId(body.accountId);

  const accessToken = generateAccessToken({
    sub: userId,
    accountId,
    role,
    email,
  });
  const refreshToken = generateRefreshToken({
    sub: userId,
    accountId,
    role,
    email,
  });

  const response = NextResponse.json({
    success: true,
    data: {
      user: {
        id: userId,
        email,
        firstName: body.firstName?.trim() || "E2E",
        lastName: body.lastName?.trim() || "Mock",
        role,
        accountId,
      },
    },
  });

  response.cookies.set("access_token", accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24,
  });
  response.cookies.set("refresh_token", refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("access_token", "", {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
  response.cookies.set("refresh_token", "", {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
}
