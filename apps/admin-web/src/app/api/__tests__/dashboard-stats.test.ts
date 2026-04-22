import { describe, it, expect, vi } from "vitest";
import { mockWithAccount, mockWithErrorHandler, createTestRequest } from "./helpers/setup";
// import { NextResponse } from "next/server";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/supabase/repositories/products.repo", () => ({
  listProducts: vi.fn().mockResolvedValue([{ id: "p1", name: "Netflix" }]),
}));
vi.mock("@/lib/supabase/repositories/source-accounts.repo", () => ({
  listSourceAccounts: vi.fn().mockResolvedValue([
    { id: "sa1", max_slots: 10, used_slots: 7, product_ids: ["p1"], expires_at: null },
  ]),
}));
vi.mock("@/lib/cache/db-cache", () => ({
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  TTL: { AGGREGATE: 300 },
}));

import { supabaseAdmin } from "@/lib/supabase/admin";

describe("GET /api/dashboard/stats", () => {
  function setupSupabaseMock() {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: "o1", customer_id: "c1", product_id: "p1",
            total_amount_vnd: 100000, total_cost_vnd: 50000,
            status: "completed", created_at: new Date().toISOString(),
            customer: { full_name: "Alice" },
          },
        ],
      }),
    };
    // Make limit() return { data: [...] } for plain await
    // But also handle the initial Promise.all case where each query needs .data
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as any);
  }

  it("returns dashboard stats structure", async () => {
    setupSupabaseMock();
    const { GET } = await import("@/app/api/dashboard/stats/route");
    const res = await GET(createTestRequest("http://localhost/api/dashboard/stats?days=30"), { params: {} } as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty("totalRevenue");
    expect(body.data).toHaveProperty("totalProfit");
    expect(body.data).toHaveProperty("chartData");
    expect(body.data).toHaveProperty("calculatedAt");
  });

  it("accepts custom days parameter", async () => {
    setupSupabaseMock();
    const { GET } = await import("@/app/api/dashboard/stats/route");
    const res = await GET(createTestRequest("http://localhost/api/dashboard/stats?days=7"), { params: {} } as any);

    expect(res.status).toBe(200);
  });
});
