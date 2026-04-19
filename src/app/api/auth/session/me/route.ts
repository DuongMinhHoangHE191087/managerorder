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

    if (!accessToken) {
      return NextResponse.json({ data: null }, { status: 200 });
    }

    const payload = verifyToken(accessToken);
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
