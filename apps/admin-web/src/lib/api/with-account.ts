import { NextRequest, NextResponse } from "next/server";
import { isMockSessionEnabled, isMockSessionTokenAllowed } from "@/lib/auth/mock-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/utils/jwt";

export type ApiHandler<T extends object = Record<string, never>> = (
  request: NextRequest,
  context: { accountId: string; params: Promise<T> }
) => Promise<NextResponse> | NextResponse;

/**
 * Resolve accountId in order of priority:
 * 1. x-account-id header (injected by middleware after auth verification)
 * 2. (Fallback) Supabase session -> admin_users lookup
 */
export async function resolveAccountId(req: NextRequest): Promise<string | null> {
  const headerAccountId = req.headers.get("x-account-id");
  const isE2EMockSession = isMockSessionEnabled(req.nextUrl.hostname);
  const mockSessionHeader = req.headers.get("x-e2e-mock-session");

  if (isE2EMockSession && mockSessionHeader === "1" && headerAccountId) {
    return headerAccountId;
  }

  // Validate header against JWT to prevent header injection.
  if (headerAccountId) {
    // Priority 1: Validate via Authorization Bearer header.
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

    // Priority 2: Validate via httpOnly cookie (email login users).
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
