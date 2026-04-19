/**
 * RFM Calculator — Comprehensive Unit Tests
 * Tests scoreAgainstThresholds, scoreRecency, calculateRfm, determineSegment
 */

import { describe, it, expect } from "vitest";
import { calculateRfm, determineSegment } from "../rfm-calculator";
import type { RfmInput } from "../rfm-calculator";

// Helper to build RFM input
function makeInput(overrides: Partial<RfmInput> = {}): RfmInput {
  return {
    customerId: "cust-001",
    lastOrderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    totalOrders: 5,
    totalSpentVnd: 2_500_000,
    ...overrides,
  };
}

// ── determineSegment ─────────────────────────────────────────
describe("determineSegment", () => {
  it("VIP: r>=4, f>=4, m>=4", () => {
    expect(determineSegment(5, 5, 5)).toBe("vip");
    expect(determineSegment(4, 4, 4)).toBe("vip");
  });

  it("churned: r<=1, f<=2", () => {
    expect(determineSegment(1, 1, 3)).toBe("churned");
    expect(determineSegment(1, 2, 5)).toBe("churned");
  });

  it("at_risk: r<=2, f>=3", () => {
    expect(determineSegment(2, 3, 3)).toBe("at_risk");
    expect(determineSegment(1, 5, 5)).toBe("at_risk"); // f>=3 takes priority over churned f<=2 check
  });

  it("loyal: r>=3, f>=3, m>=3", () => {
    expect(determineSegment(3, 3, 3)).toBe("loyal");
    expect(determineSegment(3, 4, 3)).toBe("loyal");
  });

  it("regular: fallback for everything else", () => {
    expect(determineSegment(3, 2, 2)).toBe("regular");
    expect(determineSegment(2, 2, 2)).toBe("regular");
  });

  // Priority order: vip > churned > at_risk > loyal > regular
  it("vip takes priority over loyal", () => {
    expect(determineSegment(5, 5, 5)).toBe("vip");
  });
});

// ── calculateRfm ─────────────────────────────────────────────
describe("calculateRfm", () => {
  const fixedNow = new Date("2026-03-13T00:00:00Z");

  describe("new customer", () => {
    it("returns 'new' segment with score 20", () => {
      const result = calculateRfm({
        customerId: "new-001",
        lastOrderDate: null,
        totalOrders: 0,
        totalSpentVnd: 0,
      }, fixedNow);
      expect(result.segment).toBe("new");
      expect(result.score).toBe(20);
      expect(result.recency).toBe(1);
      expect(result.frequency).toBe(1);
      expect(result.monetary).toBe(1);
    });
  });

  describe("recency scoring", () => {
    it("R=5 for orders within 7 days", () => {
      const result = calculateRfm(makeInput({
        lastOrderDate: new Date(fixedNow.getTime() - 3 * 86400000).toISOString(),
      }), fixedNow);
      expect(result.recency).toBe(5);
    });

    it("R=4 for orders 8-30 days ago", () => {
      const result = calculateRfm(makeInput({
        lastOrderDate: new Date(fixedNow.getTime() - 15 * 86400000).toISOString(),
      }), fixedNow);
      expect(result.recency).toBe(4);
    });

    it("R=1 for orders >90 days ago", () => {
      const result = calculateRfm(makeInput({
        lastOrderDate: new Date(fixedNow.getTime() - 100 * 86400000).toISOString(),
      }), fixedNow);
      expect(result.recency).toBe(1);
    });

    it("R=1 for null lastOrderDate (with totalOrders > 0)", () => {
      const result = calculateRfm(makeInput({
        lastOrderDate: null,
        totalOrders: 3,
      }), fixedNow);
      expect(result.recency).toBe(1);
    });
  });

  describe("frequency scoring", () => {
    it("F=5 for >= 10 orders", () => {
      const result = calculateRfm(makeInput({ totalOrders: 15 }), fixedNow);
      expect(result.frequency).toBe(5);
    });

    it("F=4 for 5-9 orders", () => {
      const result = calculateRfm(makeInput({ totalOrders: 7 }), fixedNow);
      expect(result.frequency).toBe(4);
    });

    it("F=2 for 1 order", () => {
      const result = calculateRfm(makeInput({ totalOrders: 1 }), fixedNow);
      expect(result.frequency).toBe(2);
    });
  });

  describe("monetary scoring", () => {
    it("M=5 for >= 5,000,000 VND", () => {
      const result = calculateRfm(makeInput({ totalSpentVnd: 10_000_000 }), fixedNow);
      expect(result.monetary).toBe(5);
    });

    it("M=1 for < 100,000 VND", () => {
      const result = calculateRfm(makeInput({ totalSpentVnd: 50_000 }), fixedNow);
      expect(result.monetary).toBe(1);
    });
  });

  describe("score calculation", () => {
    it("score is between 0 and 100", () => {
      const result = calculateRfm(makeInput(), fixedNow);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("maximum score is 100 (R5 F5 M5)", () => {
      const result = calculateRfm(makeInput({
        lastOrderDate: new Date(fixedNow.getTime() - 1 * 86400000).toISOString(),
        totalOrders: 20,
        totalSpentVnd: 50_000_000,
      }), fixedNow);
      expect(result.score).toBe(100);
    });
  });

  describe("segment integration", () => {
    it("VIP customer: recent, frequent, high-spend", () => {
      const result = calculateRfm(makeInput({
        lastOrderDate: new Date(fixedNow.getTime() - 2 * 86400000).toISOString(),
        totalOrders: 12,
        totalSpentVnd: 8_000_000,
      }), fixedNow);
      expect(result.segment).toBe("vip");
    });

    it("churned customer: old orders, low frequency", () => {
      const result = calculateRfm(makeInput({
        lastOrderDate: new Date(fixedNow.getTime() - 180 * 86400000).toISOString(),
        totalOrders: 1,
        totalSpentVnd: 50_000,
      }), fixedNow);
      expect(result.segment).toBe("churned");
    });
  });
});
