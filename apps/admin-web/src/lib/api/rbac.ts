import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/utils/jwt";

// ── Role Definitions ───────────────────────────────────────────────────────

export type UserRole =
  | "admin_owner"
  | "sales_staff"
  | "inventory_staff"
  | "customer_support"
  | "accountant";

// ── Permission Definitions ──────────────────────────────────────────────────

export type Permission =
  // Orders
  | "order:create"
  | "order:read"
  | "order:update"
  | "order:delete"
  // Customers
  | "customer:create"
  | "customer:read"
  | "customer:update"
  | "customer:delete"
  // Inventory
  | "inventory:read"
  | "inventory:allocate"
  | "inventory:adjust"
  // Payments
  | "payment:record"
  | "payment:reconcile"
  | "payment:refund"
  // Dashboard
  | "dashboard:read"
  // Settings
  | "settings:read"
  | "settings:write"
  // Activity Logs
  | "logs:read"
  // Calendar
  | "calendar:read"
  | "calendar:write"
  // Users
  | "user:manage";

// ── Permission Matrix ───────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin_owner: [
    "order:create", "order:read", "order:update", "order:delete",
    "customer:create", "customer:read", "customer:update", "customer:delete",
    "inventory:read", "inventory:allocate", "inventory:adjust",
    "payment:record", "payment:reconcile", "payment:refund",
    "dashboard:read",
    "settings:read", "settings:write",
    "logs:read",
    "calendar:read", "calendar:write",
    "user:manage",
  ],
  sales_staff: [
    "order:create", "order:read", "order:update",
    "customer:create", "customer:read", "customer:update",
    "dashboard:read",
    "payment:record",
    "calendar:read", "calendar:write",
  ],
  inventory_staff: [
    "inventory:read", "inventory:allocate", "inventory:adjust",
    "order:read",
    "customer:read",
    "dashboard:read",
  ],
  customer_support: [
    "order:read", "order:update",
    "customer:read", "customer:update",
    "calendar:read", "calendar:write",
    "logs:read",
  ],
  accountant: [
    "order:read",
    "customer:read",
    "payment:record", "payment:reconcile", "payment:refund",
    "dashboard:read",
    "logs:read",
  ],
} as const;

// ── Permission Check Utilities ──────────────────────────────────────────────

/**
 * Check if a role has the given permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has ALL the given permissions.
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Check if a role has ANY of the given permissions.
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/**
 * Get all permissions for a role.
 */
