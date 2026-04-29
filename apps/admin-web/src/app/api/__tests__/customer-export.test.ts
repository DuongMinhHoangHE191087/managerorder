import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  createTestRequest,
} from "./helpers/setup";

// Mock middleware
vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/cache/db-cache", () => ({
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(),
  invalidatePrefix: vi.fn(),
  TTL: { LIST: 1, ITEM: 1, AGGREGATE: 1 },
}));

// Mock supabaseAdmin
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock mapToCustomer
vi.mock("@/lib/supabase/mappers/customer-mapper", () => ({
  mapToCustomer: (row: Record<string, unknown>) => ({
    id: row.id,
    name: row.full_name ?? "",
    contacts: [],
    tier: "regular",
    customerType: row.type ?? "retail",
    debtAmountVnd: row.debt_amount_vnd ?? 0,
    debtOverdueDays: row.debt_overdue_days ?? 0,
    reliabilityScore: row.reliability_score ?? 100,
    createdAt: row.created_at ?? "",
    tags: [],
  }),
}));

// Mock excel service
const mockGenerateCustomerXlsx = vi.fn();
vi.mock("@/lib/services/excel-service", () => ({
  generateCustomerXlsx: (...args: unknown[]) =>
    mockGenerateCustomerXlsx(...args),
}));

import { GET } from "@/app/api/customers/export/route";

// ── Helpers ──────────────────────────────────────────────────

function createExportRequest() {
  return createTestRequest("http://localhost:3000/api/customers/export");
}

function mockQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  };
}

function createTerminalBuilder(
  result: { data: unknown; error: unknown },
  terminal: "order" | "in" = "order",
) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn(() =>
      terminal === "order" ? Promise.resolve(result) : chain,
    ),
  };

  if (terminal === "in") {
    chain.in = vi.fn().mockResolvedValue(result);
  }

  return chain;
}

function createSequentialCustomerBuilder(
  results: Array<{ data: unknown; error: unknown }>,
) {
  let selectCount = 0;
  return {
    select: vi.fn(() => {
      const result = results[Math.min(selectCount, results.length - 1)];
      selectCount += 1;
      return createTerminalBuilder(result, "order");
    }),
  };
}

const sampleCustomers = [
  {
    id: "c1",
    full_name: "Khách A",
    type: "wholesale",
    debt_amount_vnd: 100000,
    debt_overdue_days: 0,
    reliability_score: 90,
    created_at: "2024-01-01",
  },
  {
    id: "c2",
    full_name: "Khách B",
    type: "retail",
    debt_amount_vnd: 0,
    debt_overdue_days: 0,
    reliability_score: 100,
    created_at: "2024-02-01",
  },
];

beforeEach(() => vi.clearAllMocks());

// ── Tests ────────────────────────────────────────────────────

describe("GET /api/customers/export", () => {
  it("exports customers as XLSX successfully", async () => {
    mockFrom.mockReturnValue(mockQuery(sampleCustomers));
    const fakeBuffer = Buffer.from("fake-xlsx-content");
    mockGenerateCustomerXlsx.mockReturnValue(fakeBuffer);

    const response = await GET(createExportRequest(), { params: {} } as any);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("content-disposition")).toContain(
      "attachment"
    );

    // Verify excel service was called with mapped customers
    expect(mockGenerateCustomerXlsx).toHaveBeenCalledTimes(1);
    const calledWith = mockGenerateCustomerXlsx.mock.calls[0][0];
    expect(calledWith).toHaveLength(2);
    expect(calledWith[0].name).toBe("Khách A");
  });

  it("exports empty file when no customers exist", async () => {
    mockFrom.mockReturnValue(mockQuery([]));
    const fakeBuffer = Buffer.from("empty-xlsx");
    mockGenerateCustomerXlsx.mockReturnValue(fakeBuffer);

    const response = await GET(createExportRequest(), { params: {} } as any);

    expect(response.status).toBe(200);
    expect(mockGenerateCustomerXlsx).toHaveBeenCalledWith([]);
  });

  it("returns 500 when database query fails", async () => {
    mockFrom.mockReturnValue(
      mockQuery(null, { message: "Connection error" })
    );

    const response = await GET(createExportRequest(), { params: {} } as any);

    expect(response.status).toBe(500);
  });

  it("returns 500 when excel generation throws", async () => {
    mockFrom.mockReturnValue(mockQuery(sampleCustomers));
    mockGenerateCustomerXlsx.mockImplementation(() => {
      throw new Error("Excel generation failed");
    });

    const response = await GET(createExportRequest(), { params: {} } as any);

    expect(response.status).toBe(500);
  });

  it("falls back to hydrated rows when the customer relation cache is stale", async () => {
    const customersBuilder = createSequentialCustomerBuilder([
      {
        data: null,
        error: { code: "PGRST200", message: "customer relation cache miss" },
      },
      {
        data: sampleCustomers,
        error: null,
      },
    ]);

    const contactsBuilder = createTerminalBuilder(
      {
        data: [
          {
            id: "00000000-0000-4000-8000-0000000003e8",
            customer_id: "c1",
            channel: "email",
            value: "khach-a@example.com",
            is_verified: true,
            created_at: "2024-01-02T00:00:00Z",
          },
        ],
        error: null,
      },
      "order",
    );
    const assignmentsBuilder = createTerminalBuilder(
      {
        data: [
          { customer_id: "c1", tag_id: "00000000-0000-4000-8000-000000000030" },
        ],
        error: null,
      },
      "order",
    );
    const ordersBuilder = createTerminalBuilder(
      {
        data: [
          { customer_id: "c1", total_amount_vnd: 250000 },
        ],
        error: null,
      },
      "order",
    );
    const tagsBuilder = createTerminalBuilder(
      {
        data: [
          { id: "00000000-0000-4000-8000-000000000030", name: "VIP", color: "#ef4444" },
        ],
        error: null,
      },
      "in",
    );

    mockFrom.mockImplementation((table: string) => {
      if (table === "customers") return customersBuilder;
      if (table === "customer_contacts") return contactsBuilder;
      if (table === "customer_tag_assignments") return assignmentsBuilder;
      if (table === "orders") return ordersBuilder;
      if (table === "customer_tags") return tagsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockGenerateCustomerXlsx.mockReturnValue(Buffer.from("fallback-xlsx"));

    const response = await GET(createExportRequest(), { params: {} } as any);

    expect(response.status).toBe(200);
    expect(mockGenerateCustomerXlsx).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("customer_contacts");
    expect(mockFrom).toHaveBeenCalledWith("customer_tag_assignments");
    expect(mockFrom).toHaveBeenCalledWith("orders");
    expect(mockFrom).toHaveBeenCalledWith("customer_tags");
  });
});
