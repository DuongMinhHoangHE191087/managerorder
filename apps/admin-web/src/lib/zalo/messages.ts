import type { ZaloCapabilities, ZaloMode, ZaloOrderRecord, ZaloProductRecord, ZaloRuntimeConfig } from "./types";
import { formatDateVn, formatVnd } from "@/lib/utils/telegram";
import { formatDateLabel } from "@/lib/utils";

function formatDuration(durationType?: string | null, durationValue?: number | null): string {
  if (!durationType || !durationValue) return "";
  const unit = durationType === "days" ? "ngày" : durationType === "months" ? "tháng" : "năm";
  return `${durationValue} ${unit}`;
}

function formatModeLabel(mode: ZaloMode): string {
  return mode === "human-handoff" ? "human-handoff" : "sales-ai";
}

function formatStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "nháp",
    pending_payment: "chờ thanh toán",
    paid: "đã thanh toán",
    provisioning: "đang xử lý",
    active: "đang chạy",
    expired: "hết hạn",
    refunded: "đã hoàn tiền",
  };
  return map[status] ?? status;
}

function formatCapabilityList(capabilities: ZaloCapabilities): string {
  const items: string[] = [];
  if (capabilities.ai) items.push(capabilities.gemini ? "AI (Gemini)" : "AI (fallback)");
  if (capabilities.catalog) items.push("catalog");
  if (capabilities.orderLookup) items.push("tra cứu đơn");
  if (capabilities.orderCreation) items.push("tạo đơn hàng");
  if (capabilities.humanHandoff) items.push("human-handoff");
  if (capabilities.adminNotify) items.push("admin notify");
  if (capabilities.gemini && !items.includes("AI (Gemini)")) items.push("Gemini");
  return items.join(", ");
}

function formatProductLine(product: ZaloProductRecord, index: number): string {
  const duration = formatDuration(product.durationType, product.durationValue);
  const price = formatVnd(product.sellPriceVnd ?? 0);
  const buy = product.buyPriceVnd ? ` | vốn ${formatVnd(product.buyPriceVnd)}` : "";
  const durationPart = duration ? ` | ${duration}` : "";
  const mode = product.mode ? ` | ${product.mode}` : "";
  return `${index + 1}. ${product.name} - ${price}${buy}${durationPart}${mode}`;
}

export function formatZaloHelpMessage(config: ZaloRuntimeConfig): string {
  const lines = [
    "📚 Lệnh Zalo Bot",
    "",
    "/start - chào mừng và xem nhanh danh mục",
    "/help - danh sách lệnh",
    "/product - xem sản phẩm",
    "/sanpham - alias của /product",
    "/tracuu <mã đơn|SĐT> - tra cứu đơn",
    "/neworder - tạo đơn hàng mới",
    "/cancel - hủy đơn nháp đang mở",
    "/id - xem id và trạng thái bot",
    "/human hoặc /nhanvien - chuyển nhân viên",
    "/ai - quay lại sales-ai",
    "",
    `Trạng thái: ${config.accountBound ? "đã bind account" : "chưa bind account"}`,
    !config.capabilities.orderCreation
      ? "Lưu ý: /neworder cần ZALO_BOT_ACCOUNT_ID riêng, Zalo không dùng TELEGRAM_BOT_ACCOUNT_ID nữa."
      : "",
  ];
  return lines.join("\n");
}

export function formatZaloWelcomeMessage(config: ZaloRuntimeConfig, products: ZaloProductRecord[]): string {
  const lines = [
    `Xin chào! Mình là trợ lý bán hàng của ${config.appName}.`,
    "",
    "Mình có thể hỗ trợ:",
    "• Tư vấn sản phẩm",
    "• Tra cứu đơn",
    ...(config.capabilities.orderCreation ? ["• Tạo đơn hàng"] : []),
    "• Chuyển sang nhân viên khi cần",
    "",
    `Gõ /help để xem lệnh. Trạng thái: ${config.accountBound ? "đã sẵn sàng dữ liệu" : "chưa bind account"}.`,
  ];

  if (products.length > 0) {
    lines.push("", "Một số sản phẩm đang mở bán:");
    for (const [index, product] of products.slice(0, 3).entries()) {
      lines.push(formatProductLine(product, index));
    }
  }

  return lines.join("\n");
}

export function formatZaloFeatureUnavailableMessage(feature: string, reason?: string): string {
  const lines = [`⚠️ Tính năng ${feature} chưa sẵn sàng.`];
  if (reason) lines.push(reason);
  return lines.join("\n");
}

export function formatZaloHumanAck(config: ZaloRuntimeConfig): string {
  const lines = [
    "👤 Đã chuyển sang chế độ nhân viên.",
    "Tin nhắn tiếp theo sẽ được chuyển cho admin.",
  ];
  if (!config.capabilities.adminNotify) {
    lines.push("Lưu ý: chưa cấu hình ADMIN_ZALO_USER_IDS nên chưa thể forward tin nhắn.");
  }
  return lines.join("\n");
}

