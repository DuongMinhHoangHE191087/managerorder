import type { RefundMode } from "@/lib/domain/types";

interface RefundRequest {
  paidAmountVnd: number;
  consumedDays: number;
  totalDays: number;
  mode: RefundMode;
}

export interface RefundSummary {
  refundableAmountVnd: number;
  consumedRatio: number;
  notes: string;
}

export function calculateRefund(request: RefundRequest): RefundSummary {
  const { paidAmountVnd, consumedDays, totalDays, mode } = request;

  if (mode === "full") {
    return {
      refundableAmountVnd: Math.max(paidAmountVnd, 0),
      consumedRatio: 0,
      notes: "Hoan tien toan bo theo yeu cau full refund.",
    };
  }

  const safeTotalDays = Math.max(totalDays, 1);
  const consumedRatio = Math.min(Math.max(consumedDays / safeTotalDays, 0), 1);
  const refundableAmountVnd = Math.floor(paidAmountVnd * (1 - consumedRatio));

  return {
    refundableAmountVnd: Math.max(refundableAmountVnd, 0),
    consumedRatio,
    notes: "Hoan tien theo ti le phan thoi gian chua su dung.",
  };
}
