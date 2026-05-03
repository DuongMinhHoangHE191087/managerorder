/**
 * Customers API Route — Comprehensive Integration Tests
 * Covers: GET /api/customers, POST /api/customers,
 *         GET/PUT/DELETE /api/customers/[id]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  createTestRequest,
  TEST_ACCOUNT_ID,
} from "./helpers/setup";

// --- Mocks ---
vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());

const mockListCustomers = vi.fn();
const mockCreateCustomer = vi.fn();
const mockGetCustomerById = vi.fn();
const mockUpdateCustomer = vi.fn();
const mockDeleteCustomer = vi.fn();
const mockCreateActivityLog = vi.fn().mockResolvedValue(null);
const mockAssignTagsToCustomer = vi.fn().mockResolvedValue(undefined);
const mockReplaceCustomerTags = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/supabase/repositories/customers.repo", () => ({
  listCustomers: (...a: unknown[]) => mockListCustomers(...a),
  createCustomer: (...a: unknown[]) => mockCreateCustomer(...a),
  getCustomerById: (...a: unknown[]) => mockGetCustomerById(...a),
  updateCustomer: (...a: unknown[]) => mockUpdateCustomer(...a),
  deleteCustomer: (...a: unknown[]) => mockDeleteCustomer(...a),
}));

vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: (...a: unknown[]) => mockCreateActivityLog(...a),
}));

vi.mock("@/lib/supabase/repositories/customer-tags.repo", () => ({
  assignTagsToCustomer: (...a: unknown[]) => mockAssignTagsToCustomer(...a),
  replaceCustomerTags: (...a: unknown[]) => mockReplaceCustomerTags(...a),
}));

vi.mock("@/lib/supabase/mappers/customer-mapper", () => ({
  mapToCustomer: (row: Record<string, unknown>) => ({
    id: String(row.id ?? ""),
    name: String(row.full_name ?? row.name ?? ""),
    contacts: Array.isArray(row.contacts)
      ? (row.contacts as Record<string, unknown>[]).map((c, i) => ({
          id: String(c.id ?? `cc_${i}`),
          type: String(c.channel ?? c.type ?? "other"),
          value: String(c.value ?? ""),
          isPrimary: Boolean(c.is_primary ?? i === 0),
        }))
      : [],
    tags: [],
    tier: row.type === "wholesale" || row.type === "agency" ? "vip" : "regular",
    customerType: row.type ?? "retail",
    debtAmountVnd: 0,
    debtOverdueDays: 0,
    reliabilityScore: 100,
    segment: "regular",
    rfmScore: 0,
    rfmRecency: 0,
    rfmFrequency: 0,
    rfmMonetary: 0,
    nicksRegistry: [],
    createdAt: String(row.created_at ?? ""),
  }),
  mapTierToDbType: (tier: string) =>
    tier === "vip" ? "wholesale" : tier === "agency" ? "agency" : "retail",
}));

// Dynamic imports
const { GET: listGET, POST } = await import("@/app/api/customers/route");
const {
  GET: detailGET,
  PUT,
  DELETE: DEL,
} = await import("@/app/api/customers/[id]/route");

beforeEach(() => {
  vi.clearAllMocks();
});

/* ============================================================
   GET /api/customers (list)
   ============================================================ */
