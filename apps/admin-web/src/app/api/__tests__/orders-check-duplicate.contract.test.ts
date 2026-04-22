import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TEST_ACCOUNT_ID,
  createTestRequest,
  mockWithAccount,
  mockWithErrorHandler,
} from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());

const mockFrom = vi.fn();
const emptyContext = { params: Promise.resolve({}) } as { params: Promise<Record<string, never>> };

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { POST } from "@/app/api/orders/check-duplicate/route";

function createOrdersQuery(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    not: vi.fn().mockResolvedValue(result),
  };
}

function createOrderItemsQuery(result: { data: unknown; error?: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue(result),
  };
}

describe("POST /api/orders/check-duplicate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty duplicate contract when required inputs are missing", async () => {
    const response = await POST(
      createTestRequest("http://localhost/api/orders/check-duplicate", {
        method: "POST",
        body: {
          customer_id: "",
          product_ids: [],
        },
      }),
      emptyContext,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        isDuplicate: false,
        existingOrders: [],
        message: expect.stringContaining("customer_id"),
      }),
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns matching same-day orders that overlap on at least one product", async () => {
    const ordersQuery = createOrdersQuery({
      data: [
        {
          id: "order-1",
          order_code: "ORD-001",
          status: "pending_payment",
          product_name_snapshot: "Netflix Premium",
          quantity: 1,
          total_amount_vnd: 120000,
          created_at: "2026-04-22T09:30:00.000Z",
        },
      ],
      error: null,
    });
    const orderItemsQuery = createOrderItemsQuery({
      data: [
        {
          order_id: "order-1",
          product_id: "product-netflix",
        },
      ],
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return ordersQuery;
      }
      if (table === "order_items") {
        return orderItemsQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(
      createTestRequest("http://localhost/api/orders/check-duplicate", {
        method: "POST",
        body: {
          customer_id: "customer-1",
          product_ids: ["product-netflix", "product-youtube"],
          date: "2026-04-22T10:00:00.000Z",
        },
      }),
      emptyContext,
    );

    expect(response.status).toBe(200);
    expect(ordersQuery.eq).toHaveBeenNthCalledWith(1, "customer_id", "customer-1");
    expect(ordersQuery.eq).toHaveBeenNthCalledWith(2, "account_id", TEST_ACCOUNT_ID);
    expect(orderItemsQuery.in).toHaveBeenCalledWith("order_id", ["order-1"]);

    expect(await response.json()).toEqual(
      expect.objectContaining({
        isDuplicate: true,
        existingOrders: [
          expect.objectContaining({
            id: "order-1",
            order_code: "ORD-001",
            product_name: "Netflix Premium",
            total_amount: 120000,
          }),
        ],
        message: expect.stringContaining("1"),
      }),
    );
  });

  it("fails closed and returns no duplicates when the order lookup errors", async () => {
    const ordersQuery = createOrdersQuery({
      data: null,
      error: { message: "db unavailable" },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return ordersQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(
      createTestRequest("http://localhost/api/orders/check-duplicate", {
        method: "POST",
        body: {
          customer_id: "customer-1",
          product_ids: ["product-netflix"],
        },
      }),
      emptyContext,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      isDuplicate: false,
      existingOrders: [],
    });
  });
});
