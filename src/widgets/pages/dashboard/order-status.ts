import type { CSSProperties } from "react";

export type OrderDisplayStatus = {
  label: string;
  style: CSSProperties;
  dotStyle: CSSProperties;
  dotPulse: boolean;
};

export function getOrderDisplayStatus(status: string): OrderDisplayStatus {
  switch (status) {
    case "paid":
      return { label: "Thành công", style: { background: "#d1fae5", color: "#065f46" }, dotStyle: { background: "#10b981" }, dotPulse: false };
    case "active":
      return { label: "Hoạt động", style: { background: "#dbeafe", color: "#1e40af" }, dotStyle: { background: "#3b82f6" }, dotPulse: true };
    case "provisioning":
      return { label: "Đang xử lý", style: { background: "#ede9fe", color: "#5b21b6" }, dotStyle: { background: "#8b5cf6" }, dotPulse: true };
    case "pending_payment":
      return { label: "Chờ thanh toán", style: { background: "#fef3c7", color: "#92400e" }, dotStyle: { background: "#f59e0b" }, dotPulse: true };
    case "draft":
      return { label: "Nháp", style: { background: "#f1f5f9", color: "#475569" }, dotStyle: { background: "#94a3b8" }, dotPulse: false };
    case "expired":
      return { label: "Hết hạn", style: { background: "#ffe4e6", color: "#9f1239" }, dotStyle: { background: "#f43f5e" }, dotPulse: false };
    case "refunded":
      return { label: "Hoàn tiền", style: { background: "#fce7f3", color: "#9d174d" }, dotStyle: { background: "#ec4899" }, dotPulse: false };
    default:
      return {
        label: status === "cancelled" ? "Đã hủy" : status,
        style: { background: "#f3f4f6", color: "#6b7280" },
        dotStyle: { background: "#9ca3af" },
        dotPulse: false,
      };
  }
}