export function formatZaloAiAck(): string {
  return [
    "🤖 Đã quay lại chế độ sales-ai.",
    "Bạn có thể hỏi về sản phẩm, giá, hoặc nhắn /product để xem danh mục.",
  ].join("\n");
}

export function formatZaloProductCatalog(products: ZaloProductRecord[], query?: string): string {
  if (products.length === 0) {
    return query
      ? `Không tìm thấy sản phẩm phù hợp với "${query}".\nNhắn /product để xem danh mục đầy đủ hoặc /human để gặp nhân viên.`
      : "Hiện chưa có sản phẩm nào đang mở bán.\nBạn có thể nhắn /human để gặp nhân viên.";
  }

  const lines = [query ? `Kết quả cho "${query}":` : "Danh mục sản phẩm đang mở bán:", ""];
  for (const [index, product] of products.slice(0, 5).entries()) {
    lines.push(formatProductLine(product, index));
  }
  lines.push("", "Nếu cần tư vấn nhanh hơn, nhắn thêm nhu cầu hoặc /human để gặp nhân viên.");
  return lines.join("\n");
}

export function formatZaloOrderLookup(query: string, orders: ZaloOrderRecord[]): string {
  if (orders.length === 0) {
    return `Không tìm thấy đơn khớp với "${query}".\nKiểm tra lại mã đơn / số điện thoại rồi thử /tracuu <mã đơn|SĐT> nhé.`;
  }

  const lines = [`Kết quả tra cứu cho "${query}":`, ""];

  for (const [index, order] of orders.slice(0, 5).entries()) {
    const due = Math.max((order.totalAmountVnd || 0) - (order.totalPaid || 0), 0);
    const customerName = order.customerName || "N/A";
    lines.push(
      `${index + 1}. ${order.orderCode ?? order.id}`,
      `   • Khách: ${customerName}`,
      `   • Sản phẩm: ${order.productNameSnapshot ?? "N/A"}`,
      `   • Trạng thái: ${formatStatusLabel(order.status)}`,
      `   • Tổng: ${formatVnd(order.totalAmountVnd)} | Đã thu: ${formatVnd(order.totalPaid)} | Còn: ${formatVnd(due)}`,
      `   • Hết hạn: ${formatDateVn(order.expiresAt)}`,
    );
  }

  return lines.join("\n");
}

export function formatZaloIdStatus(input: {
  userId: string;
  chatId: string;
  accountId: string;
  mode: ZaloMode;
  capabilities: ZaloCapabilities;
  adminCount: number;
  displayName?: string;
}): string {
  const lines = [
    "🔎 Thông tin bot Zalo",
    `• Zalo user id: ${input.userId}`,
    `• Chat id: ${input.chatId}`,
    `• Account id: ${input.accountId || "chưa cấu hình"}`,
    `• Mode: ${formatModeLabel(input.mode)}`,
    `• Admin IDs: ${input.adminCount}`,
    `• Capabilities: ${formatCapabilityList(input.capabilities) || "N/A"}`,
  ];
  if (input.displayName) {
    lines.splice(2, 0, `• Display name: ${input.displayName}`);
  }
  return lines.join("\n");
}

export function formatZaloStartupNotification(input: {
  botName: string;
  botUserId?: string;
  accountId: string;
  capabilities: ZaloCapabilities;
  adminCount: number;
  startedAt: Date;
}): string {
  const lines = [
    "✅ bot đã chạy thành công - Zalo",
    `• Bot: ${input.botName}`,
    `• Bot user id: ${input.botUserId ?? "N/A"}`,
    `• Account id: ${input.accountId || "chưa cấu hình"}`,
    `• Mode mặc định: sales-ai`,
    `• Admin IDs: ${input.adminCount}`,
    `• Capabilities: ${formatCapabilityList(input.capabilities) || "N/A"}`,
    `• Started at: ${formatDateLabel(input.startedAt)}`,
  ];
  return lines.join("\n");
}

export function formatZaloAdminForward(input: {
  userId: string;
  chatId: string;
  displayName?: string;
  text: string;
  mode: ZaloMode;
}): string {
  const lines = [
    "📨 Tin nhắn Zalo cần hỗ trợ",
    `• User id: ${input.userId}`,
    `• Chat id: ${input.chatId}`,
    `• Mode: ${formatModeLabel(input.mode)}`,
  ];
  if (input.displayName) lines.push(`• Name: ${input.displayName}`);
  lines.push("", input.text);
  return lines.join("\n");
}

export { formatVnd, formatDateVn, formatModeLabel, formatStatusLabel, formatCapabilityList };
