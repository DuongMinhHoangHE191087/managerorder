import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  mockRBAC,
  createTestRequest,
  TEST_ACCOUNT_ID,
} from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/api/rbac", () => mockRBAC());
vi.mock("@/domains/inventory", () => ({
  listInventoryKeysForAccount: vi.fn(),
  getInventoryKeyForAccount: vi.fn(),
  createInventoryKeyForAccount: vi.fn(),
  deleteInventoryKeyForAccount: vi.fn(),
}));
vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: vi.fn().mockResolvedValue(null),
}));

import {
  listInventoryKeysForAccount,
  getInventoryKeyForAccount,
  createInventoryKeyForAccount,
  deleteInventoryKeyForAccount,
} from "@/domains/inventory";
import { GET, POST } from "@/app/api/inventory/route";
import { GET as GET_ITEM, DELETE } from "@/app/api/inventory/[id]/route";

function makeLicenseKey(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000044",
    key_code: "ABC-123-DEF",
    product_id: "00000000-0000-4000-8000-000000000045",
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
      makeLicenseKey({ id: "00000000-0000-4000-8000-000000000046", key_code: "KEY-001" }),
      makeLicenseKey({ id: "00000000-0000-4000-8000-000000000047", key_code: "KEY-002", status: "used" }),
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
        body: { keyCode: "NEW-KEY-001", productId: "00000000-0000-4000-8000-000000000045", status: "available" },
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
        productId: "00000000-0000-4000-8000-000000000045",
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
        body: { keyCode: "KEY-100", productId: "00000000-0000-4000-8000-000000000039" },
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
        body: { productId: "00000000-0000-4000-8000-000000000039", status: "available" },
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
        body: { keyCode: "KEY-100", productId: "00000000-0000-4000-8000-000000000039", status: "INVALID_STATUS" },
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
        body: { keyCode: "DUP-KEY", productId: "00000000-0000-4000-8000-000000000039" },
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
      createTestRequest("http://localhost/api/inventory/00000000-0000-4000-8000-000000000044", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000044" }) } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(deleteInventoryKeyForAccount).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000044", TEST_ACCOUNT_ID);
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

describe("GET /api/inventory/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a single key and passes include_deleted when requested", async () => {
    const key = makeLicenseKey({ id: "00000000-0000-4000-8000-000000000046", key_code: "KEY-DETAIL" });
    vi.mocked(getInventoryKeyForAccount).mockResolvedValue(key as any);

    const res = await GET_ITEM(
      createTestRequest("http://localhost/api/inventory/00000000-0000-4000-8000-000000000046?include_deleted=1"),
      { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000046" }) } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.key_code).toBe("KEY-DETAIL");
    expect(getInventoryKeyForAccount).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000046",
      TEST_ACCOUNT_ID,
      { includeDeleted: true },
    );
  });

  it("returns 404 when the key is missing", async () => {
    vi.mocked(getInventoryKeyForAccount).mockResolvedValue(null);

    const res = await GET_ITEM(
      createTestRequest("http://localhost/api/inventory/nonexistent"),
      { params: Promise.resolve({ id: "nonexistent" }) } as any,
    );

    expect(res.status).toBe(404);
  });
});
