import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

/**
 * Resolve the current user from the request.
 * Requires x-user-email injected by middleware and verifies the user in admin_users.
 */
export async function resolveUser(
  req: NextRequest,
  accountId: string
): Promise<RBACUser | null> {
  const userEmail = req.headers.get("x-user-email")?.trim();
  if (!userEmail) {
    return null;
  }

  const { data: adminUser, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, email, role, full_name")
    .eq("email", userEmail)
    .eq("account_id", accountId)
    .single();

  if (error || !adminUser) {
    if (error) {
      console.error("[RBAC] admin_users lookup failed:", error.message, "| email:", userEmail, "| account:", accountId);
    }
    return null;
  }

  const typedAdminUser = adminUser as AdminUserRow;

  return {
    userId: typedAdminUser.id,
    email: typedAdminUser.email ?? userEmail,
    role: (typedAdminUser.role as UserRole) || "sales_staff",
    accountId,
    displayName: typedAdminUser.full_name ?? null,
  };
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
