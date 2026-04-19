import { describe, it, expect } from "vitest";
import {
  canTransitionOrder,
  transitionOrder,
  getOrderNextStatuses,
} from "../order-state-machine";
import type { Order, OrderStatus } from "../types";

function createMockOrder(status: OrderStatus): Order {
  return {
    id: "ord-test",
    customerId: "c1",
    items: [],
    status,
    totalAmountVnd: 100,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  } as Order;
}

// ── canTransitionOrder extended cases ─────────────────────────

describe("canTransitionOrder — extended transitions", () => {
  const validTransitions: [OrderStatus, OrderStatus][] = [
    ["draft", "pending_payment"],
    ["draft", "refunded"],
    ["pending_payment", "paid"],
    ["pending_payment", "refunded"],
    ["paid", "provisioning"],
    ["paid", "refunded"],
    ["provisioning", "active"],
    ["provisioning", "refunded"],
    ["active", "expired"],
    ["active", "refunded"],
    ["expired", "active"],
    ["expired", "refunded"],
  ];

  it.each(validTransitions)(
    "allows transition from %s to %s",
    (from, to) => {
      expect(canTransitionOrder(from, to)).toBe(true);
    }
  );

  const invalidTransitions: [OrderStatus, OrderStatus][] = [
    ["draft", "active"],
    ["draft", "expired"],
    ["draft", "provisioning"],
    ["pending_payment", "active"],
    ["pending_payment", "expired"],
    ["paid", "draft"],
    ["paid", "expired"],
    ["provisioning", "draft"],
    ["provisioning", "paid"],
    ["active", "draft"],
    ["active", "paid"],
    ["refunded", "draft"],
    ["refunded", "active"],
    ["refunded", "paid"],
  ];

  it.each(invalidTransitions)(
    "blocks transition from %s to %s",
    (from, to) => {
      expect(canTransitionOrder(from, to)).toBe(false);
    }
  );
});

// ── transitionOrder extended cases ────────────────────────────

describe("transitionOrder — extended cases", () => {
  it("transitions paid → provisioning", () => {
    const order = createMockOrder("paid");
    const result = transitionOrder(order, "provisioning");
    expect(result.status).toBe("provisioning");
    expect(result.updatedAt).not.toBe(order.updatedAt);
  });

  it("transitions provisioning → active", () => {
    const order = createMockOrder("provisioning");
    const result = transitionOrder(order, "active");
    expect(result.status).toBe("active");
  });

  it("transitions expired → active (re-activation)", () => {
    const order = createMockOrder("expired");
    const result = transitionOrder(order, "active");
    expect(result.status).toBe("active");
  });

  it("throws on invalid transition paid → draft", () => {
    const order = createMockOrder("paid");
    expect(() => transitionOrder(order, "draft")).toThrow("Invalid order transition");
  });

  it("preserves original order properties on transition", () => {
    const order = createMockOrder("draft");
    const result = transitionOrder(order, "pending_payment");
    expect(result.id).toBe(order.id);
    expect(result.customerId).toBe(order.customerId);
    expect(result.totalAmountVnd).toBe(order.totalAmountVnd);
  });

  it("any status can refund", () => {
    const statuses: OrderStatus[] = ["draft", "pending_payment", "paid", "provisioning", "active", "expired"];
    for (const s of statuses) {
      expect(canTransitionOrder(s, "refunded")).toBe(true);
    }
  });

  it("refunded is terminal (no transitions out)", () => {
    expect(getOrderNextStatuses("refunded")).toEqual([]);
  });
});

// ── getOrderNextStatuses ──────────────────────────────────────

describe("getOrderNextStatuses — complete coverage", () => {
  it("draft has pending_payment and refunded", () => {
    expect(getOrderNextStatuses("draft")).toEqual(["pending_payment", "refunded"]);
  });

  it("pending_payment has paid and refunded", () => {
    expect(getOrderNextStatuses("pending_payment")).toEqual(["paid", "refunded"]);
  });

  it("paid has provisioning and refunded", () => {
    expect(getOrderNextStatuses("paid")).toEqual(["provisioning", "refunded"]);
  });

  it("provisioning has active and refunded", () => {
    expect(getOrderNextStatuses("provisioning")).toEqual(["active", "refunded"]);
  });

  it("active has expired and refunded", () => {
    expect(getOrderNextStatuses("active")).toEqual(["expired", "refunded"]);
  });

  it("expired has active and refunded", () => {
    expect(getOrderNextStatuses("expired")).toEqual(["active", "refunded"]);
  });
});