export function getPermissions(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

// ── User Identity ───────────────────────────────────────────────────────────

export interface RBACUser {
  userId: string;
  email: string;
  role: UserRole;
  accountId: string;
  displayName: string | null;
}

interface AdminUserRow {
  id: string;
  email: string | null;
  role: string | null;
  full_name: string | null;
}

const E2E_MOCK_SESSION_HEADER = "x-e2e-mock-session";
const E2E_MOCK_USER_ID = "00000000-0000-4000-8000-000000000002";
const E2E_MOCK_EMAIL = "e2e-mock@managerorder.local";
const E2E_MOCK_ROLE: UserRole = "admin_owner";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUserRole(value: string | null | undefined): value is UserRole {
  return value === "admin_owner"
    || value === "sales_staff"
    || value === "inventory_staff"
    || value === "customer_support"
    || value === "accountant";
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Resolve the current user from the request.
 * Prefers x-user-id injected by middleware and falls back to x-user-email for
 * legacy/session-only flows before verifying the user in admin_users.
 */
export async function resolveUser(
  req: NextRequest,
  accountId: string
): Promise<RBACUser | null> {
  const headerUserId = req.headers.get("x-user-id")?.trim() || null;
  const userEmail = req.headers.get("x-user-email")?.trim();
  const lookupUserId = isUuid(headerUserId) ? headerUserId : null;
  const identityValue = lookupUserId ?? userEmail ?? null;
  const identityColumn = lookupUserId ? "id" : "email";
  const isE2EMockSession = process.env.E2E_MOCK_SESSION === "1";
  const mockSessionHeader = req.headers.get(E2E_MOCK_SESSION_HEADER);

  if (isE2EMockSession && mockSessionHeader === "1") {
    const mockUserId = headerUserId || E2E_MOCK_USER_ID;
    const mockEmail = userEmail || E2E_MOCK_EMAIL;
    const mockRole = req.headers.get("x-user-role");

    return {
      userId: mockUserId,
      email: mockEmail,
      role: isUserRole(mockRole) ? mockRole : E2E_MOCK_ROLE,
      accountId,
      displayName: null,
    };
  }

  const lookupAdminUser = async (
    identity: { column: "id" | "email"; value: string }
  ): Promise<RBACUser | null> => {
    if (identity.column === "id" && !isUuid(identity.value)) {
      return null;
    }

    const { data: adminUser, error } = await supabaseAdmin
      .from("admin_users")
      .select("id, email, role, full_name")
      .eq("account_id", accountId)
      .eq(identity.column, identity.value)
      .maybeSingle();

    if (error || !adminUser) {
      if (error) {
        console.error(
          "[RBAC] admin_users lookup failed:",
          error.message,
          "| identity:",
          identity.column,
          "| value:",
          identity.value,
          "| account:",
          accountId
        );
      }
      return null;
    }

    const typedAdminUser = adminUser as AdminUserRow;

    return {
      userId: typedAdminUser.id,
      email: typedAdminUser.email ?? identity.value,
      role: isUserRole(typedAdminUser.role) ? typedAdminUser.role : "sales_staff",
      accountId,
      displayName: typedAdminUser.full_name ?? null,
    };
  };

  if (identityValue) {
    const resolvedFromHeaders = await lookupAdminUser({
      column: identityColumn,
      value: identityValue,
    });
    if (resolvedFromHeaders) {
      return resolvedFromHeaders;
    }
  }

  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = req.cookies.get("access_token")?.value ?? null;
  const token = bearerToken ?? cookieToken;

  if (!token) {
    return null;
  }

  try {
    const decoded = verifyToken(token);
    if (decoded.accountId !== accountId) {
      return null;
    }

    const resolvedFromTokenUserId = decoded.sub
      ? await lookupAdminUser({ column: "id", value: decoded.sub })
      : null;
    if (resolvedFromTokenUserId) {
      return resolvedFromTokenUserId;
    }

    const resolvedFromTokenEmail = decoded.email
      ? await lookupAdminUser({ column: "email", value: decoded.email })
      : null;
    if (resolvedFromTokenEmail) {
      return resolvedFromTokenEmail;
    }

    if (!isUserRole(decoded.role)) {
      return null;
    }

    return {
      userId: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      accountId,
      displayName: null,
    };
  } catch {
    return null;
  }
}

// ── HOC: requireRole ────────────────────────────────────────────────────────

export type RBACApiHandler<T = object> = (
  request: NextRequest,
  context: { accountId: string; params: T | Promise<T>; user: RBACUser }
) => Promise<NextResponse> | NextResponse;

/**
 * Higher-Order Function wrapping a route handler with role/permission guard.
 *
 * Usage:
 *   export const POST = withErrorHandler(
 *     withAccount(
 *       requireRole(["admin_owner", "sales_staff"])(async (req, { user, accountId }) => {
 *         // `user` is guaranteed to have one of the specified roles
 *       })
 *     )
 *   );
 *
 * Or with permissions:
 *   requirePermissions(["order:create", "payment:record"])(handler)
 */
export function requireRole<T = object>(allowedRoles: UserRole[]) {
  return (handler: RBACApiHandler<T>) => {
    return async (
      request: NextRequest,
      context: { accountId: string; params: T | Promise<T> }
    ) => {
      const user = await resolveUser(request, context.accountId);

      if (!user) {
        return NextResponse.json(
          { error: "Không thể xác thực người dùng" },
          { status: 401 }
        );
      }

      if (!allowedRoles.includes(user.role)) {
        return NextResponse.json(
          {
            error: `Bạn không có quyền thực hiện thao tác này. Yêu cầu vai trò: ${allowedRoles.join(", ")}`,
            requiredRoles: allowedRoles,
            currentRole: user.role,
          },
          { status: 403 }
        );
      }

      return handler(request, { ...context, user });
    };
  };
}

/**
 * Permission-based guard (more granular than role-based).
 */
export function requirePermissions<T = object>(requiredPermissions: Permission[]) {
  return (handler: RBACApiHandler<T>) => {
    return async (
      request: NextRequest,
      context: { accountId: string; params: T | Promise<T> }
    ) => {
      const user = await resolveUser(request, context.accountId);

      if (!user) {
        return NextResponse.json(
          { error: "Không thể xác thực người dùng" },
          { status: 401 }
        );
      }

      if (!hasAllPermissions(user.role, requiredPermissions)) {
        const missing = requiredPermissions.filter(
          (p) => !hasPermission(user.role, p)
        );
        return NextResponse.json(
          {
            error: "Bạn không có đủ quyền truy cập",
            missingPermissions: missing,
            currentRole: user.role,
          },
          { status: 403 }
        );
      }

      return handler(request, { ...context, user });
    };
  };
}
