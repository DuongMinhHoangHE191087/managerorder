import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  createTestRequest,
  TEST_ACCOUNT_ID,
} from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/domains/inventory", () => ({
  listInventoryKeysForAccount: vi.fn(),
  createInventoryKeyForAccount: vi.fn(),
  deleteInventoryKeyForAccount: vi.fn(),
}));
vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: vi.fn().mockResolvedValue(null),
}));

import {
  listInventoryKeysForAccount,
  createInventoryKeyForAccount,
  deleteInventoryKeyForAccount,
} from "@/domains/inventory";
import { GET, POST } from "@/app/api/inventory/route";
import { DELETE } from "@/app/api/inventory/[id]/route";

function makeLicenseKey(overrides: Record<string, unknown> = {}) {
  return {
    id: "lk-uuid-001",
    key_code: "ABC-123-DEF",
    product_id: "prod-uuid-001",
    account_id: TEST_ACCOUNT_ID,
    status: "available",
    order_id: null,
    assigned_at: null,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("GET /api/inventory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns license key list with status 200", async () => {
    const mockKeys = [
      makeLicenseKey({ id: "lk-1", key_code: "KEY-001" }),
      makeLicenseKey({ id: "lk-2", key_code: "KEY-002", status: "used" }),
    ];
    vi.mocked(listInventoryKeysForAccount).mockResolvedValue(mockKeys as any);

    const res = await GET(createTestRequest("http://localhost/api/inventory"), { params: {} } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].key_code).toBe("KEY-001");
    expect(body.data[1].status).toBe("used");
    expect(listInventoryKeysForAccount).toHaveBeenCalledWith(TEST_ACCOUNT_ID);
  });

  it("returns empty array when no keys exist", async () => {
    vi.mocked(listInventoryKeysForAccount).mockResolvedValue([]);

    const res = await GET(createTestRequest("http://localhost/api/inventory"), { params: {} } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("returns 500 when service throws", async () => {
    vi.mocked(listInventoryKeysForAccount).mockRejectedValue(new Error("DB connection failed"));

    const res = await GET(createTestRequest("http://localhost/api/inventory"), { params: {} } as any);
    expect(res.status).toBe(500);
  });
});

describe("POST /api/inventory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates license key with valid input and returns 201", async () => {
    const created = makeLicenseKey({ id: "new-lk", key_code: "NEW-KEY-001" });
    vi.mocked(createInventoryKeyForAccount).mockResolvedValue(created as any);

    const res = await POST(
      createTestRequest("http://localhost/api/inventory", {
        method: "POST",
        body: { keyCode: "NEW-KEY-001", productId: "prod-uuid-001", status: "available" },
      }),
      { params: {} } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.key_code).toBe("NEW-KEY-001");
    expect(createInventoryKeyForAccount).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({
        keyCode: "NEW-KEY-001",
        productId: "prod-uuid-001",
        status: "available",
      }),
    );
  });

  it("defaults status to available when not provided", async () => {
    const created = makeLicenseKey();
    vi.mocked(createInventoryKeyForAccount).mockResolvedValue(created as any);

    await POST(
      createTestRequest("http://localhost/api/inventory", {
        method: "POST",
        body: { keyCode: "KEY-100", productId: "prod-1" },
      }),
      { params: {} } as any,
    );

    expect(createInventoryKeyForAccount).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({ status: "available" }),
    );
  });

  it("rejects request missing keyCode", async () => {
    const res = await POST(
      createTestRequest("http://localhost/api/inventory", {
        method: "POST",
        body: { productId: "prod-1", status: "available" },
      }),
      { params: {} } as any,
    );

    expect(res.status).toBe(400);
    expect(createInventoryKeyForAccount).not.toHaveBeenCalled();
  });

  it("rejects invalid status enum", async () => {
    const res = await POST(
      createTestRequest("http://localhost/api/inventory", {
        method: "POST",
        body: { keyCode: "KEY-100", productId: "prod-1", status: "INVALID_STATUS" },
      }),
      { params: {} } as any,
    );

    expect(res.status).toBe(400);
  });

  it("returns 500 when service throws", async () => {
    vi.mocked(createInventoryKeyForAccount).mockRejectedValue(new Error("Duplicate key_code"));

    const res = await POST(
      createTestRequest("http://localhost/api/inventory", {
        method: "POST",
        body: { keyCode: "DUP-KEY", productId: "prod-1" },
      }),
      { params: {} } as any,
    );

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/inventory/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes key and returns success", async () => {
    vi.mocked(deleteInventoryKeyForAccount).mockResolvedValue(undefined);

    const res = await DELETE(
      createTestRequest("http://localhost/api/inventory/lk-uuid-001", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "lk-uuid-001" }) } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(deleteInventoryKeyForAccount).toHaveBeenCalledWith("lk-uuid-001", TEST_ACCOUNT_ID);
  });

  it("returns 500 when service throws", async () => {
    vi.mocked(deleteInventoryKeyForAccount).mockRejectedValue(new Error("License key not found"));

    const res = await DELETE(
      createTestRequest("http://localhost/api/inventory/nonexistent-id", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "nonexistent-id" }) } as any,
    );

    expect(res.status).toBe(500);
  });
});
