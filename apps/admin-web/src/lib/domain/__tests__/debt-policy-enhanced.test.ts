import { describe, it, expect } from 'vitest';
import { evaluateDebtPolicy, DEFAULT_DEBT_POLICY } from '../debt-policy';
import type { DebtPolicyConfig } from '../debt-policy';

describe('evaluateDebtPolicy', () => {
  // ── No Debt ─────────────────────────────────────────────────
  describe('no debt (debtAmount <= 0)', () => {
    it('returns allowCreateOrder true and severity "none" for zero', () => {
      const result = evaluateDebtPolicy(0, 0);
      expect(result.allowCreateOrder).toBe(true);
      expect(result.severity).toBe('none');
      expect(result.shouldAutoLockService).toBe(false);
      expect(result.reminderRequired).toBe(false);
    });

    it('handles negative debt amount', () => {
      const result = evaluateDebtPolicy(-100000, 5);
      expect(result.severity).toBe('none');
      expect(result.shouldAutoLockService).toBe(false);
    });

    it('includes Vietnamese message', () => {
      const result = evaluateDebtPolicy(0, 0);
      expect(result.message).toContain('không có công nợ');
    });
  });

  // ── Warning (has debt, not critical) ────────────────────────
  describe('warning level debt', () => {
    it('returns severity "warning" for small debt within threshold', () => {
      const result = evaluateDebtPolicy(100000, 3);
      expect(result.severity).toBe('warning');
      expect(result.allowCreateOrder).toBe(true);
      expect(result.reminderRequired).toBe(true);
      expect(result.shouldAutoLockService).toBe(false);
    });

    it('returns warning for 499999 VND (below 500k threshold)', () => {
      const result = evaluateDebtPolicy(499999, 6);
      expect(result.severity).toBe('warning');
    });
  });

  // ── Critical (auto-lock or high debt) ───────────────────────
  describe('critical level debt', () => {
    it('returns critical when overdueDays >= autoLockThreshold', () => {
      const result = evaluateDebtPolicy(100000, 7);
      expect(result.severity).toBe('critical');
      expect(result.shouldAutoLockService).toBe(true);
      expect(result.reminderRequired).toBe(true);
    });

    it('returns critical when debt >= warningThreshold', () => {
      const result = evaluateDebtPolicy(500000, 1);
      expect(result.severity).toBe('critical');
      expect(result.shouldAutoLockService).toBe(false); // overdue only 1
    });

    it('returns critical and shouldAutoLock for both conditions', () => {
      const result = evaluateDebtPolicy(1000000, 10);
      expect(result.severity).toBe('critical');
      expect(result.shouldAutoLockService).toBe(true);
    });

    it('includes Vietnamese critical message', () => {
      const result = evaluateDebtPolicy(500000, 7);
      expect(result.message).toContain('nghiêm trọng');
    });
  });

  // ── Custom Config ───────────────────────────────────────────
  describe('custom config', () => {
    it('respects custom autoLockAfterOverdueDays', () => {
      const config: DebtPolicyConfig = { autoLockAfterOverdueDays: 3, warningThresholdVnd: 500000 };
      const result = evaluateDebtPolicy(100000, 3, config);
      expect(result.shouldAutoLockService).toBe(true);
      expect(result.severity).toBe('critical');
    });

    it('respects custom warningThresholdVnd', () => {
      const config: DebtPolicyConfig = { autoLockAfterOverdueDays: 7, warningThresholdVnd: 100000 };
      const result = evaluateDebtPolicy(100000, 1, config);
      expect(result.severity).toBe('critical');
    });

    it('uses default config when not specified', () => {
      expect(DEFAULT_DEBT_POLICY.autoLockAfterOverdueDays).toBe(7);
      expect(DEFAULT_DEBT_POLICY.warningThresholdVnd).toBe(500000);
    });
  });

  // ── Boundary Values ─────────────────────────────────────────
  describe('boundary values', () => {
    it('overdueDays = 6 (just below lock threshold) → warning', () => {
      const result = evaluateDebtPolicy(100000, 6);
      expect(result.shouldAutoLockService).toBe(false);
    });

    it('overdueDays = 7 (exactly at lock threshold) → critical', () => {
      const result = evaluateDebtPolicy(100000, 7);
      expect(result.shouldAutoLockService).toBe(true);
    });

    it('debt = 1 VND → triggers warning', () => {
      const result = evaluateDebtPolicy(1, 0);
      expect(result.severity).toBe('warning');
      expect(result.reminderRequired).toBe(true);
    });
  });
});
