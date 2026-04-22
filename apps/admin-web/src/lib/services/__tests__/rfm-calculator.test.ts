import { describe, it, expect } from "vitest";
import { calculateRfm, determineSegment } from "../rfm-calculator";

const NOW = new Date("2026-03-12T00:00:00Z");

describe("calculateRfm", () => {
  it("returns VIP segment for high-value recent frequent buyer", () => {
    const result = calculateRfm(
      {
        customerId: "c1",
        lastOrderDate: "2026-03-10T00:00:00Z", // 2 days ago
        totalOrders: 15,
        totalSpentVnd: 10_000_000,
      },
      NOW,
    );
    expect(result.recency).toBe(5);
    expect(result.frequency).toBe(5);
    expect(result.monetary).toBe(5);
    expect(result.segment).toBe("vip");
    expect(result.score).toBe(100);
  });

  it("returns churned for customer with no recent orders and low frequency", () => {
    const result = calculateRfm(
      {
        customerId: "c2",
        lastOrderDate: "2025-01-01T00:00:00Z", // 435+ days ago
        totalOrders: 1,
        totalSpentVnd: 50_000,
      },
      NOW,
    );
    expect(result.recency).toBe(1);
    expect(result.frequency).toBe(2);
    expect(result.monetary).toBe(1);
    expect(result.segment).toBe("churned");
  });

  it("returns at_risk for customer who used to buy frequently but stopped", () => {
    const result = calculateRfm(
      {
        customerId: "c3",
        lastOrderDate: "2025-12-01T00:00:00Z", // ~100 days ago
        totalOrders: 8,
        totalSpentVnd: 3_000_000,
      },
      NOW,
    );
    expect(result.recency).toBeLessThanOrEqual(2);
    expect(result.frequency).toBeGreaterThanOrEqual(3);
    expect(result.segment).toBe("at_risk");
  });

  it("returns regular for average customer", () => {
    const result = calculateRfm(
      {
        customerId: "c4",
        lastOrderDate: "2026-02-15T00:00:00Z", // 25 days ago
        totalOrders: 2,
        totalSpentVnd: 200_000,
      },
      NOW,
    );
    expect(result.segment).toBe("regular");
  });

  it("returns loyal for consistent good customer", () => {
    const result = calculateRfm(
      {
        customerId: "c5",
        lastOrderDate: "2026-02-20T00:00:00Z", // 20 days ago → R=4? No, <=30d → R=4. Let's use <=60d → R=3
        totalOrders: 4,   // >=3 → F=3
        totalSpentVnd: 1_000_000, // >=500k → M=3
      },
      NOW,
    );
    expect(result.recency).toBeGreaterThanOrEqual(3);
    expect(result.frequency).toBeGreaterThanOrEqual(3);
    expect(result.monetary).toBeGreaterThanOrEqual(3);
    expect(result.segment).toBe("loyal");
  });

  it("handles null lastOrderDate (never ordered) — segment 'new'", () => {
    const result = calculateRfm(
      {
        customerId: "c6",
        lastOrderDate: null,
        totalOrders: 0,
        totalSpentVnd: 0,
      },
      NOW,
    );
    expect(result.recency).toBe(1);
    expect(result.frequency).toBe(1);
    expect(result.monetary).toBe(1);
    expect(result.segment).toBe("new");
    expect(result.score).toBe(20);
  });

  it("score is between 0 and 100", () => {
    const inputs = [
      { customerId: "a", lastOrderDate: null, totalOrders: 0, totalSpentVnd: 0 },
      { customerId: "b", lastOrderDate: "2026-03-11T00:00:00Z", totalOrders: 20, totalSpentVnd: 50_000_000 },
    ];
    for (const input of inputs) {
      const result = calculateRfm(input, NOW);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("determineSegment", () => {
  it("VIP: R>=4, F>=4, M>=4", () => {
    expect(determineSegment(5, 5, 5)).toBe("vip");
    expect(determineSegment(4, 4, 4)).toBe("vip");
  });

  it("Churned: R<=1, F<=2", () => {
    expect(determineSegment(1, 1, 1)).toBe("churned");
    expect(determineSegment(1, 2, 3)).toBe("churned");
  });

  it("At Risk: R<=2, F>=3", () => {
    expect(determineSegment(2, 3, 2)).toBe("at_risk");
    expect(determineSegment(1, 4, 5)).toBe("at_risk");
  });

  it("Loyal: R>=3, F>=3, M>=3", () => {
    expect(determineSegment(3, 3, 3)).toBe("loyal");
    expect(determineSegment(3, 3, 5)).toBe("loyal");
  });

  it("Regular: fallback", () => {
    expect(determineSegment(3, 2, 2)).toBe("regular");
    expect(determineSegment(5, 1, 1)).toBe("regular");
  });
});
