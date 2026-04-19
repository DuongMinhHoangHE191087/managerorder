import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/auth";
import { refreshTokenSchema } from "@/lib/types/validation";
import { successResponse, handleError } from "@/lib/utils/api";
import { checkAuthRateLimit, getClientIp } from "@/lib/api/rate-limiter";

const authService = new AuthService();

export async function POST(request: NextRequest) {
  // Rate limiting for token refresh
  const ip = getClientIp(request);
  const rateLimit = await checkAuthRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rateLimit.resetAt),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const validated = refreshTokenSchema.parse(body);

    const result = await authService.refreshTokens(validated.refreshToken);

    return NextResponse.json(successResponse(result));
  } catch (error) {
    return handleError(error);
  }
}

