import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockWithAccount, mockWithErrorHandler, createTestRequest, mockRBAC } from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/api/rbac", () => mockRBAC());
vi.mock("@/lib/supabase/repositories/source-accounts.repo", () => ({
  listSourceAccounts: vi.fn(),
  createSourceAccount: vi.fn(),
}));
vi.mock("@/lib/mappers/source-account.mapper", () => ({
  mapRowToSourceAccount: vi.fn((row: Record<string, unknown>) => ({
    id: row.id, email: row.email, provider: row.provider,
    maxSlots: row.max_slots || 1, usedSlots: row.used_slots || 0,
  })),
}));
vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: vi.fn().mockResolvedValue(null),
}));

import { listSourceAccounts, createSourceAccount } from "@/lib/supabase/repositories/source-accounts.repo";
import { GET, POST } from "@/app/api/source-accounts/route";

describe("GET /api/source-accounts", () => {
  beforeEach(() => {
    vi.mocked(listSourceAccounts).mockResolvedValue([
      { id: "sa1", email: "test@netflix.com", provider: "netflix", max_slots: 5, used_slots: 3 } as any,
    ]);
  });

  it("returns mapped source accounts", async () => {
    const res = await GET(createTestRequest("http://localhost/api/source-accounts"), { params: {} } as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].email).toBe("test@netflix.com");
  });
});

describe("POST /api/source-accounts", () => {
  beforeEach(() => {
    vi.mocked(createSourceAccount).mockResolvedValue({
      id: "new-sa1", email: "new@netflix.com", provider: "netflix",
      max_slots: 5, used_slots: 0,
    } as any);
  });

  it("creates source account and returns 201", async () => {
    const res = await POST(createTestRequest("http://localhost/api/source-accounts", {
      method: "POST",
      body: { email: "new@netflix.com", provider: "netflix", expiresAt: "2025-12-31T00:00:00Z" },
    }), { params: {} } as any);
    expect(res.status).toBe(201);
  });

  it("rejects missing email", async () => {
    const res = await POST(createTestRequest("http://localhost/api/source-accounts", {
      method: "POST", body: { provider: "netflix" },
    }), { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("rejects missing provider", async () => {
    const res = await POST(createTestRequest("http://localhost/api/source-accounts", {
      method: "POST", body: { email: "test@test.com" },
    }), { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("handles optional fields with defaults", async () => {
    const res = await POST(createTestRequest("http://localhost/api/source-accounts", {
      method: "POST",
      body: { email: "min@test.com", provider: "spotify", expiresAt: "2025-12-31T00:00:00Z" },
    }), { params: {} } as any);
    expect(res.status).toBe(201);
    expect(createSourceAccount).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ max_slots: 1, used_slots: 0, product_ids: [] })
    );
  });
});
