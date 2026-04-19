import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/utils/jwt";

export type ApiHandler<T = object> = (
  request: NextRequest,
  context: { accountId: string; params: T | Promise<T> }
) => Promise<NextResponse> | NextResponse;

/**
 * Resolve accountId in order of priority:
 * 1. x-account-id header (injected by middleware after auth verification)
 * 2. (Fallback) Supabase session → admin_users lookup
 */
export async function resolveAccountId(req: NextRequest): Promise<string | null> {
  const headerAccountId = req.headers.get("x-account-id");

  // Validate header against JWT to prevent header injection
  if (headerAccountId) {
    // Priority 1: Validate via Authorization Bearer header
    try {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const decoded = verifyToken(token);
        if (decoded.accountId === headerAccountId) {
          return headerAccountId;
        }
      }
    } catch {
      // Bearer JWT verification failed
    }

    // Priority 2: Validate via httpOnly cookie (email login users)
    try {
      const cookieToken = req.cookies.get("access_token")?.value;
      if (cookieToken) {
        const decoded = verifyToken(cookieToken);
        if (decoded.accountId === headerAccountId) {
          return headerAccountId;
        }
      }
    } catch {
      // Cookie JWT verification failed
    }
  }

  // Fallback: session-based auth
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user?.email) {
      const { data: adminUser } = await supabaseAdmin
        .from("admin_users")
        .select("account_id")
        .eq("email", user.email)
        .single();

      if (adminUser?.account_id) {
        return adminUser.account_id;
      }
    }
  } catch {
    // Session check failed
  }

  // Explicitly deny any fallback to mock/test account IDs in both dev and prod
  return null;

  return null;
}

/**
 * Higher-Order Function to wrap Next.js API route handlers.
 * It automatically abstracts away:
 * 1. Verifying Supabase auth session.
 * 2. Looking up admin_users for accountId.
 * 3. Returning 401 if no valid session.
 *
 * NOTE: This HOC does NOT catch errors — use withErrorHandler() around it
 * to get standardized error responses. Keeping error handling in one place
 * avoids duplicate catch blocks and inconsistent response formats.
 */
export function withAccount<T = object>(handler: ApiHandler<T>) {
  return async (request: NextRequest, { params }: { params: T | Promise<T> }) => {
    const accountId = await resolveAccountId(request);
    
    if (!accountId) {
      return NextResponse.json(
        { error: "Unauthorized — phiên đăng nhập không hợp lệ" },
        { status: 401 }
      );
    }

    // Let errors propagate to withErrorHandler for consistent error responses
    return await handler(request, { accountId, params });
  };
}