describe("GET /api/customers", () => {
  it("should return empty list", async () => {
    mockListCustomers.mockResolvedValue([]);
    const req = createTestRequest("http://localhost:3000/api/customers");
    const res = await listGET(req, { params: {} } as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
    expect(mockListCustomers).toHaveBeenCalledWith(TEST_ACCOUNT_ID, { search: undefined });
  });

  it("should return mapped customers", async () => {
    mockListCustomers.mockResolvedValue([
      {
        id: "c-1",
        full_name: "Anh Long",
        type: "retail",
        contacts: [],
        created_at: "2025-01-01",
      },
    ]);
    const req = createTestRequest("http://localhost:3000/api/customers");
    const res = await listGET(req, { params: {} } as any);
    const json = await res.json();

    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe("Anh Long");
  });

  it("should pass accent-insensitive search query to repository layer", async () => {
    mockListCustomers.mockResolvedValue([]);
    const req = createTestRequest("http://localhost:3000/api/customers?search=gia%20dinh");
    await listGET(req, { params: {} } as any);

    expect(mockListCustomers).toHaveBeenCalledWith(TEST_ACCOUNT_ID, { search: "gia dinh" });
  });

  it("should propagate errors", async () => {
    mockListCustomers.mockRejectedValue(new Error("DB error"));
    const req = createTestRequest("http://localhost:3000/api/customers");
    const res = await listGET(req, { params: {} } as any);
    expect(res.status).toBe(500);
  });
});

/* ============================================================
   POST /api/customers
   ============================================================ */
describe("POST /api/customers", () => {
  const validBody = {
    name: "Nguyễn Văn A",
    contacts: [{ type: "phone", value: "0901234567" }],
    tier: "regular",
  };

  it("should create customer and return 201", async () => {
    mockCreateCustomer.mockResolvedValue({
      id: "c-new",
      full_name: "Nguyễn Văn A",
      type: "retail",
      contacts: [
        { id: "00000000-0000-4000-8000-0000000003e8", channel: "phone", value: "0901234567", is_primary: false },
      ],
    });
    const req = createTestRequest("http://localhost:3000/api/customers", {
      method: "POST",
      body: validBody,
    });
    const res = await POST(req, { params: {} } as any);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.name).toBe("Nguyễn Văn A");
    expect(mockCreateCustomer).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({
        full_name: "Nguyễn Văn A",
        type: "retail",
      })
    );
  });

  it("should assign tags when tagIds provided", async () => {
    const tagId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    mockCreateCustomer.mockResolvedValue({
      id: "c-new",
      full_name: "Test",
      type: "retail",
      contacts: [],
    });
    mockGetCustomerById.mockResolvedValue({
      id: "c-new",
      full_name: "Test",
      type: "retail",
      contacts: [],
      customer_tags: [{ id: tagId, name: "VIP", color: "#f00" }],
    });

    const req = createTestRequest("http://localhost:3000/api/customers", {
      method: "POST",
      body: { ...validBody, tagIds: [tagId] },
    });
    const res = await POST(req, { params: {} } as any);

    expect(res.status).toBe(201);
    expect(mockAssignTagsToCustomer).toHaveBeenCalledWith("c-new", [tagId]);
  });

  it("should pass customerType and notes through the create contract", async () => {
    mockCreateCustomer.mockResolvedValue({
      id: "c-agency",
      full_name: "Agency User",
      type: "agency",
      notes: "Ưu tiên xử lý gấp",
      contacts: [],
    });

    const req = createTestRequest("http://localhost:3000/api/customers", {
      method: "POST",
      body: {
        ...validBody,
        tier: "agency",
        customerType: "agency",
        notes: "Ưu tiên xử lý gấp",
      },
    });
    const res = await POST(req, { params: {} } as any);

    expect(res.status).toBe(201);
    expect(mockCreateCustomer).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({
        type: "agency",
        notes: "Ưu tiên xử lý gấp",
      }),
    );
  });

  it("should create VIP customer → maps to wholesale", async () => {
    mockCreateCustomer.mockResolvedValue({
      id: "c-vip",
      full_name: "VIP User",
      type: "wholesale",
      contacts: [],
    });
    const req = createTestRequest("http://localhost:3000/api/customers", {
      method: "POST",
      body: { ...validBody, tier: "vip" },
    });
    const res = await POST(req, { params: {} } as any);

    expect(res.status).toBe(201);
    expect(mockCreateCustomer).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({ type: "wholesale" })
    );
  });

  it("should log activity on creation", async () => {
    mockCreateCustomer.mockResolvedValue({
      id: "c-new",
      full_name: "Test",
      type: "retail",
      contacts: [{ id: "c1", channel: "phone", value: "090" }],
    });
    const req = createTestRequest("http://localhost:3000/api/customers", {
      method: "POST",
      body: validBody,
    });
    await POST(req, { params: {} } as any);

    await new Promise((r) => setTimeout(r, 10));
    expect(mockCreateActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: TEST_ACCOUNT_ID,
        action_type: "CUSTOMER_CREATED",
      })
    );
  });

  it("should reject empty name", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers", {
      method: "POST",
      body: { ...validBody, name: "" },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("should reject empty contacts", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers", {
      method: "POST",
      body: { ...validBody, contacts: [] },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("should reject invalid tier", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers", {
      method: "POST",
      body: { ...validBody, tier: "gold" },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("should reject notes longer than 1000 characters on create", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers", {
      method: "POST",
      body: {
        ...validBody,
        notes: "A".repeat(1001),
      },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });
});

/* ============================================================
   GET /api/customers/[id]
   ============================================================ */
