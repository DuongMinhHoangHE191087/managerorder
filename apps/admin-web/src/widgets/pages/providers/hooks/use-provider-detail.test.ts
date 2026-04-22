import { describe, expect, it } from "vitest";
import { buildPurchaseOrderPaymentUpdatePayload } from "./use-provider-detail";

describe("buildPurchaseOrderPaymentUpdatePayload", () => {
  it("marks the order as received when the payment closes the balance", () => {
    const result = buildPurchaseOrderPaymentUpdatePayload(
      {
        total_paid_vnd: 600,
        total_amount_vnd: 1_000,
      },
      400,
      "2026-04-19T10:15:00.000Z",
    );

    expect(result).toEqual({
      updatePayload: {
        total_paid_vnd: 1_000,
        status: "received",
        received_at: "2026-04-19T10:15:00.000Z",
      },
      fullyPaid: true,
    });
  });

  it("keeps the order partial when the balance is not closed", () => {
    const result = buildPurchaseOrderPaymentUpdatePayload(
      {
        total_paid_vnd: 250,
        total_amount_vnd: 1_000,
      },
      200,
      "2026-04-19T10:15:00.000Z",
    );

    expect(result).toEqual({
      updatePayload: {
        total_paid_vnd: 450,
        status: "partial",
      },
      fullyPaid: false,
    });
  });
});
