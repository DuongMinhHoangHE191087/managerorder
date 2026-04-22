import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { AuthService } from "@/lib/services/auth";
import { registerSchema } from "@/lib/types/validation";
import { successResponse, handleError } from "@/lib/utils/api";
import { checkAuthRateLimit, getClientIp } from "@/lib/api/rate-limiter";

const authService = new AuthService();

function isBootstrapAuthorized(request: NextRequest): boolean {
  const expectedSecret = process.env.ADMIN_SECRET_KEY;
  if (!expectedSecret) {
    return false;
  }

  const providedSecret =
    request.headers.get("x-admin-secret") ??
    request.headers.get("x-bootstrap-secret");

  if (!providedSecret || providedSecret.length !== expectedSecret.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(providedSecret, "utf8"),
    Buffer.from(expectedSecret, "utf8")
  );
}

export async function POST(request: NextRequest) {
  // Rate limiting for account creation
  const ip = getClientIp(request);
  const rateLimit = await checkAuthRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
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

  if (!isBootstrapAuthorized(request)) {
    return NextResponse.json(
      { error: "Registration is restricted to bootstrap access." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const validated = registerSchema.parse(body);

    const result = await authService.register(
      validated.email,
      validated.password,
      validated.firstName,
      validated.lastName,
      validated.accountName
    );

    return NextResponse.json(successResponse(result), { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
