import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/auth";
import { changePasswordSchema } from "@/lib/types/validation";
import { successResponse, handleError } from "@/lib/utils/api";
import { verifyToken } from "@/lib/utils/jwt";
import { checkAuthRateLimit, getClientIp } from "@/lib/api/rate-limiter";
import { cookies } from "next/headers";

const authService = new AuthService();

/**
 * PUT — Change password for authenticated user.
 * Requires current password verification.
 */
export async function PUT(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimit = await checkAuthRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." },
      { status: 429 }
    );
  }

  try {
    // Get user ID from JWT (either header or cookie)
    let userId: string | null = null;

    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const payload = verifyToken(token);
      userId = payload.sub;
    } else {
      const cookieStore = await cookies();
      const accessToken = cookieStore.get("access_token")?.value;
      if (accessToken) {
        const payload = verifyToken(accessToken);
        userId = payload.sub;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = changePasswordSchema.parse(body);
    await authService.changePassword(userId, validated);

    return NextResponse.json(successResponse({ message: "Đổi mật khẩu thành công" }));
  } catch (error) {
    return handleError(error);
  }
}
