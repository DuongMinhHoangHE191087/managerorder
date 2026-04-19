/**
 * Order State Machine — Comprehensive Transition Tests
 * Tests canTransitionOrder, transitionOrder, getOrderNextStatuses
 * for ALL states and edge cases
 */

import { describe, it, expect } from "vitest";
import {
  canTransitionOrder,
  transitionOrder,
  getOrderNextStatuses,
} from "../order-state-machine";
import type { Order, OrderStatus } from "@/lib/domain/types";

// ── Test data ────────────────────────────────────────────────
function makeOrder(status: OrderStatus): Order {
  return {
    id: "ord_test",
    customerId: "cust_001",
    items: [],
    status,
    totalAmountVnd: 100_000,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

// ── Full Transition Matrix ───────────────────────────────────
describe("canTransitionOrder — full matrix", () => {
  const validTransitions: Array<[OrderStatus, OrderStatus]> = [
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

  it.each(validTransitions)("allows %s → %s", (from, to) => {
    expect(canTransitionOrder(from, to)).toBe(true);
  });

  const invalidTransitions: Array<[OrderStatus, OrderStatus]> = [
    ["draft", "active"],
    ["draft", "expired"],
    ["draft", "provisioning"],
    ["draft", "paid"],
    ["pending_payment", "active"],
    ["pending_payment", "expired"],
    ["pending_payment", "provisioning"],
    ["paid", "active"],
    ["paid", "expired"],
    ["paid", "pending_payment"],
    ["provisioning", "paid"],
    ["provisioning", "expired"],
    ["provisioning", "pending_payment"],
    ["active", "paid"],
    ["active", "provisioning"],
    ["active", "pending_payment"],
    ["expired", "paid"],
    ["expired", "provisioning"],
    ["expired", "pending_payment"],
    ["refunded", "draft"],
    ["refunded", "pending_payment"],
    ["refunded", "paid"],
    ["refunded", "provisioning"],
    ["refunded", "active"],
    ["refunded", "expired"],
  ];

  it.each(invalidTransitions)("blocks %s → %s", (from, to) => {
    expect(canTransitionOrder(from, to)).toBe(false);
  });

  it("self-transition is always invalid", () => {
    const allStatuses: OrderStatus[] = ["draft", "pending_payment", "paid", "provisioning", "active", "expired", "refunded"];
    for (const s of allStatuses) {
      expect(canTransitionOrder(s, s)).toBe(false);
    }
  });
});

// ── transitionOrder ──────────────────────────────────────────
describe("transitionOrder", () => {
  it("returns new object with updated status", () => {
    const order = makeOrder("paid");
    const result = transitionOrder(order, "provisioning");
    expect(result.status).toBe("provisioning");
    expect(result).not.toBe(order); // immutable
  });

  it("updates updatedAt timestamp", () => {
    const order = makeOrder("active");
    const result = transitionOrder(order, "expired");
    expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(new Date(order.updatedAt).getTime());
  });

  it("preserves all other fields", () => {
    const order = makeOrder("draft");
    const result = transitionOrder(order, "pending_payment");
    expect(result.id).toBe(order.id);
    expect(result.customerId).toBe(order.customerId);
    expect(result.totalAmountVnd).toBe(order.totalAmountVnd);
  });

  it("throws Error for invalid transition", () => {
    const order = makeOrder("refunded");
    expect(() => transitionOrder(order, "active")).toThrowError(/Invalid order transition/);
  });

  it("error message includes from and to status", () => {
    const order = makeOrder("draft");
    try {
      transitionOrder(order, "active");
    } catch (e: unknown) {
      expect((e as Error).message).toContain("draft");
      expect((e as Error).message).toContain("active");
    }
  });
});

// ── getOrderNextStatuses ─────────────────────────────────────
describe("getOrderNextStatuses", () => {
  it("draft can go to pending_payment or refunded", () => {
    const statuses = getOrderNextStatuses("draft");
    expect(statuses).toContain("pending_payment");
    expect(statuses).toContain("refunded");
    expect(statuses).toHaveLength(2);
  });

  it("pending_payment can go to paid or refunded", () => {
    expect(getOrderNextStatuses("pending_payment")).toEqual(expect.arrayContaining(["paid", "refunded"]));
  });

  it("refunded has no next statuses", () => {
    expect(getOrderNextStatuses("refunded")).toHaveLength(0);
  });

  it("expired can reactivate or refund", () => {
    const statuses = getOrderNextStatuses("expired");
    expect(statuses).toContain("active");
    expect(statuses).toContain("refunded");
  });

  it("all statuses include refunded except refunded itself", () => {
    const nonTerminal: OrderStatus[] = ["draft", "pending_payment", "paid", "provisioning", "active", "expired"];
    for (const s of nonTerminal) {
      expect(getOrderNextStatuses(s)).toContain("refunded");
    }
  });
});
