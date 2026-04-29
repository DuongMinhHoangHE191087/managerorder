import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockWithAccount, mockWithErrorHandler, createTestRequest } from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/domains/inventory", () => ({
  listInventoryKeysForAccount: vi.fn(),
  createInventoryKeyForAccount: vi.fn(),
}));
vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: vi.fn().mockResolvedValue(null),
}));

import { listInventoryKeysForAccount, createInventoryKeyForAccount } from "@/domains/inventory";
import { GET, POST } from "@/app/api/inventory/route";

describe("GET /api/inventory", () => {
  beforeEach(() => {
    vi.mocked(listInventoryKeysForAccount).mockResolvedValue([
      { id: "lk1", key_code: "ABC-123", status: "available" } as any,
    ]);
  });

  it("returns license key list", async () => {
    const res = await GET(createTestRequest("http://localhost/api/inventory"), { params: {} } as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
  });
});

describe("POST /api/inventory", () => {
  beforeEach(() => {
    vi.mocked(createInventoryKeyForAccount).mockResolvedValue({
      id: "new-lk1", key_code: "NEW-001", status: "available",
    } as any);
  });

  it("creates license key and returns 201", async () => {
    const res = await POST(createTestRequest("http://localhost/api/inventory", {
      method: "POST",
      body: { keyCode: "NEW-001", productId: "00000000-0000-4000-8000-000000000039", status: "available" },
    }), { params: {} } as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.key_code).toBe("NEW-001");
  });

  it("rejects missing fields", async () => {
    const res = await POST(createTestRequest("http://localhost/api/inventory", {
      method: "POST", body: { status: "available" },
    }), { params: {} } as any);
    expect(res.status).toBe(400);
  });
});
