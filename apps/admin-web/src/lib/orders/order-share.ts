import { formatMoney } from "@/lib/utils";

export interface OrderSuccessBillingDetails {
  companyName?: string | null;
  taxId?: string | null;
  companyAddress?: string | null;
  email?: string | null;
}

export interface OrderSuccessItemSnapshot {
  name: string;
  quantity: number;
  unitPriceVnd: number;
  lineTotalVnd: number;
  durationLabel?: string | null;
}

export interface OrderSuccessSnapshot {
  orderId: string;
  orderCode: string;
  invoiceNumber: string;
  customerName?: string | null;
  customerContact?: string | null;
  paymentMethodLabel: string;
  paymentSourceName?: string | null;
  salesChannelName?: string | null;
  totalVnd: number;
  registeredAt?: string | null;
  expiresAt?: string | null;
  paymentInstructionText?: string | null;
  paymentNote?: string | null;
  items: OrderSuccessItemSnapshot[];
  billingDetails?: OrderSuccessBillingDetails | null;
  warning?: string | null;
  createdAt?: string | null;
}

function formatDateValue(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatItemLine(item: OrderSuccessItemSnapshot, index: number): string {
  const headline = `${index + 1}. ${item.name} x${item.quantity} - ${formatMoney(item.lineTotalVnd)}`;
  return item.durationLabel ? `${headline} (${item.durationLabel})` : headline;
}

function formatCustomerItemSummary(snapshot: OrderSuccessSnapshot): string {
  const summaries = snapshot.items.map((item) => `${item.name} x${item.quantity}`);
  if (summaries.length <= 3) {
    return summaries.join(", ");
  }

  const head = summaries.slice(0, 3).join(", ");
  return `${head} +${summaries.length - 3} sản phẩm khác`;
}

export function buildOrderCustomerSuccessMessage(snapshot: OrderSuccessSnapshot): string {
  const paymentText =
    snapshot.paymentInstructionText?.trim() ||
    (snapshot.paymentNote?.trim() ? `Nội dung chuyển khoản: ${snapshot.paymentNote.trim()}` : null);
  const itemSummary = formatCustomerItemSummary(snapshot);

  const lines = [
    snapshot.customerName ? `Chào ${snapshot.customerName},` : "Chào bạn,",
    `Đơn hàng #${snapshot.orderCode} đã được tạo thành công.`,
    `Tổng tiền: ${formatMoney(snapshot.totalVnd)}`,
    `Thanh toán: ${snapshot.paymentMethodLabel}`,
    itemSummary ? `Sản phẩm: ${itemSummary}` : null,
    snapshot.customerContact ? `Liên hệ: ${snapshot.customerContact}` : null,
    "",
    paymentText ? "" : null,
    paymentText ? paymentText : null,
    "",
    "Cảm ơn bạn đã tin tưởng. Nếu cần hỗ trợ, bạn cứ nhắn lại tin này nhé.",
  ].filter((line): line is string => line !== null && line !== undefined);

  return lines.join("\n");
}

export function buildOrderInvoiceSummaryMessage(snapshot: OrderSuccessSnapshot): string {
  const billing = snapshot.billingDetails;
  const lines = [
    "🧾 TÓM TẮT HOÁ ĐƠN",
    "━━━━━━━━━━━━━━━━━━",
    `Số hoá đơn: ${snapshot.invoiceNumber}`,
    `Mã đơn: #${snapshot.orderCode}`,
    snapshot.customerName ? `Khách hàng: ${snapshot.customerName}` : null,
    snapshot.customerContact ? `Liên hệ: ${snapshot.customerContact}` : null,
    billing?.companyName ? `Đơn vị xuất HĐ: ${billing.companyName}` : null,
    billing?.taxId ? `MST: ${billing.taxId}` : null,
    billing?.companyAddress ? `Địa chỉ: ${billing.companyAddress}` : null,
    billing?.email ? `Email nhận HĐ: ${billing.email}` : null,
    `Tổng cộng: ${formatMoney(snapshot.totalVnd)}`,
    snapshot.paymentMethodLabel ? `Thanh toán: ${snapshot.paymentMethodLabel}` : null,
    snapshot.paymentSourceName ? `Nguồn thanh toán: ${snapshot.paymentSourceName}` : null,
    snapshot.salesChannelName ? `Kênh bán: ${snapshot.salesChannelName}` : null,
    snapshot.registeredAt ? `Ngày bắt đầu: ${formatDateValue(snapshot.registeredAt)}` : null,
    snapshot.expiresAt ? `Ngày hết hạn: ${formatDateValue(snapshot.expiresAt)}` : null,
    "",
    "Chi tiết sản phẩm:",
    ...snapshot.items.map((item, index) => formatItemLine(item, index)),
    snapshot.warning ? "" : null,
    snapshot.warning ? `Ghi chú hệ thống: ${snapshot.warning}` : null,
  ].filter((line): line is string => line !== null && line !== undefined);

  return lines.join("\n");
}
