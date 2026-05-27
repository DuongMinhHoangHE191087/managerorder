import { describe, expect, it } from "vitest";
import {
  calculateOrderRenewalProjection,
  ensureOrderRefundRequestAllowed,
  ensureOrderRenewalAllowed,
  ensurePremiumSubscriptionRefundAllowed,
  ensurePremiumSubscriptionRenewalAllowed,
  normalizeRefundCalculationInput,
} from "../sales-workflow-guards";

describe("sales-workflow-guards", () => {
  describe("order renewal", () => {
    it("builds a renewal projection for an active order", () => {
      ensureOrderRenewalAllowed("active");

      const result = calculateOrderRenewalProjection(
        {
          status: "active",
          total_amount_vnd: 1_000_000,
          total_paid: 700_000,
          expires_at: "2026-04-10T00:00:00.000Z",
        },
        {
          durationMonths: 2,
          addAmountVnd: 200_000,
          addPaidVnd: 200_000,
        },
      );

      expect(result.totalAmountVnd).toBe(1_200_000);
      expect(result.totalPaidVnd).toBe(900_000);
      expect(result.status).toBe("active");
      expect(result.expiresAt).toContain("2026");
    });

    it("reactivates an expired order when the renewal is fully paid", () => {
      const result = calculateOrderRenewalProjection(
        {
          status: "expired",
          total_amount_vnd: 500_000,
          total_paid: 500_000,
          expires_at: "2026-04-10T00:00:00.000Z",
        },
        {
          durationMonths: 1,
          addAmountVnd: 0,
          addPaidVnd: 0,
        },
      );

      expect(result.status).toBe("active");
    });

    it("blocks invalid renewal status and invalid payloads", () => {
      expect(() => ensureOrderRenewalAllowed("draft")).toThrow("Chỉ có thể gia hạn đơn hàng");
      expect(() =>
        calculateOrderRenewalProjection(
          { status: "active", total_amount_vnd: 0, total_paid: 0 },
          { durationMonths: 0, addAmountVnd: 1, addPaidVnd: 1 },
        ),
      ).toThrow("durationMonths phải là số nguyên lớn hơn 0");
    });
  });

  describe("order refund request", () => {
    it("rejects refunded or unpaid orders", () => {
      expect(() => ensureOrderRefundRequestAllowed({ status: "refunded", total_paid: 100 })).toThrow(
        "Đơn hàng đã hoàn tiền",
      );
      expect(() => ensureOrderRefundRequestAllowed({ status: "paid", total_paid: 0 })).toThrow(
        "chưa có thanh toán",
      );
    });

    it("normalizes refund inputs and validates mode", () => {
      const result = normalizeRefundCalculationInput({
        refundMode: "pro_rata",
        consumedDays: 4,
        totalDays: 30,
      });

      expect(result).toEqual({
        refundMode: "pro_rata",
        consumedDays: 4,
        totalDays: 30,
      });

      expect(() =>
        normalizeRefundCalculationInput({
          refundMode: "invalid",
          consumedDays: 4,
          totalDays: 30,
        }),
      ).toThrow("Phương thức hoàn tiền không hợp lệ");
    });
  });

  describe("premium subscription guards", () => {
    it("blocks invalid renewal and refund states", () => {
      expect(() =>
        ensurePremiumSubscriptionRenewalAllowed({ status: "inactive", renewal_status: null }),
      ).toThrow("active");
      expect(() =>
        ensurePremiumSubscriptionRenewalAllowed({ status: "expired", renewal_status: null }),
      ).not.toThrow();
      expect(() =>
        ensurePremiumSubscriptionRenewalAllowed({ status: "active", renewal_status: "pending" }),
      ).toThrow("đã tồn tại");
      expect(() =>
        ensurePremiumSubscriptionRefundAllowed({ renewal_status: "pending", original_price: 1000 }),
      ).toThrow("bị từ chối");
    });
  });
});
