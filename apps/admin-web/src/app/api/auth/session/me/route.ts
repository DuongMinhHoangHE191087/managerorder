import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/utils/jwt";
import { AuthRepository } from "@/lib/services/auth";

const authRepo = new AuthRepository();

/**
 * GET — Read current user profile from httpOnly access_token cookie.
 * Used by client-side auth store to check session status.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!accessToken && !refreshToken) {
      return NextResponse.json({ data: null }, { status: 200 });
    }

    let payload: ReturnType<typeof verifyToken> | null = null;
    try {
      payload = verifyToken(accessToken ?? refreshToken ?? "");
    } catch {
      if (!refreshToken || refreshToken === accessToken) {
        return NextResponse.json({ data: null }, { status: 200 });
      }

      try {
        payload = verifyToken(refreshToken);
      } catch {
        return NextResponse.json({ data: null }, { status: 200 });
      }
    }

    if (!payload) {
      return NextResponse.json({ data: null }, { status: 200 });
    }

    if (process.env.E2E_MOCK_SESSION === "1") {
      const [firstName = "E2E", ...rest] = payload.email.split("@")[0]?.split(/[._-]+/) ?? [];
      return NextResponse.json({
        data: {
          id: payload.sub,
          email: payload.email,
          firstName,
          lastName: rest.join(" "),
          role: payload.role,
          accountId: payload.accountId,
        },
      });
    }

    const user = await authRepo.findUserById(payload.sub);

    if (!user) {
      return NextResponse.json({ data: null }, { status: 200 });
    }

    return NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        accountId: user.accountId,
      },
    });
  } catch {
    // Token expired or invalid
    return NextResponse.json({ data: null }, { status: 200 });
  }
}
