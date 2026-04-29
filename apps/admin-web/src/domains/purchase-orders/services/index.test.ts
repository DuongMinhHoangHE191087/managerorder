import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/repositories/purchase-orders.repo", () => ({
  listPurchaseOrders: vi.fn(),
  getPurchaseOrderById: vi.fn(),
  createPurchaseOrder: vi.fn(),
  updatePurchaseOrder: vi.fn(),
  deletePurchaseOrder: vi.fn(),
}));

vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: vi.fn(),
}));

import {
  createPurchaseOrder as createPurchaseOrderRepo,
  deletePurchaseOrder as deletePurchaseOrderRepo,
  getPurchaseOrderById as getPurchaseOrderByIdRepo,
  listPurchaseOrders as listPurchaseOrdersRepo,
  updatePurchaseOrder as updatePurchaseOrderRepo,
} from "@/lib/supabase/repositories/purchase-orders.repo";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import {
  createPurchaseOrderForAccount,
  deletePurchaseOrderForAccount,
  getPurchaseOrderForAccount,
  listPurchaseOrdersForAccount,
  updatePurchaseOrderForAccount,
} from "./index";

describe("purchase-orders service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists and maps purchase orders", async () => {
    vi.mocked(listPurchaseOrdersRepo).mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000094",
        provider_id: "00000000-0000-4000-8000-000000000095",
        items: [],
        status: "pending",
        total_amount_vnd: 1000,
        total_paid_vnd: 0,
        created_at: "2026-04-19T00:00:00.000Z",
        updated_at: "2026-04-19T00:00:00.000Z",
      } as any,
    ]);

    const result = await listPurchaseOrdersForAccount("00000000-0000-4000-8000-0000000000bc");

    expect(result).toHaveLength(1);
    expect(result[0].providerId).toBe("00000000-0000-4000-8000-000000000095");
    expect(listPurchaseOrdersRepo).toHaveBeenCalledWith("00000000-0000-4000-8000-0000000000bc", undefined);
  });

  it("creates a purchase order and logs activity", async () => {
    vi.mocked(createPurchaseOrderRepo).mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000096",
      provider_id: "00000000-0000-4000-8000-000000000097",
      items: [{ product_id: "00000000-0000-4000-8000-000000000039" }],
      status: "partial",
      total_amount_vnd: 1200,
      total_paid_vnd: 200,
      created_at: "2026-04-19T00:00:00.000Z",
      updated_at: "2026-04-19T00:00:00.000Z",
    } as any);

    const result = await createPurchaseOrderForAccount(
      "00000000-0000-4000-8000-0000000000bc",
      {
        provider_id: "00000000-0000-4000-8000-000000000097",
        items: [{ product_id: "00000000-0000-4000-8000-000000000039" }],
        total_amount_vnd: 1200,
        total_paid_vnd: 200,
      },
      "owner@example.com",
    );

    expect(result.id).toBe("00000000-0000-4000-8000-000000000096");
    expect(createPurchaseOrderRepo).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-0000000000bc",
      expect.objectContaining({ provider_id: "00000000-0000-4000-8000-000000000097" }),
    );
    expect(createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: "00000000-0000-4000-8000-0000000000bc",
        action_type: "PROCUREMENT_UPDATED",
        created_by: "owner@example.com",
      }),
    );
  });

  it("updates a purchase order and logs activity", async () => {
    vi.mocked(updatePurchaseOrderRepo).mockResolvedValue({
      id: "00000000-0000-4000-8000-0000000000bd",
      provider_id: "00000000-0000-4000-8000-0000000000be",
      items: [],
      status: "received",
      total_amount_vnd: 1200,
      total_paid_vnd: 1200,
      created_at: "2026-04-19T00:00:00.000Z",
      updated_at: "2026-04-19T00:00:00.000Z",
    } as any);

    const result = await updatePurchaseOrderForAccount(
      "00000000-0000-4000-8000-0000000000bd",
      "00000000-0000-4000-8000-0000000000bc",
      { total_paid_vnd: 1200, status: "received" },
      "owner@example.com",
    );

    expect(result.status).toBe("received");
    expect(updatePurchaseOrderRepo).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-0000000000bd",
      "00000000-0000-4000-8000-0000000000bc",
      expect.objectContaining({ status: "received" }),
    );
    expect(createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: "00000000-0000-4000-8000-0000000000bc",
        action_type: "PROCUREMENT_UPDATED",
        created_by: "owner@example.com",
      }),
    );
  });

  it("deletes a purchase order and logs activity", async () => {
    vi.mocked(getPurchaseOrderByIdRepo).mockResolvedValue({
      id: "00000000-0000-4000-8000-0000000000bf",
      provider_id: "00000000-0000-4000-8000-0000000000c0",
      items: [],
      status: "pending",
      total_amount_vnd: 1000,
      total_paid_vnd: 0,
      created_at: "2026-04-19T00:00:00.000Z",
      updated_at: "2026-04-19T00:00:00.000Z",
    } as any);
    vi.mocked(deletePurchaseOrderRepo).mockResolvedValue(undefined as any);

    await deletePurchaseOrderForAccount("00000000-0000-4000-8000-0000000000bf", "00000000-0000-4000-8000-0000000000bc", "owner@example.com");

    expect(getPurchaseOrderByIdRepo).toHaveBeenCalledWith("00000000-0000-4000-8000-0000000000bf", "00000000-0000-4000-8000-0000000000bc");
    expect(deletePurchaseOrderRepo).toHaveBeenCalledWith("00000000-0000-4000-8000-0000000000bf", "00000000-0000-4000-8000-0000000000bc");
    expect(createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: "00000000-0000-4000-8000-0000000000bc",
        action_type: "PROCUREMENT_UPDATED",
        created_by: "owner@example.com",
      }),
    );
  });

  it("gets a purchase order and maps it", async () => {
    vi.mocked(getPurchaseOrderByIdRepo).mockResolvedValue({
      id: "00000000-0000-4000-8000-0000000000c1",
      provider_id: "00000000-0000-4000-8000-0000000000c2",
      items: [],
      status: "pending",
      total_amount_vnd: 1000,
      total_paid_vnd: 0,
      created_at: "2026-04-19T00:00:00.000Z",
      updated_at: "2026-04-19T00:00:00.000Z",
    } as any);

    const result = await getPurchaseOrderForAccount("00000000-0000-4000-8000-0000000000c1", "00000000-0000-4000-8000-0000000000bc");

    expect(result.id).toBe("00000000-0000-4000-8000-0000000000c1");
    expect(result.providerId).toBe("00000000-0000-4000-8000-0000000000c2");
  });
});
