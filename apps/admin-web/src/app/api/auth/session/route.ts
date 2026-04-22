import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/auth";
import { loginSchema } from "@/lib/types/validation";
import { handleError } from "@/lib/utils/api";
import {
  checkAuthRateLimit,
  getClientIp,
  checkAccountLockout,
  recordLoginFailure,
  clearLoginFailures,
} from "@/lib/api/rate-limiter";

const authService = new AuthService();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/**
 * POST — Login with email/password, set JWT tokens as httpOnly cookies.
 * This prevents XSS attacks from stealing tokens via JavaScript.
 */
export async function POST(request: NextRequest) {
  // IP-based rate limiting
  const ip = getClientIp(request);
  const rateLimit = await checkAuthRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều lần thử. Vui lòng đợi và thử lại." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const validated = loginSchema.parse(body);

    // Per-email lockout check
    const lockout = await checkAccountLockout(validated.email);
    if (!lockout.allowed) {
      return NextResponse.json(
        { error: "Tài khoản tạm khóa do quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(lockout.retryAfterMs / 1000)),
          },
        }
      );
    }

    let result;
    try {
      console.log('[Auth Session] Attempting login for:', validated.email);
      result = await authService.login(validated.email, validated.password);
      console.log('[Auth Session] Login success for:', validated.email);
    } catch (loginError) {
      console.error('[Auth Session] Login failed for:', validated.email, 'Error:', loginError instanceof Error ? loginError.message : loginError);
      // Record failed attempt for lockout
      await recordLoginFailure(validated.email);
      throw loginError;
    }

    // Login success — clear lockout failures
    await clearLoginFailures(validated.email);

    const response = NextResponse.json({
      success: true,
      data: { user: result.user },
    });

    // Set tokens as httpOnly cookies — inaccessible to JavaScript
    response.cookies.set("access_token", result.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24, // 24 hours
    });

    response.cookies.set("refresh_token", result.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('[Auth Session] Final error:', error instanceof Error ? error.message : error);
    return handleError(error);
  }
}

/**
 * DELETE — Logout by clearing JWT cookies.
 */
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
