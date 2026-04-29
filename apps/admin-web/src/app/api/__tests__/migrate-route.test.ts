import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestRequest,
  mockRBAC,
  mockWithAccount,
  mockWithErrorHandler,
} from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/api/rbac", () => mockRBAC());

const supabaseMocks = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockSelect = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn((_table: string) => ({ select: mockSelect }));
  const mockRpc = vi.fn();

  return {
    mockLimit,
    mockSelect,
    mockFrom,
    mockRpc,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: supabaseMocks.mockFrom,
    rpc: (fn: string, params?: Record<string, unknown>) =>
      supabaseMocks.mockRpc(fn, params),
  },
}));

import { GET } from "@/app/api/migrate/route";

describe("GET /api/migrate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENABLE_DEPRECATED_MIGRATE_ROUTE;
    delete process.env.CRON_SECRET;
  });

  it("returns 404 when the deprecated route is disabled", async () => {
    const response = await GET(
      createTestRequest("http://localhost:3000/api/migrate"),
      { params: Promise.resolve({}) } as never,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("ROUTE_DISABLED");
    expect(supabaseMocks.mockFrom).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer secret is missing or invalid", async () => {
    process.env.ENABLE_DEPRECATED_MIGRATE_ROUTE = "1";
    process.env.CRON_SECRET = "expected-secret";

    const response = await GET(
      createTestRequest("http://localhost:3000/api/migrate", {
        headers: {
          authorization: "Bearer wrong-secret",
        },
      }),
      { params: Promise.resolve({}) } as never,
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(supabaseMocks.mockFrom).not.toHaveBeenCalled();
  });

  it("returns a deprecated success payload when required columns already exist", async () => {
    process.env.ENABLE_DEPRECATED_MIGRATE_ROUTE = "1";
    process.env.CRON_SECRET = "expected-secret";

    supabaseMocks.mockLimit
      .mockResolvedValueOnce({
        data: [
          {
            id: "00000000-0000-4000-8000-000000000054",
            password_hash: "hash",
            first_name: "Test",
            last_name: "User",
            status: "active",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [{}], error: null })
      .mockResolvedValueOnce({ data: [{}], error: null })
      .mockResolvedValueOnce({ data: [{}], error: null })
      .mockResolvedValueOnce({ data: [{}], error: null });

    const response = await GET(
      createTestRequest("http://localhost:3000/api/migrate", {
        headers: {
          authorization: "Bearer expected-secret",
        },
      }),
      { params: Promise.resolve({}) } as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({
      deprecated: true,
      status: "ok",
      replacement: "Use forward-only Supabase migrations or internal CLI tasks.",
    });
    expect(supabaseMocks.mockRpc).not.toHaveBeenCalled();
  });
});
