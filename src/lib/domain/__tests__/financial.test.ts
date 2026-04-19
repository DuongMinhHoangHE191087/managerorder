import { describe, expect, it } from "vitest";
import {
  calculateBalanceDue,
  formatPaymentMethodLabel,
  formatPaymentTermsLabel,
  withFinancialSummary,
} from "../financial";

describe("financial helpers", () => {
  it("formats payment terms labels", () => {
    expect(formatPaymentTermsLabel("prepaid")).toBe("Trả trước");
    expect(formatPaymentTermsLabel("credit")).toBe("Công nợ");
    expect(formatPaymentTermsLabel("cod")).toBe("COD / trực tiếp");
  });

  it("formats payment method labels with legacy fallback", () => {
    expect(formatPaymentMethodLabel("bank_transfer")).toBe("Chuyển khoản");
    expect(formatPaymentMethodLabel("cash")).toBe("Tiền mặt");
    expect(formatPaymentMethodLabel("wallet")).toBe("Ví điện tử");
    expect(formatPaymentMethodLabel("momo")).toBe("MoMo");
    expect(formatPaymentMethodLabel("debt")).toBe("Công nợ");
  });

  it("returns empty string for unknown payment labels", () => {
    expect(formatPaymentTermsLabel("crypto")).toBe("");
    expect(formatPaymentMethodLabel("crypto")).toBe("");
  });

  it("builds financial summary from order amounts", () => {
    const summary = withFinancialSummary({
      total_amount_vnd: 300_000,
      total_paid: 120_000,
      payment_terms: "credit",
      created_at: "2026-04-01T00:00:00.000Z",
    });

    expect(summary.payment_terms).toBe("credit");
    expect(summary.payment_state).toBe("partial");
    expect(summary.balance_due_vnd).toBe(180_000);
    expect(summary.is_fully_paid).toBe(false);
    expect(summary.overpaid_amount_vnd).toBe(0);
    expect(summary.debt_age_days).toBeGreaterThanOrEqual(0);
  });

  it("clamps balance due at zero", () => {
    expect(calculateBalanceDue(100_000, 120_000)).toBe(0);
  });
});
