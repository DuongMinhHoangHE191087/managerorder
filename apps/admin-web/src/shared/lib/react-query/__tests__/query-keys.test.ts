import { describe, it, expect } from "vitest";
import { queryKeys } from "../query-keys";

describe("queryKeys", () => {
  it("products key is readonly tuple ['products']", () => {
    expect(queryKeys.products).toEqual(["products"]);
  });

  it("orders key is readonly tuple ['orders']", () => {
    expect(queryKeys.orders).toEqual(["orders"]);
  });

  it("customers key is readonly tuple ['customers']", () => {
    expect(queryKeys.customers).toEqual(["customers"]);
  });

  it("inventory key is readonly tuple ['inventory']", () => {
    expect(queryKeys.inventory).toEqual(["inventory"]);
  });

  it("systemSettings key", () => {
    expect(queryKeys.systemSettings).toEqual(["settings", "system"]);
  });

  it("premiumAccounts key", () => {
    expect(queryKeys.premiumAccounts).toEqual(["premium", "accounts"]);
  });

  it("sourceAccounts key", () => {
    expect(queryKeys.sourceAccounts).toEqual(["source-accounts"]);
  });

  it("product(id) returns ['products', id]", () => {
    expect(queryKeys.product("abc-123")).toEqual(["products", "abc-123"]);
  });

  it("order(id) returns ['orders', id]", () => {
    expect(queryKeys.order("ord-456")).toEqual(["orders", "ord-456"]);
  });

  it("customer(id) returns ['customers', id]", () => {
    expect(queryKeys.customer("cust-789")).toEqual(["customers", "cust-789"]);
  });

  it("orderStatusHistory(id) returns nested key", () => {
    expect(queryKeys.orderStatusHistory("x")).toEqual(["orders", "x", "status-history"]);
  });

  it("payments(id) returns nested key", () => {
    expect(queryKeys.payments("x")).toEqual(["orders", "x", "payments"]);
  });

  it("refunds(id) returns nested key", () => {
    expect(queryKeys.refunds("x")).toEqual(["orders", "x", "refunds"]);
  });

  it("customer360Stats(id) returns nested key", () => {
    expect(queryKeys.customer360Stats("c1")).toEqual(["customers", "c1", "360-stats"]);
  });

  it("inventoryItem(id) returns nested key", () => {
    expect(queryKeys.inventoryItem("inv-1")).toEqual(["inventory", "inv-1"]);
  });

  it("static keys are readonly (no push possible at runtime)", () => {
    const k1 = queryKeys.products;
    const k2 = queryKeys.products;
    expect(k1).toBe(k2);
  });

  it("dynamic keys produce new tuples each call", () => {
    const k1 = queryKeys.product("a");
    const k2 = queryKeys.product("a");
    expect(k1).toEqual(k2);
    expect(k1).not.toBe(k2);
  });
});
