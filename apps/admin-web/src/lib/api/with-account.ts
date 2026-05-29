import { NextRequest, NextResponse } from "next/server";
import { isMockSessionEnabled, isMockSessionTokenAllowed } from "@/lib/auth/mock-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/utils/jwt";
import crypto from "crypto";

export type ApiHandler<T extends object = Record<string, never>> = (
  request: NextRequest,
  context: { accountId: string; params: Promise<T> }
) => Promise<NextResponse> | NextResponse;

function verifyAuthSignature(accountId: string, userId: string, email: string, role: string, signature: string, secret: string): boolean {
  const data = `${accountId}:${userId}:${email}:${role}`;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(data);
  const calculated = hmac.digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return calculated === signature;
}

/**
 * Resolve accountId in order of priority:
 * 1. x-account-id header with a valid server-signed x-auth-signature
 * 2. Custom JWT (Authorization header or access_token cookie)
 * 3. (Fallback) Supabase session -> admin_users lookup
 */
export async function resolveAccountId(req: NextRequest): Promise<string | null> {
  const headerAccountId = req.headers.get("x-account-id");
  const signature = req.headers.get("x-auth-signature");
  const email = req.headers.get("x-user-email");
  const role = req.headers.get("x-user-role");
  const userId = req.headers.get("x-user-id");
  const jwtSecret = process.env.JWT_SECRET;

  // Priority 1: Verify the server-signed HMAC signature from middleware.
  // Bypasses slower DB/Auth API roundtrips safely.
  if (headerAccountId && signature && email && role && userId && jwtSecret) {
    if (verifyAuthSignature(headerAccountId, userId, email, role, signature, jwtSecret)) {
      return headerAccountId;
    }
  }

  const isE2EMockSession = isMockSessionEnabled(req.nextUrl.hostname);
  const mockSessionHeader = req.headers.get("x-e2e-mock-session");

  if (isE2EMockSession && mockSessionHeader === "1" && headerAccountId) {
    return headerAccountId;
  }

  // Validate header against JWT to prevent header injection.
  if (headerAccountId) {
    // Priority 2a: Validate via Authorization Bearer header.
    try {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const decoded = verifyToken(token);
        if (isMockSessionTokenAllowed(decoded, req.nextUrl.hostname) && decoded.accountId === headerAccountId) {
          return headerAccountId;
        }
      }
    } catch {
      // Bearer JWT verification failed.
    }

    // Priority 2b: Validate via httpOnly cookie (email login users).
    try {
      const cookieToken = req.cookies.get("access_token")?.value;
      if (cookieToken) {
        const decoded = verifyToken(cookieToken);
        if (isMockSessionTokenAllowed(decoded, req.nextUrl.hostname) && decoded.accountId === headerAccountId) {
          return headerAccountId;
        }
      }
    } catch {
      // Cookie JWT verification failed.
    }
  }

  // Fallback: session-based auth.
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email) {
      const normalizedEmail = user.email.trim().toLowerCase();
      const { data: adminUser } = await supabaseAdmin
        .from("admin_users")
        .select("account_id")
        .ilike("email", normalizedEmail)
        .single();

      if (adminUser?.account_id) {
        return adminUser.account_id;
      }
    }
  } catch {
    // Session check failed.
  }

  // Explicitly deny any fallback to mock/test account IDs in both dev and prod.
  return null;
}

/**
 * Wrap Next.js API route handlers with account resolution.
 *
 * This HOC does not catch errors; use withErrorHandler() around it to keep
 * standardized API error responses in one place.
 */
export function withAccount<T extends object = Record<string, never>>(handler: ApiHandler<T>) {
  return async (request: NextRequest, { params }: { params: Promise<T> }) => {
    const accountId = await resolveAccountId(request);

    if (!accountId) {
      return NextResponse.json(
        { error: "Unauthorized - phiên đăng nhập không hợp lệ" },
        { status: 401 }
      );
    }

    return await handler(request, { accountId, params });
  };
}
