import type { DebtPolicyResult } from "@/lib/domain/types";

export interface DebtPolicyConfig {
  autoLockAfterOverdueDays: number;
  warningThresholdVnd: number;
}

export const DEFAULT_DEBT_POLICY: DebtPolicyConfig = {
  autoLockAfterOverdueDays: 7,
  warningThresholdVnd: 500000,
};

export function evaluateDebtPolicy(
  debtAmountVnd: number,
  overdueDays: number,
  config: DebtPolicyConfig = DEFAULT_DEBT_POLICY,
): DebtPolicyResult {
  if (debtAmountVnd <= 0) {
    return {
      allowCreateOrder: true,
      severity: "none",
      shouldAutoLockService: false,
      reminderRequired: false,
      message: "Khách hàng không có công nợ.",
    };
  }

  const shouldAutoLockService = overdueDays >= config.autoLockAfterOverdueDays;
  const isCritical =
    shouldAutoLockService || debtAmountVnd >= config.warningThresholdVnd;

  return {
    allowCreateOrder: true,
    severity: isCritical ? "critical" : "warning",
    shouldAutoLockService,
    reminderRequired: true,
    message: isCritical
      ? "Khách hàng đang có công nợ nghiêm trọng, cần xử lý ngay."
      : "Khách hàng có công nợ, tiếp tục tạo đơn kèm cảnh báo.",
  };
}
