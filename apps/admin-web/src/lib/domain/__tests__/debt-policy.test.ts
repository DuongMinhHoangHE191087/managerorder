// ============================================================
// DEBT POLICY TESTS — verify evaluateDebtPolicy correctness
// Matches actual API: { allowCreateOrder, severity, shouldAutoLockService, reminderRequired, message }
// Config: { autoLockAfterOverdueDays, warningThresholdVnd }
// ============================================================

import { describe, it, expect } from "vitest";
import { evaluateDebtPolicy, DEFAULT_DEBT_POLICY } from "../debt-policy";

describe("evaluateDebtPolicy", () => {
  describe("no debt scenarios", () => {
    it("returns safe result when debt is 0", () => {
      const result = evaluateDebtPolicy(0, 0);
      expect(result.severity).toBe("none");
      expect(result.allowCreateOrder).toBe(true);
      expect(result.shouldAutoLockService).toBe(false);
      expect(result.reminderRequired).toBe(false);
    });

    it("returns safe result when debt is negative (overpaid)", () => {
      const result = evaluateDebtPolicy(-100000, 0);
      expect(result.severity).toBe("none");
      expect(result.allowCreateOrder).toBe(true);
      expect(result.reminderRequired).toBe(false);
    });
  });

  describe("warning severity (debt > 0, below warningThresholdVnd)", () => {
    it("warns when debt is below warningThresholdVnd and not overdue", () => {
      // Default warningThresholdVnd = 500_000
      const result = evaluateDebtPolicy(200_000, 3);
      expect(result.severity).toBe("warning");
      expect(result.allowCreateOrder).toBe(true);
      expect(result.shouldAutoLockService).toBe(false);
      expect(result.reminderRequired).toBe(true);
    });
  });

  describe("critical severity", () => {
    it("flags critical when debt >= warningThresholdVnd", () => {
      const result = evaluateDebtPolicy(500_000, 3);
      expect(result.severity).toBe("critical");
      expect(result.reminderRequired).toBe(true);
    });

    it("flags critical when overdueDays >= autoLockAfterOverdueDays", () => {
      // Default autoLockAfterOverdueDays = 7
      const result = evaluateDebtPolicy(100_000, 7);
      expect(result.severity).toBe("critical");
      expect(result.shouldAutoLockService).toBe(true);
    });

    it("flags critical when both conditions met", () => {
      const result = evaluateDebtPolicy(1_000_000, 10);
      expect(result.severity).toBe("critical");
      expect(result.shouldAutoLockService).toBe(true);
      expect(result.reminderRequired).toBe(true);
    });
  });

  describe("auto-lock behavior", () => {
    it("should auto-lock when overdue days >= autoLockAfterOverdueDays", () => {
      const result = evaluateDebtPolicy(100_000, DEFAULT_DEBT_POLICY.autoLockAfterOverdueDays);
      expect(result.shouldAutoLockService).toBe(true);
    });

    it("should NOT auto-lock when overdue days < autoLockAfterOverdueDays", () => {
      const result = evaluateDebtPolicy(100_000, DEFAULT_DEBT_POLICY.autoLockAfterOverdueDays - 1);
      expect(result.shouldAutoLockService).toBe(false);
    });
  });

  describe("allowCreateOrder always true", () => {
    it("always allows creating orders regardless of debt level", () => {
      expect(evaluateDebtPolicy(0, 0).allowCreateOrder).toBe(true);
      expect(evaluateDebtPolicy(100_000, 5).allowCreateOrder).toBe(true);
      expect(evaluateDebtPolicy(999_999_999, 365).allowCreateOrder).toBe(true);
    });
  });

  describe("custom policy config", () => {
    it("respects custom warningThresholdVnd", () => {
      const result = evaluateDebtPolicy(150_000, 0, {
        warningThresholdVnd: 100_000,
        autoLockAfterOverdueDays: 30,
      });
      expect(result.severity).toBe("critical");
    });

    it("respects custom autoLockAfterOverdueDays", () => {
      const result = evaluateDebtPolicy(50_000, 15, {
        warningThresholdVnd: 1_000_000,
        autoLockAfterOverdueDays: 14,
      });
      expect(result.shouldAutoLockService).toBe(true);
      expect(result.severity).toBe("critical");
    });
  });

  describe("message format", () => {
    it("returns no-debt message for zero debt", () => {
      const result = evaluateDebtPolicy(0, 0);
      expect(result.message).toContain("không có công nợ");
    });

    it("returns critical message for critical severity", () => {
      const result = evaluateDebtPolicy(1_000_000, 10);
      expect(result.message).toContain("nghiêm trọng");
    });

    it("returns warning message for warning severity", () => {
      const result = evaluateDebtPolicy(100_000, 2);
      expect(result.message).toContain("cảnh báo");
    });
  });

  describe("edge cases", () => {
    it("handles very large debt amounts", () => {
      const result = evaluateDebtPolicy(999_999_999_999, 365);
      expect(result.severity).toBe("critical");
      expect(result.shouldAutoLockService).toBe(true);
    });

    it("handles zero overdue days with high debt", () => {
      const result = evaluateDebtPolicy(500_000, 0);
      expect(result.severity).toBe("critical");
      expect(result.shouldAutoLockService).toBe(false);
    });

    it("handles debt of exactly 1 VND", () => {
      const result = evaluateDebtPolicy(1, 0);
      expect(result.severity).toBe("warning");
      expect(result.reminderRequired).toBe(true);
    });
  });
});
