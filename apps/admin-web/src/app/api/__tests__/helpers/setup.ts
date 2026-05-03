/**
 * Shared test setup for API route tests.
 * Mocks the withAccount middleware to always inject a test accountId,
 * bypassing Supabase auth and JWT verification.
 */
import { vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

export const TEST_ACCOUNT_ID = "550e8400-e29b-41d4-a716-446655440000";
export const TEST_USER_ID = "test-user-id-001";
export const TEST_USER_EMAIL = "test-user@local";
export const TEST_USER_ROLE = "admin_owner";

process.env.E2E_MOCK_SESSION ??= "1";

/**
 * Set up standard API route mocks. Call in vi.mock() blocks BEFORE importing routes.
 *
 * Usage at top of test file:
 * ```ts
 * vi.mock("@/lib/api/with-account", () => mockWithAccount());
 * vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
 * ```
 */
export function mockWithAccount() {
  return {
    withAccount: (handler: (...args: any[]) => any) => {
      return async (request: NextRequest, ctx?: unknown) => {
        return handler(request, {
          accountId: TEST_ACCOUNT_ID,
          params: (ctx as any)?.params ?? {},
        });
      };
    },
  };
}

export function mockWithErrorHandler() {
  return {
    withErrorHandler: (handler: (...args: any[]) => any) => {
      return async (request: NextRequest, ctx?: unknown) => {
        try {
          return await handler(request, ctx);
        } catch (error: unknown) {
          // Simulate ZodError → 400
          if (error && typeof error === "object" && "issues" in error) {
            return NextResponse.json(
              { error: { message: "Validation error", code: "VALIDATION_ERROR" } },
              { status: 400 }
            );
          }
          // Application error with status
          if (error instanceof Error && "statusCode" in error) {
            const appErr = error as Error & { statusCode: number; code: string };
            return NextResponse.json(
              { error: { message: appErr.message, code: appErr.code } },
              { status: appErr.statusCode }
            );
          }
          // Generic error
          const msg = error instanceof Error ? error.message : "Internal Server Error";
          return NextResponse.json(
            { error: msg },
            { status: 500 }
          );
        }
      };
    },
    createErrorResponse: (
      message: string,
      code: string,
      status = 400,
      details?: Record<string, unknown>
    ) =>
      NextResponse.json(
        {
          error: {
            message,
            code,
            details: details && Object.keys(details).length > 0 ? details : undefined,
          },
        },
        { status }
      ),
    createSuccessResponse: (data: unknown, options?: { status?: number; meta?: Record<string, unknown> }) => {
      const { status = 200, meta } = options ?? {};
      return NextResponse.json({ data, ...(meta ? { meta } : {}) }, { status });
    },
  };
}

export function mockResolveUser() {
  return vi.importActual<typeof import("@/lib/api/rbac")>("@/lib/api/rbac").then((actual) => ({
    ...actual,
    resolveUser: vi.fn(),
  }));
}

export function mockRBAC(options?: {
  user?: Partial<{
    userId: string;
    email: string;
    role: string;
    accountId: string;
    displayName: string | null;
  }> | null;
  allowPermissions?: boolean;
  allowRoles?: boolean;
}) {
  return vi.importActual<typeof import("@/lib/api/rbac")>("@/lib/api/rbac").then((actual) => {
    const resolvedUser =
      options?.user === null
        ? null
        : {
            userId: TEST_USER_ID,
            email: TEST_USER_EMAIL,
            role: TEST_USER_ROLE,
            accountId: TEST_ACCOUNT_ID,
            displayName: "Test User",
            ...(options?.user ?? {}),
          };
    const allowPermissions = options?.allowPermissions ?? true;
    const allowRoles = options?.allowRoles ?? true;
    const resolveUser = vi.fn().mockResolvedValue(resolvedUser);

    const unauthorized = () =>
      NextResponse.json(
        { error: "Khong the xac thuc nguoi dung" },
        { status: 401 }
      );

    const forbiddenPermissions = (requiredPermissions: string[]) =>
      NextResponse.json(
        {
          error: "Ban khong co du quyen truy cap",
          missingPermissions: requiredPermissions,
          currentRole: resolvedUser?.role ?? null,
        },
        { status: 403 }
      );

    const forbiddenRoles = (allowedRoles: string[]) =>
      NextResponse.json(
        {
          error: "Ban khong co quyen thuc hien thao tac nay",
          requiredRoles: allowedRoles,
          currentRole: resolvedUser?.role ?? null,
        },
        { status: 403 }
      );

    return {
      ...actual,
      resolveUser,
      hasPermission: vi.fn(() => allowPermissions),
      hasAllPermissions: vi.fn(() => allowPermissions),
      hasAnyPermission: vi.fn(() => allowPermissions),
      requirePermissions: vi.fn((requiredPermissions: string[]) => (handler: (...args: any[]) => any) => {
        return async (request: NextRequest, context: { accountId: string; params?: unknown }) => {
          const user = await resolveUser(request, context.accountId);
          if (!user) {
            return unauthorized();
          }
          if (!allowPermissions) {
            return forbiddenPermissions(requiredPermissions);
          }
          return handler(request, { ...context, user });
        };
      }),
      requireRole: vi.fn((allowedRoles: string[]) => (handler: (...args: any[]) => any) => {
        return async (request: NextRequest, context: { accountId: string; params?: unknown }) => {
          const user = await resolveUser(request, context.accountId);
          if (!user) {
            return unauthorized();
          }
          if (!allowRoles) {
            return forbiddenRoles(allowedRoles);
          }
          return handler(request, { ...context, user });
        };
      }),
    };
  });
}

/**
 * Create a NextRequest with proper configuration for testing
 */
export function createTestRequest(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
) {
  const init: RequestInit = {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "x-account-id": TEST_ACCOUNT_ID,
      "x-user-id": TEST_USER_ID,
      "x-user-email": TEST_USER_EMAIL,
      "x-user-role": TEST_USER_ROLE,
      "x-e2e-mock-session": "1",
      ...(options?.headers ?? {}),
    },
  };
  if (options?.body) {
    init.body = JSON.stringify(options.body);
  }
  return new NextRequest(url, init as any);
}
