import { NextRequest, NextResponse } from "next/server";
import { getOrdersForExport } from "@/lib/supabase/repositories/orders.repo";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { buildFinancialSummary } from "@/lib/domain/financial";
import { getFormattingPreferences, normalizeSystemSettings } from "@/lib/settings/system-settings";
import { formatDateShort, formatNumber } from "@/lib/utils/formatters";
import { createTenantQuery } from "@/lib/supabase/tenant-client";

export const dynamic = "force-dynamic";

type OrderExportRow = Awaited<ReturnType<typeof getOrdersForExport>>[number] & {
  customer?: { full_name?: string } | { full_name?: string }[] | null;
  product?: { name?: string } | { name?: string }[] | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Nháp",
  pending_payment: "Chờ thanh toán",
  paid: "Đã thanh toán",
  provisioning: "Đang cấp phát",
  active: "Đang hoạt động",
  expired: "Hết hạn",
  refunded: "Hoàn tiền",
};

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const customerId = searchParams.get("customer_id") || undefined;
    const date_from = searchParams.get("date_from") || undefined;
    const date_to = searchParams.get("date_to") || undefined;

    const settingsQuery = createTenantQuery(accountId).from("system_settings").select("*");

    const [rows, settingsResult] = await Promise.all([
      getOrdersForExport(accountId, {
        search,
        status,
        customerId,
        date_from,
        date_to,
      }),
      settingsQuery.limit(1),
    ]);

    const firstSettingsRow = Array.isArray(settingsResult.data) ? settingsResult.data[0] : undefined;
    const settings = normalizeSystemSettings(
      firstSettingsRow && typeof firstSettingsRow === "object"
        ? (firstSettingsRow as Record<string, unknown>)
        : null
    );
    const formatting = getFormattingPreferences(settings);

    const headers = [
      "Mã đơn",
      "Khách hàng",
      "Sản phẩm",
      "Số lượng",
      `Tổng tiền (${formatting.currency})`,
      `Giá vốn (${formatting.currency})`,
      `Đã thanh toán (${formatting.currency})`,
      `Còn phải thu (${formatting.currency})`,
      "Trạng thái đơn",
      "Điều khoản thanh toán",
      "Trạng thái thanh toán",
      "Ngày tạo",
      "Ngày hết hạn",
    ];

    const csvRows = [headers.join(",")];

    for (const row of rows as OrderExportRow[]) {
      const rawCustomer = row.customer as unknown;
      const customerObj = Array.isArray(rawCustomer) ? rawCustomer[0] : rawCustomer;
      const customerName = (customerObj as { full_name?: string } | null)?.full_name ?? "";
      const rawProduct = row.product as unknown;
      const productObj = Array.isArray(rawProduct) ? rawProduct[0] : rawProduct;
      const productName =
        row.product_name_snapshot ||
        (productObj as { name?: string } | null)?.name ||
        "";
      const totalAmount = Number(row.total_amount_vnd) || 0;
      const totalCost = Number(row.total_cost_vnd) || 0;
      const totalPaid = Number(row.total_paid) || 0;
      const financialSummary = buildFinancialSummary(row);

      csvRows.push(
        [
          escapeCSV(row.order_code || row.id),
          escapeCSV(customerName),
          escapeCSV(productName),
          String(row.quantity || 1),
          formatNumber(totalAmount, formatting),
          formatNumber(totalCost, formatting),
          formatNumber(totalPaid, formatting),
          formatNumber(financialSummary.balance_due_vnd, formatting),
          STATUS_LABELS[row.status ?? ""] || row.status || "",
          financialSummary.payment_terms || "",
          financialSummary.payment_state,
          formatDateShort(row.created_at, formatting),
          formatDateShort(row.expires_at, formatting),
        ].join(",")
      );
    }

    const bom = "\uFEFF";
    const csvContent = bom + csvRows.join("\n");
    const timestamp = new Date().toISOString().split("T")[0];

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orders_export_${timestamp}.csv"`,
      },
    });
  })
);
