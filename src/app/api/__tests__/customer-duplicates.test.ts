import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  createTestRequest,
  TEST_ACCOUNT_ID,
} from "./helpers/setup";

// Mock middleware
vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());

// Mock supabaseAdmin
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { POST } from "@/app/api/customers/duplicates/route";

// ── Helpers ──────────────────────────────────────────────────

function createDupRequest(body: unknown) {
  return createTestRequest("http://localhost:3000/api/customers/duplicates", {
    method: "POST",
    body,
  });
}

function mockContactQuery(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

function mockFallbackQuery(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

function createSequentialContactBuilder(
  results: Array<{ data: unknown; error: unknown }>,
) {
  let selectCount = 0;
  return {
    select: vi.fn(() => {
      const result = results[Math.min(selectCount, results.length - 1)];
      selectCount += 1;
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(result),
      };
    }),
  };
}

function createLookupBuilder(data: unknown[]) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

beforeEach(() => vi.clearAllMocks());

// ── Tests ────────────────────────────────────────────────────

describe("POST /api/customers/duplicates", () => {
  it("finds duplicates by name via RPC (pg_trgm)", async () => {
    mockRpc.mockResolvedValue({
      data: [
        { id: "dup1", full_name: "Nguyễn Văn A", similarity: 0.85 },
      ],
      error: null,
    });

    const request = createDupRequest({ name: "Nguyễn Văn A" });
    const response = await POST(request, { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe("dup1");
    expect(json.data[0].matchType).toBe("name");
    expect(json.data[0].similarity).toBe(0.85);
  });

  it("falls back to ILIKE when RPC returns null", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const fallback = mockFallbackQuery([
      { id: "dup2", full_name: "Trần Thị B" },
    ]);
    mockFrom.mockImplementation((table: string) => {
      if (table === "customers") return fallback;
      return mockContactQuery([]);
    });

    const request = createDupRequest({ name: "Trần Thị B" });
    const response = await POST(request, { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].matchType).toBe("name");
    expect(json.data[0].similarity).toBe(0.7); // fallback default
  });

  it("finds duplicates by contact exact match", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const contactChain = mockContactQuery([
      {
        customer_id: "dup3",
        value: "0912345678",
        customers: {
          id: "dup3",
          full_name: "Lê Văn C",
          account_id: TEST_ACCOUNT_ID,
          deleted_at: null,
        },
      },
    ]);
    mockFrom.mockImplementation((table: string) => {
      if (table === "customer_contacts") return contactChain;
      return mockContactQuery([]);
    });

    const request = createDupRequest({
      name: "Somebody",
      contacts: [{ value: "0912345678" }],
    });
    const response = await POST(request, { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe("dup3");
    expect(json.data[0].matchType).toBe("contact");
    expect(json.data[0].matchValue).toBe("0912345678");
  });

  it('merges to "both" when name AND contact match same customer', async () => {
    // Name match
    mockRpc.mockResolvedValue({
      data: [{ id: "dup4", full_name: "Phạm D", similarity: 0.8 }],
      error: null,
    });

    // Contact match for same customer
    const contactChain = mockContactQuery([
      {
        customer_id: "dup4",
        value: "test@email.com",
        customers: {
          id: "dup4",
          full_name: "Phạm D",
          account_id: TEST_ACCOUNT_ID,
          deleted_at: null,
        },
      },
    ]);
    mockFrom.mockImplementation((table: string) => {
      if (table === "customer_contacts") return contactChain;
      return mockContactQuery([]);
    });

    const request = createDupRequest({
      name: "Phạm D",
      contacts: [{ value: "test@email.com" }],
    });
    const response = await POST(request, { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].matchType).toBe("both");
    expect(json.data[0].similarity).toBe(0.9); // max(0.8, 0.9)
  });

  it("excludes customer by excludeId", async () => {
    const EXCLUDE_ID = "550e8400-e29b-41d4-a716-446655440099";

    mockRpc.mockResolvedValue({
      data: [
        { id: EXCLUDE_ID, full_name: "Self", similarity: 1.0 },
        { id: "other-id", full_name: "Other", similarity: 0.6 },
      ],
      error: null,
    });

    const request = createDupRequest({
      name: "Self",
      excludeId: EXCLUDE_ID,
    });
    const response = await POST(request, { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    // Self should be excluded
    expect(json.data.every((d: { id: string }) => d.id !== EXCLUDE_ID)).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe("other-id");
  });

  it("returns empty array when no duplicates found", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const request = createDupRequest({ name: "Unique Customer Name" });
    const response = await POST(request, { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toEqual([]);
  });

  it("rejects request with empty name", async () => {
    const request = createDupRequest({ name: "" });
    const response = await POST(request, { params: {} } as any);

    expect(response.status).toBe(400);
  });

  it("filters out contacts from different accounts", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const contactChain = mockContactQuery([
      {
        customer_id: "other-acc",
        value: "0999888777",
        customers: {
          id: "other-acc",
          full_name: "Someone Else",
          account_id: "different-account-id", // different account
          deleted_at: null,
        },
      },
    ]);
    mockFrom.mockImplementation(() => contactChain);

    const request = createDupRequest({
      name: "Test",
      contacts: [{ value: "0999888777" }],
    });
    const response = await POST(request, { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toEqual([]);
  });

  it("filters out deleted customers from contact matches", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const contactChain = mockContactQuery([
      {
        customer_id: "deleted-cust",
        value: "0111222333",
        customers: {
          id: "deleted-cust",
          full_name: "Deleted Guy",
          account_id: TEST_ACCOUNT_ID,
          deleted_at: "2024-01-01T00:00:00Z", // soft deleted
        },
      },
    ]);
    mockFrom.mockImplementation(() => contactChain);

    const request = createDupRequest({
      name: "Test",
      contacts: [{ value: "0111222333" }],
    });
    const response = await POST(request, { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toEqual([]);
  });

  it("falls back to base contact/customer lookups when the relation cache is stale", async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: "dup5", full_name: "Relation Cache User", similarity: 0.8 }],
      error: null,
    });

    const contactChain = createSequentialContactBuilder([
      {
        data: null,
        error: { code: "PGRST200", message: "contact relation cache miss" },
      },
      {
        data: [
          {
            customer_id: "dup5",
            value: "0977000000",
          },
        ],
        error: null,
      },
    ]);

    const customerLookup = createLookupBuilder([
      {
        id: "dup5",
        full_name: "Relation Cache User",
        account_id: TEST_ACCOUNT_ID,
        deleted_at: null,
      },
    ]);

    mockFrom.mockImplementation((table: string) => {
      if (table === "customer_contacts") return contactChain;
      if (table === "customers") return customerLookup;
      return mockContactQuery([]);
    });

    const request = createDupRequest({
      name: "Relation Cache User",
      contacts: [{ value: "0977000000" }],
    });
    const response = await POST(request, { params: {} } as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].matchType).toBe("both");
    expect(json.data[0].matchValue).toBe("0977000000");
  });
});
