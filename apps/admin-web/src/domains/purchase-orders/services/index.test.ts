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
        id: "po-1",
        provider_id: "prov-1",
        items: [],
        status: "pending",
        total_amount_vnd: 1000,
        total_paid_vnd: 0,
        created_at: "2026-04-19T00:00:00.000Z",
        updated_at: "2026-04-19T00:00:00.000Z",
      } as any,
    ]);

    const result = await listPurchaseOrdersForAccount("acct-1");

    expect(result).toHaveLength(1);
    expect(result[0].providerId).toBe("prov-1");
    expect(listPurchaseOrdersRepo).toHaveBeenCalledWith("acct-1", undefined);
  });

  it("creates a purchase order and logs activity", async () => {
    vi.mocked(createPurchaseOrderRepo).mockResolvedValue({
      id: "po-2",
      provider_id: "prov-2",
      items: [{ product_id: "prod-1" }],
      status: "partial",
      total_amount_vnd: 1200,
      total_paid_vnd: 200,
      created_at: "2026-04-19T00:00:00.000Z",
      updated_at: "2026-04-19T00:00:00.000Z",
    } as any);

    const result = await createPurchaseOrderForAccount(
      "acct-1",
      {
        provider_id: "prov-2",
        items: [{ product_id: "prod-1" }],
        total_amount_vnd: 1200,
        total_paid_vnd: 200,
      },
      "owner@example.com",
    );

    expect(result.id).toBe("po-2");
    expect(createPurchaseOrderRepo).toHaveBeenCalledWith(
      "acct-1",
      expect.objectContaining({ provider_id: "prov-2" }),
    );
    expect(createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: "acct-1",
        action_type: "PROCUREMENT_UPDATED",
        created_by: "owner@example.com",
      }),
    );
  });

  it("updates a purchase order and logs activity", async () => {
    vi.mocked(updatePurchaseOrderRepo).mockResolvedValue({
      id: "po-3",
      provider_id: "prov-3",
      items: [],
      status: "received",
      total_amount_vnd: 1200,
      total_paid_vnd: 1200,
      created_at: "2026-04-19T00:00:00.000Z",
      updated_at: "2026-04-19T00:00:00.000Z",
    } as any);

    const result = await updatePurchaseOrderForAccount(
      "po-3",
      "acct-1",
      { total_paid_vnd: 1200, status: "received" },
      "owner@example.com",
    );

    expect(result.status).toBe("received");
    expect(updatePurchaseOrderRepo).toHaveBeenCalledWith(
      "po-3",
      "acct-1",
      expect.objectContaining({ status: "received" }),
    );
    expect(createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: "acct-1",
        action_type: "PROCUREMENT_UPDATED",
        created_by: "owner@example.com",
      }),
    );
  });

  it("deletes a purchase order and logs activity", async () => {
    vi.mocked(getPurchaseOrderByIdRepo).mockResolvedValue({
      id: "po-4",
      provider_id: "prov-4",
      items: [],
      status: "pending",
      total_amount_vnd: 1000,
      total_paid_vnd: 0,
      created_at: "2026-04-19T00:00:00.000Z",
      updated_at: "2026-04-19T00:00:00.000Z",
    } as any);
    vi.mocked(deletePurchaseOrderRepo).mockResolvedValue(undefined as any);

    await deletePurchaseOrderForAccount("po-4", "acct-1", "owner@example.com");

    expect(getPurchaseOrderByIdRepo).toHaveBeenCalledWith("po-4", "acct-1");
    expect(deletePurchaseOrderRepo).toHaveBeenCalledWith("po-4", "acct-1");
    expect(createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: "acct-1",
        action_type: "PROCUREMENT_UPDATED",
        created_by: "owner@example.com",
      }),
    );
  });

  it("gets a purchase order and maps it", async () => {
    vi.mocked(getPurchaseOrderByIdRepo).mockResolvedValue({
      id: "po-5",
      provider_id: "prov-5",
      items: [],
      status: "pending",
      total_amount_vnd: 1000,
      total_paid_vnd: 0,
      created_at: "2026-04-19T00:00:00.000Z",
      updated_at: "2026-04-19T00:00:00.000Z",
    } as any);

    const result = await getPurchaseOrderForAccount("po-5", "acct-1");

    expect(result.id).toBe("po-5");
    expect(result.providerId).toBe("prov-5");
  });
});