describe("GET /api/customers/[id]", () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it("should return customer by id", async () => {
    mockGetCustomerById.mockResolvedValue({
      id: "c-1",
      full_name: "Test",
      type: "retail",
      contacts: [],
    });
    const req = createTestRequest("http://localhost:3000/api/customers/c-1");
    const res = await detailGET(req, makeParams("c-1") as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBe("c-1");
  });

  it("should return 404 when customer not found", async () => {
    mockGetCustomerById.mockResolvedValue(null);
    const req = createTestRequest("http://localhost:3000/api/customers/bad-id");
    const res = await detailGET(req, makeParams("bad-id") as any);

    expect(res.status).toBe(404);
  });
});

/* ============================================================
   PUT /api/customers/[id]
   ============================================================ */
describe("PUT /api/customers/[id]", () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it("should update customer name", async () => {
    mockUpdateCustomer.mockResolvedValue({
      id: "c-1",
      full_name: "Updated",
      type: "retail",
      contacts: [],
    });
    const req = createTestRequest("http://localhost:3000/api/customers/c-1", {
      method: "PUT",
      body: { name: "Updated" },
    });
    const res = await PUT(req, makeParams("c-1") as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.name).toBe("Updated");
  });

  it("should update contacts", async () => {
    mockUpdateCustomer.mockResolvedValue({
      id: "c-1",
      full_name: "Test",
      type: "retail",
      contacts: [{ id: "c1", channel: "email", value: "new@test.com", is_primary: true }],
    });
    const req = createTestRequest("http://localhost:3000/api/customers/c-1", {
      method: "PUT",
      body: { contacts: [{ type: "email", value: "new@test.com", isPrimary: true }] },
    });
    const res = await PUT(req, makeParams("c-1") as any);
    expect(res.status).toBe(200);
  });

  it("should update tier via customerType", async () => {
    mockUpdateCustomer.mockResolvedValue({
      id: "c-1",
      full_name: "Test",
      type: "agency",
      contacts: [],
    });
    const req = createTestRequest("http://localhost:3000/api/customers/c-1", {
      method: "PUT",
      body: { customerType: "agency" },
    });
    const res = await PUT(req, makeParams("c-1") as any);
    expect(res.status).toBe(200);
  });

  it("should replace tags when tagIds provided", async () => {
    const tagId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    mockUpdateCustomer.mockResolvedValue({
      id: "c-1",
      full_name: "Test",
      type: "retail",
      contacts: [],
    });
    mockGetCustomerById.mockResolvedValue({
      id: "c-1",
      full_name: "Test",
      type: "retail",
      contacts: [],
      customer_tags: [],
    });
    const req = createTestRequest("http://localhost:3000/api/customers/c-1", {
      method: "PUT",
      body: { tagIds: [tagId] },
    });
    const res = await PUT(req, makeParams("c-1") as any);

    expect(res.status).toBe(200);
    expect(mockReplaceCustomerTags).toHaveBeenCalledWith("c-1", [tagId]);
  });

  it("should update reliabilityScore", async () => {
    mockUpdateCustomer.mockResolvedValue({
      id: "c-1",
      full_name: "Test",
      type: "retail",
      contacts: [],
    });
    const req = createTestRequest("http://localhost:3000/api/customers/c-1", {
      method: "PUT",
      body: { reliabilityScore: 75 },
    });
    const res = await PUT(req, makeParams("c-1") as any);
    expect(res.status).toBe(200);
    expect(mockUpdateCustomer).toHaveBeenCalledWith(
      "c-1",
      TEST_ACCOUNT_ID,
      expect.objectContaining({ reliability_score: 75 })
    );
  });

  it("should update notes", async () => {
    mockUpdateCustomer.mockResolvedValue({
      id: "c-1",
      full_name: "Test",
      type: "retail",
      contacts: [],
    });
    const req = createTestRequest("http://localhost:3000/api/customers/c-1", {
      method: "PUT",
      body: { notes: "Ghi chú mới" },
    });
    const res = await PUT(req, makeParams("c-1") as any);
    expect(res.status).toBe(200);
    expect(mockUpdateCustomer).toHaveBeenCalledWith(
      "c-1",
      TEST_ACCOUNT_ID,
      expect.objectContaining({ notes: "Ghi chú mới" })
    );
  });

  it("should reject notes > 1000 chars", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers/c-1", {
      method: "PUT",
      body: { notes: "A".repeat(1001) },
    });
    const res = await PUT(req, makeParams("c-1") as any);
    expect(res.status).toBe(400);
  });

  it("should reject reliabilityScore > 100", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers/c-1", {
      method: "PUT",
      body: { reliabilityScore: 101 },
    });
    const res = await PUT(req, makeParams("c-1") as any);
    expect(res.status).toBe(400);
  });
});

