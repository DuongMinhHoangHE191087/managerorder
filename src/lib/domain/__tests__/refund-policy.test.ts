/**
 * Refund Policy — Comprehensive Unit Tests
 * Tests calculateRefund for full/prorated modes + edge cases
 */

import { describe, it, expect } from "vitest";
import { calculateRefund } from "../refund-policy";

describe("calculateRefund", () => {
  // ─── Full Refund Mode ──────────────────────────────────────────
  describe("full refund mode", () => {
    it("returns full paid amount", () => {
      const result = calculateRefund({ paidAmountVnd: 500_000, consumedDays: 10, totalDays: 30, mode: "full" });
      expect(result.refundableAmountVnd).toBe(500_000);
      expect(result.consumedRatio).toBe(0);
    });

    it("returns 0 when paidAmount is 0", () => {
      const result = calculateRefund({ paidAmountVnd: 0, consumedDays: 10, totalDays: 30, mode: "full" });
      expect(result.refundableAmountVnd).toBe(0);
    });

    it("clamps negative paidAmount to 0", () => {
      const result = calculateRefund({ paidAmountVnd: -100, consumedDays: 0, totalDays: 30, mode: "full" });
      expect(result.refundableAmountVnd).toBe(0);
    });

    it("ignores consumedDays in full mode", () => {
      const result = calculateRefund({ paidAmountVnd: 300_000, consumedDays: 30, totalDays: 30, mode: "full" });
      expect(result.refundableAmountVnd).toBe(300_000);
    });

    it("contains full refund note", () => {
      const result = calculateRefund({ paidAmountVnd: 100_000, consumedDays: 5, totalDays: 30, mode: "full" });
      expect(result.notes).toContain("Hoan tien toan bo");
    });
  });

  // ─── Prorated Refund Mode ──────────────────────────────────────
  describe("prorated refund mode", () => {
    it("refunds proportional to unused time", () => {
      // 10 of 30 days consumed → 20/30 × 300,000 = 200,000
      const result = calculateRefund({ paidAmountVnd: 300_000, consumedDays: 10, totalDays: 30, mode: "pro_rata" });
      expect(result.refundableAmountVnd).toBe(200_000);
      expect(result.consumedRatio).toBeCloseTo(10/30, 5);
    });

    it("returns 0 when all days consumed", () => {
      const result = calculateRefund({ paidAmountVnd: 300_000, consumedDays: 30, totalDays: 30, mode: "pro_rata" });
      expect(result.refundableAmountVnd).toBe(0);
      expect(result.consumedRatio).toBe(1);
    });

    it("returns full amount when 0 days consumed", () => {
      const result = calculateRefund({ paidAmountVnd: 100_000, consumedDays: 0, totalDays: 30, mode: "pro_rata" });
      expect(result.refundableAmountVnd).toBe(100_000);
      expect(result.consumedRatio).toBe(0);
    });

    it("clamps consumedDays > totalDays to ratio 1", () => {
      const result = calculateRefund({ paidAmountVnd: 100_000, consumedDays: 50, totalDays: 30, mode: "pro_rata" });
      expect(result.refundableAmountVnd).toBe(0);
      expect(result.consumedRatio).toBe(1);
    });

    it("clamps negative consumedDays to 0", () => {
      const result = calculateRefund({ paidAmountVnd: 100_000, consumedDays: -5, totalDays: 30, mode: "pro_rata" });
      expect(result.refundableAmountVnd).toBe(100_000);
      expect(result.consumedRatio).toBe(0);
    });

    it("handles totalDays = 0 (safeguard division by zero)", () => {
      // safeTotalDays = max(0, 1) = 1, consumedRatio = min(max(5/1, 0), 1) = 1
      const result = calculateRefund({ paidAmountVnd: 100_000, consumedDays: 5, totalDays: 0, mode: "pro_rata" });
      expect(result.refundableAmountVnd).toBe(0);
    });

    it("handles totalDays = 1 (minimum period)", () => {
      const result = calculateRefund({ paidAmountVnd: 100_000, consumedDays: 0, totalDays: 1, mode: "pro_rata" });
      expect(result.refundableAmountVnd).toBe(100_000);
    });

    it("floors the refund amount", () => {
      // 1 of 3 days consumed → 2/3 × 100 = 66.666... → floor = 66
      const result = calculateRefund({ paidAmountVnd: 100, consumedDays: 1, totalDays: 3, mode: "pro_rata" });
      expect(result.refundableAmountVnd).toBe(66);
    });

    it("contains prorated note", () => {
      const result = calculateRefund({ paidAmountVnd: 100_000, consumedDays: 5, totalDays: 30, mode: "pro_rata" });
      expect(result.notes).toContain("theo ti le");
    });

    it("never returns negative refund", () => {
      const result = calculateRefund({ paidAmountVnd: -500, consumedDays: 0, totalDays: 30, mode: "pro_rata" });
      expect(result.refundableAmountVnd).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── Large Values ──────────────────────────────────────────────
  describe("large values", () => {
    it("handles very large paid amounts", () => {
      const result = calculateRefund({ paidAmountVnd: 999_999_999, consumedDays: 15, totalDays: 30, mode: "pro_rata" });
      expect(result.refundableAmountVnd).toBe(499_999_999);
    });

    it("handles very large total days", () => {
      const result = calculateRefund({ paidAmountVnd: 365_000, consumedDays: 1, totalDays: 365, mode: "pro_rata" });
      expect(result.refundableAmountVnd).toBe(364_000);
    });
  });
});
