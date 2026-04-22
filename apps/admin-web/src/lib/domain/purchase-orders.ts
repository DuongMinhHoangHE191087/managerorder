import type { PurchaseOrderStatus } from "@/lib/domain/types";
import { ValidationError } from "@/lib/utils/errors";

export interface PurchaseOrderInvariantInput {
  total_amount_vnd: number;
  total_paid_vnd: number;
  requested_status?: string | null;
  received_at?: string | null;
}

export function resolvePurchaseOrderStatus(input: PurchaseOrderInvariantInput): PurchaseOrderStatus {
  const totalAmount = Number(input.total_amount_vnd ?? 0);
  const totalPaid = Number(input.total_paid_vnd ?? 0);
  const requestedStatus = input.requested_status?.trim().toLowerCase();
  const receivedAt = input.received_at?.trim() || null;

  if (totalAmount < 0) {
    throw new ValidationError("total_amount_vnd không được âm");
  }

  if (totalPaid < 0) {
    throw new ValidationError("total_paid_vnd không được âm");
  }

  if (totalPaid > totalAmount) {
    throw new ValidationError("total_paid_vnd không được vượt total_amount_vnd");
  }

  if (requestedStatus === "cancelled") {
    return "cancelled";
  }

  if (requestedStatus === "received" || receivedAt) {
    if (!receivedAt) {
      throw new ValidationError("received_at là bắt buộc khi đánh dấu đã nhận hàng");
    }
    if (totalPaid < totalAmount) {
      throw new ValidationError("Không thể đánh dấu received khi chưa đối soát thanh toán đủ");
    }
    return "received";
  }

  if (totalPaid <= 0) {
    return "pending";
  }

  return "partial";
}

export function assertPurchaseOrderDeletable(input: {
  total_paid_vnd?: number | null;
  status?: string | null;
}) {
  if (Number(input.total_paid_vnd ?? 0) > 0) {
    throw new ValidationError("Không thể xóa phiếu nhập đã có thanh toán. Hãy chuyển sang cancelled.");
  }

  if ((input.status ?? "").toLowerCase() === "received") {
    throw new ValidationError("Không thể xóa phiếu nhập đã received. Hãy giữ lịch sử và dùng cancelled nếu cần.");
  }
}