/* ============================================================
   DELETE /api/customers/[id]
   ============================================================ */
describe("DELETE /api/customers/[id]", () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it("should soft-delete customer", async () => {
    mockDeleteCustomer.mockResolvedValue(undefined);
    const req = createTestRequest("http://localhost:3000/api/customers/c-1", {
      method: "DELETE",
    });
    const res = await DEL(req, makeParams("c-1") as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockDeleteCustomer).toHaveBeenCalledWith("c-1", TEST_ACCOUNT_ID);
  });

  it("should propagate delete errors", async () => {
    mockDeleteCustomer.mockRejectedValue(new Error("not found"));
    const req = createTestRequest("http://localhost:3000/api/customers/bad", {
      method: "DELETE",
    });
    const res = await DEL(req, makeParams("bad") as any);
    expect(res.status).toBe(500);
  });
});

/* ============================================================
   EDGE CASES & NEGATIVE SCENARIOS
   ============================================================ */

describe("POST /api/customers — edge cases", () => {
  it("should reject request with missing body", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers", {
      method: "POST",
      body: {},
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("should reject contact without type", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers", {
      method: "POST",
      body: {
        name: "Test",
        contacts: [{ value: "0901234567" }], // missing type
      },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("should return 500 when createCustomer repo throws", async () => {
    mockCreateCustomer.mockRejectedValue(new Error("Insert failed"));
    const req = createTestRequest("http://localhost:3000/api/customers", {
      method: "POST",
      body: {
        name: "Test",
        contacts: [{ type: "phone", value: "0901234567" }],
        tier: "regular",
      },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(500);
  });

  it("should handle tagIds with non-UUID values → 400", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers", {
      method: "POST",
      body: {
        name: "Test",
        contacts: [{ type: "phone", value: "123" }],
        tagIds: ["not-a-uuid"],
      },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/customers/[id] — edge cases", () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it("should reject reliabilityScore < 0", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers/c-1", {
      method: "PUT",
      body: { reliabilityScore: -1 },
    });
    const res = await PUT(req, makeParams("c-1") as any);
    expect(res.status).toBe(400);
  });

  it("should accept empty body (no fields to update)", async () => {
    mockUpdateCustomer.mockResolvedValue({
      id: "c-1",
      full_name: "Test",
      type: "retail",
      contacts: [],
    });
    const req = createTestRequest("http://localhost:3000/api/customers/c-1", {
      method: "PUT",
      body: {},
    });
    const res = await PUT(req, makeParams("c-1") as any);
    expect(res.status).toBe(200);
  });

  it("should reject invalid customerType", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers/c-1", {
      method: "PUT",
      body: { customerType: "gold_tier" },
    });
    const res = await PUT(req, makeParams("c-1") as any);
    expect(res.status).toBe(400);
  });

  it("should return 500 when updateCustomer repo throws", async () => {
    mockUpdateCustomer.mockRejectedValue(new Error("Update failed"));
    const req = createTestRequest("http://localhost:3000/api/customers/c-1", {
      method: "PUT",
      body: { name: "New Name" },
    });
    const res = await PUT(req, makeParams("c-1") as any);
    expect(res.status).toBe(500);
  });
});

describe("GET /api/customers/[id] — edge cases", () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it("should return customer with multiple contacts mapped correctly", async () => {
    mockGetCustomerById.mockResolvedValue({
      id: "c-multi",
      full_name: "Multi Contact",
      type: "wholesale",
      contacts: [
        { id: "c1", channel: "phone", value: "090", is_primary: true },
        { id: "c2", channel: "zalo", value: "zalo123" },
        { id: "c3", channel: "facebook", value: "fb_user" },
      ],
    });
    const req = createTestRequest("http://localhost:3000/api/customers/c-multi");
    const res = await detailGET(req, makeParams("c-multi") as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.contacts).toHaveLength(3);
    expect(json.data.tier).toBe("vip"); // wholesale → vip
  });

  it("should return 500 when repo throws", async () => {
    mockGetCustomerById.mockRejectedValue(new Error("DB down"));
    const req = createTestRequest("http://localhost:3000/api/customers/c-1");
    const res = await detailGET(req, makeParams("c-1") as any);
    expect(res.status).toBe(500);
  });
});
