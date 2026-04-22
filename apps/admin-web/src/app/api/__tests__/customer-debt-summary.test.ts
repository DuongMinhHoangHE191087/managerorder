import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  createTestRequest,
} from "./helpers/setup";

// Mock middleware
vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());

// Mock supabaseAdmin
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { GET } from "@/app/api/customers/debt-summary/route";

// ── Helpers ──────────────────────────────────────────────────

function createDebtRequest() {
  return createTestRequest("http://localhost:3000/api/customers/debt-summary");
}

function mockQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockResolvedValue({ data, error }),
  };
}

const sampleCustomers = [
  {
    id: "c1",
    full_name: "Khách A",
    debt_amount_vnd: 1000000,
    debt_overdue_days: 0,
    reliability_score: 90,
    segment: "vip",
    type: "wholesale",
  },
  {
    id: "c2",
    full_name: "Khách B",
    debt_amount_vnd: 500000,
    debt_overdue_days: 15,
    reliability_score: 75,
    segment: "regular",
    type: "retail",
  },
  {
    id: "c3",
    full_name: "Khách C",
    debt_amount_vnd: 200000,
    debt_overdue_days: 45,
    reliability_score: 60,
    segment: "at_risk",
    type: "retail",
  },
  {
    id: "c4",
    full_name: "Khách D",
    debt_amount_vnd: 800000,
    debt_overdue_days: 95,
    reliability_score: 40,
    segment: "churned",
    type: "wholesale",
  },
  {
    id: "c5",
    full_name: "Khách E",
    debt_amount_vnd: 0,
    debt_overdue_days: 0,
    reliability_score: 100,
    segment: "loyal",
    type: "retail",
  },
];

beforeEach(() => vi.clearAllMocks());

// ── Tests ────────────────────────────────────────────────────

describe("GET /api/customers/debt-summary", () => {
  it("returns correct aggregated debt summary", async () => {
    mockFrom.mockReturnValue(mockQuery(sampleCustomers));

    const response = await GET(createDebtRequest(), { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();

    // Totals
    expect(json.totalDebtVnd).toBe(2500000);
    expect(json.totalCustomers).toBe(5);
    expect(json.customersWithDebt).toBe(4); // c5 has 0 debt
    expect(json.overdueCustomers).toBe(3); // c2, c3, c4

    // Average reliability = (90+75+60+40+100)/5 = 73
    expect(json.avgReliabilityScore).toBe(73);
  });

  it("returns correct aging buckets", async () => {
    mockFrom.mockReturnValue(mockQuery(sampleCustomers));

    const response = await GET(createDebtRequest(), { params: {} } as any);
    const json = await response.json();

    // c1: debt=1M, overdue=0 → current
    // c2: debt=500K, overdue=15 → days_1_30
    // c3: debt=200K, overdue=45 → days_31_60
    // c4: debt=800K, overdue=95 → days_90_plus
    expect(json.aging.current).toBe(1000000);
    expect(json.aging.days_1_30).toBe(500000);
    expect(json.aging.days_31_60).toBe(200000);
    expect(json.aging.days_61_90).toBe(0);
    expect(json.aging.days_90_plus).toBe(800000);
  });

  it("returns top debtors sorted by debt amount desc", async () => {
    mockFrom.mockReturnValue(mockQuery(sampleCustomers));

    const response = await GET(createDebtRequest(), { params: {} } as any);
    const json = await response.json();

    expect(json.topDebtors).toHaveLength(4); // 4 customers with debt
    expect(json.topDebtors[0].id).toBe("c1"); // highest debt
    expect(json.topDebtors[0].debtAmountVnd).toBe(1000000);
    expect(json.topDebtors[1].id).toBe("c4"); // 2nd highest
    expect(json.topDebtors[1].debtAmountVnd).toBe(800000);
  });

  it("returns segment breakdown", async () => {
    mockFrom.mockReturnValue(mockQuery(sampleCustomers));

    const response = await GET(createDebtRequest(), { params: {} } as any);
    const json = await response.json();

    expect(json.segmentBreakdown.vip).toEqual({ count: 1, totalDebt: 1000000 });
    expect(json.segmentBreakdown.regular).toEqual({ count: 1, totalDebt: 500000 });
    expect(json.segmentBreakdown.at_risk).toEqual({ count: 1, totalDebt: 200000 });
    expect(json.segmentBreakdown.churned).toEqual({ count: 1, totalDebt: 800000 });
    expect(json.segmentBreakdown.loyal).toEqual({ count: 1, totalDebt: 0 });
  });

  it("returns zeros when no customers exist", async () => {
    mockFrom.mockReturnValue(mockQuery([]));

    const response = await GET(createDebtRequest(), { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.totalDebtVnd).toBe(0);
    expect(json.totalCustomers).toBe(0);
    expect(json.customersWithDebt).toBe(0);
    expect(json.overdueCustomers).toBe(0);
    expect(json.avgReliabilityScore).toBe(100); // default
    expect(json.topDebtors).toEqual([]);
    expect(json.aging.current).toBe(0);
  });

  it("returns 500 when supabase query fails", async () => {
    mockFrom.mockReturnValue(
      mockQuery(null, { message: "Connection timeout" })
    );

    const response = await GET(createDebtRequest(), { params: {} } as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("Failed to fetch customers");
  });

  it("handles null values in customer fields", async () => {
    const customersWithNulls = [
      {
        id: "c1",
        full_name: "Test",
        debt_amount_vnd: null,
        debt_overdue_days: null,
        reliability_score: null,
        segment: null,
        type: "retail",
      },
    ];
    mockFrom.mockReturnValue(mockQuery(customersWithNulls));

    const response = await GET(createDebtRequest(), { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.totalDebtVnd).toBe(0);
    expect(json.avgReliabilityScore).toBe(100); // null → default 100
    expect(json.segmentBreakdown.regular).toBeDefined(); // null segment → "regular"
  });
});
