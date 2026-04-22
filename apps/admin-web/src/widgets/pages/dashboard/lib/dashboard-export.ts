import { formatDateCustom, formatMoney } from "@/lib/utils";
import type {
  DashboardClvRow,
  DashboardCohortRow,
  DashboardForecastRow,
  DashboardStats,
} from "@/shared/types/dashboard";
import type ExcelJs from "exceljs";

const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export type DashboardExportFormat = "xlsx" | "pdf";

type CellKind = "text" | "currency" | "number";

export type DashboardExportColumn = {
  header: string;
  key: string;
  width: number;
  kind?: CellKind;
};

export type DashboardExportSheet = {
  name: string;
  columns: DashboardExportColumn[];
  rows: Array<Record<string, string | number>>;
};

export type DashboardExportData = {
  fileName: string;
  sheets: DashboardExportSheet[];
};

type DashboardExportOptions = {
  days: number;
  rangeLabel: string;
};

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatQuantity(value: number) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function formatFileDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function makeFileName(days: number, format: DashboardExportFormat = "xlsx") {
  return `dashboard-report-${days}d-${formatFileDate()}.${format}`;
}

function makeSummarySheet(stats: DashboardStats, options: DashboardExportOptions): DashboardExportSheet {
  const totalProfit = stats.totalRevenue - stats.totalCost;
  const profitMargin = stats.totalRevenue > 0 ? (totalProfit / stats.totalRevenue) * 100 : 0;

  return {
    name: "Tổng quan",
    columns: [
      { header: "Chỉ số", key: "metric", width: 30 },
      { header: "Giá trị", key: "value", width: 24 },
    ],
    rows: [
      { metric: "Khoảng thời gian", value: options.rangeLabel || `${options.days} ngày` },
      {
        metric: "Cập nhật",
        value: formatDateCustom(stats.calculatedAt, undefined, {
          dateStyle: "short",
          timeStyle: "short",
        }),
      },
      { metric: "Tổng doanh thu", value: formatMoney(stats.totalRevenue) },
      { metric: "Tổng vốn", value: formatMoney(stats.totalCost) },
      { metric: "Lợi nhuận gộp", value: formatMoney(totalProfit) },
      { metric: "Biên lợi nhuận", value: formatPercent(profitMargin) },
      { metric: "Đã thu", value: formatMoney(stats.totalCollected) },
      { metric: "Tổng nợ", value: formatMoney(stats.totalDebt) },
      { metric: "Đã hoàn tiền", value: formatMoney(stats.totalRefunded) },
      { metric: "Đơn chờ", value: formatQuantity(stats.pendingCount) },
      { metric: "Tài khoản hết hạn", value: formatQuantity(stats.expiringAccounts.length) },
      { metric: "Khách quá hạn", value: formatQuantity(stats.overdueCustomers.length) },
      { metric: "Tỷ lệ lấp đầy", value: formatPercent(stats.fillRate) },
    ],
  };
}

function makeRevenueSheet(stats: DashboardStats): DashboardExportSheet {
  return {
    name: "Doanh thu & vốn",
    columns: [
      { header: "Khoảng thời gian", key: "period", width: 18 },
      { header: "Doanh thu", key: "revenue", width: 16, kind: "currency" },
      { header: "Vốn", key: "cost", width: 16, kind: "currency" },
      { header: "Lợi nhuận", key: "profit", width: 16, kind: "currency" },
      { header: "Đơn hàng", key: "orders", width: 12, kind: "number" },
      { header: "Biên lãi", key: "margin", width: 12 },
    ],
    rows: stats.chartData.map((item) => {
      const profit = item.revenue - item.cost;
      const margin = item.revenue > 0 ? (profit / item.revenue) * 100 : 0;

      return {
        period: item.name,
        revenue: item.revenue,
        cost: item.cost,
        profit,
        orders: item.orders,
        margin: formatPercent(margin),
      };
    }),
  };
}

function makeForecastSheet(rows: DashboardForecastRow[]): DashboardExportSheet {
  return {
    name: "Dự báo doanh thu",
    columns: [
      { header: "Kỳ hạn", key: "horizonLabel", width: 18 },
      { header: "Số ngày", key: "days", width: 10, kind: "number" },
      { header: "Doanh thu dự báo", key: "projectedRevenue", width: 18, kind: "currency" },
      { header: "Độ tin cậy", key: "confidence", width: 12 },
      { header: "Ghi chú", key: "note", width: 40 },
    ],
    rows: rows.map((row) => ({
      horizonLabel: row.horizonLabel,
      days: row.days,
      projectedRevenue: row.projectedRevenue,
      confidence: `${Math.round(row.confidence)}%`,
      note: row.note,
    })),
  };
}

function makeCohortSheet(rows: DashboardCohortRow[]): DashboardExportSheet {
  return {
    name: "Cohort retention",
    columns: [
      { header: "Cohort", key: "cohortLabel", width: 18 },
      { header: "Khách mới", key: "acquiredCustomers", width: 12, kind: "number" },
      { header: "Khách quay lại", key: "returningCustomers", width: 16, kind: "number" },
      { header: "Retention", key: "retentionRate", width: 12 },
      { header: "Churn", key: "churnRate", width: 12 },
      { header: "Doanh thu", key: "revenue", width: 18, kind: "currency" },
    ],
    rows: rows.map((row) => ({
      cohortLabel: row.cohortLabel,
      acquiredCustomers: row.acquiredCustomers,
      returningCustomers: row.returningCustomers,
      retentionRate: `${Math.round(row.retentionRate)}%`,
      churnRate: `${Math.round(row.churnRate)}%`,
      revenue: row.revenue,
    })),
  };
}

function makeClvSheet(rows: DashboardClvRow[]): DashboardExportSheet {
  return {
    name: "CLV khách hàng",
    columns: [
      { header: "Khách hàng", key: "customerName", width: 28 },
      { header: "Doanh thu", key: "totalRevenue", width: 18, kind: "currency" },
      { header: "Lợi nhuận", key: "totalProfit", width: 18, kind: "currency" },
      { header: "Đơn", key: "orderCount", width: 10, kind: "number" },
      { header: "Repeat rate", key: "repeatRate", width: 12 },
      { header: "CLV score", key: "clvScore", width: 16, kind: "currency" },
    ],
    rows: rows.map((row) => ({
      customerName: row.customerName,
      totalRevenue: row.totalRevenue,
      totalProfit: row.totalProfit,
      orderCount: row.orderCount,
      repeatRate: `${Math.round(row.repeatRate)}%`,
      clvScore: row.clvScore,
    })),
  };
}

function makeTopProductsSheet(stats: DashboardStats): DashboardExportSheet {
  const totalRevenue = Math.max(stats.totalRevenue, 1);

  return {
    name: "Top sản phẩm",
    columns: [
      { header: "Sản phẩm", key: "name", width: 28 },
      { header: "Doanh thu", key: "revenue", width: 16, kind: "currency" },
      { header: "Tỷ trọng", key: "share", width: 12 },
      { header: "Đơn", key: "count", width: 10, kind: "number" },
    ],
    rows: stats.topProducts.map((item) => ({
      name: item.name,
      revenue: item.revenue,
      share: formatPercent((item.revenue / totalRevenue) * 100),
      count: item.count,
    })),
  };
}

function makeProductSlotsSheet(stats: DashboardStats): DashboardExportSheet {
  return {
    name: "Kho sản phẩm",
    columns: [
      { header: "Sản phẩm", key: "name", width: 28 },
      { header: "Đã dùng", key: "used", width: 12, kind: "number" },
      { header: "Tối đa", key: "max", width: 12, kind: "number" },
      { header: "Còn trống", key: "available", width: 12, kind: "number" },
      { header: "Tỷ lệ lấp đầy", key: "fillRate", width: 14 },
    ],
    rows: stats.productSlots.map((item) => {
      const available = Math.max(0, item.max - item.used);
      const fillRate = item.max > 0 ? (item.used / item.max) * 100 : 0;

      return {
        name: item.name,
        used: item.used,
        max: item.max,
        available,
        fillRate: formatPercent(fillRate),
      };
    }),
  };
}

function makePendingOrdersSheet(stats: DashboardStats): DashboardExportSheet {
  return {
    name: "Đơn chờ",
    columns: [
      { header: "Mã đơn", key: "id", width: 18 },
      { header: "Mã khách", key: "customerId", width: 18 },
      { header: "Sản phẩm", key: "productId", width: 18 },
      { header: "Tổng tiền", key: "totalAmountVnd", width: 16, kind: "currency" },
      { header: "Còn nợ", key: "balanceDueVnd", width: 16, kind: "currency" },
      { header: "Thanh toán", key: "paymentState", width: 16 },
      { header: "Ngày tạo", key: "createdAt", width: 20 },
    ],
    rows: stats.pendingOrders.map((item) => ({
      id: item.id,
      customerId: item.customerId,
      productId: item.productId,
      totalAmountVnd: item.totalAmountVnd,
      balanceDueVnd: item.balanceDueVnd,
      paymentState: item.paymentState,
      createdAt: formatDateCustom(item.createdAt, undefined, {
        dateStyle: "short",
        timeStyle: "short",
      }),
    })),
  };
}

function makeRecentOrdersSheet(stats: DashboardStats): DashboardExportSheet {
  return {
    name: "Đơn gần đây",
    columns: [
      { header: "Mã đơn", key: "id", width: 18 },
      { header: "Khách hàng", key: "customerName", width: 24 },
      { header: "Sản phẩm", key: "productName", width: 24 },
      { header: "Trạng thái", key: "status", width: 16 },
      { header: "Thanh toán", key: "paymentState", width: 16 },
      { header: "Còn nợ", key: "balanceDueVnd", width: 16, kind: "currency" },
      { header: "Tổng tiền", key: "totalAmountVnd", width: 16, kind: "currency" },
      { header: "Ngày tạo", key: "createdAt", width: 20 },
    ],
    rows: stats.recentOrders.map((item) => ({
      id: item.id,
      customerName: item.customerName,
      productName: item.productName,
      status: item.status,
      paymentState: item.paymentState,
      balanceDueVnd: item.balanceDueVnd,
      totalAmountVnd: item.totalAmountVnd,
      createdAt: formatDateCustom(item.createdAt, undefined, {
        dateStyle: "short",
        timeStyle: "short",
      }),
    })),
  };
}

function makeExpiringAccountsSheet(stats: DashboardStats): DashboardExportSheet {
  return {
    name: "Kho sắp hết hạn",
    columns: [
      { header: "Email", key: "email", width: 28 },
      { header: "Hết hạn", key: "expiresAt", width: 20 },
      { header: "Còn lại", key: "daysLeft", width: 12, kind: "number" },
      { header: "Sản phẩm", key: "productIds", width: 24 },
      { header: "Đã dùng", key: "usedSlots", width: 12, kind: "number" },
      { header: "Tối đa", key: "maxSlots", width: 12, kind: "number" },
    ],
    rows: stats.expiringAccounts.map((item) => ({
      email: item.email ?? item.id,
      expiresAt: formatDateCustom(item.expiresAt, undefined, {
        dateStyle: "short",
        timeStyle: "short",
      }),
      daysLeft: item.daysLeft,
      productIds: item.productIds.join(", "),
      usedSlots: item.usedSlots,
      maxSlots: item.maxSlots,
    })),
  };
}

function makeOverdueCustomersSheet(stats: DashboardStats): DashboardExportSheet {
  return {
    name: "Công nợ quá hạn",
    columns: [
      { header: "Khách hàng", key: "name", width: 28 },
      { header: "Công nợ", key: "debtAmountVnd", width: 16, kind: "currency" },
      { header: "Quá hạn", key: "debtOverdueDays", width: 12, kind: "number" },
    ],
    rows: stats.overdueCustomers.map((item) => ({
      name: item.name,
      debtAmountVnd: item.debtAmountVnd,
      debtOverdueDays: item.debtOverdueDays,
    })),
  };
}

export function buildDashboardExportData(
  stats: DashboardStats,
  options: DashboardExportOptions
): DashboardExportData {
  const sheets: DashboardExportSheet[] = [
    makeSummarySheet(stats, options),
    makeRevenueSheet(stats),
  ];

  if ((stats.revenueForecast?.length ?? 0) > 0) {
    sheets.push(makeForecastSheet(stats.revenueForecast ?? []));
  }

  if ((stats.cohortAnalysis?.length ?? 0) > 0) {
    sheets.push(makeCohortSheet(stats.cohortAnalysis ?? []));
  }

  if ((stats.customerClv?.length ?? 0) > 0) {
    sheets.push(makeClvSheet(stats.customerClv ?? []));
  }

  sheets.push(
    makeTopProductsSheet(stats),
    makeProductSlotsSheet(stats),
    makePendingOrdersSheet(stats),
    makeRecentOrdersSheet(stats),
    makeExpiringAccountsSheet(stats),
    makeOverdueCustomersSheet(stats),
  );

  return {
    fileName: makeFileName(options.days, "xlsx"),
    sheets,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatSheetCellValue(
  value: string | number,
  column: DashboardExportColumn,
) {
  if (typeof value === "number" && column.kind === "currency") {
    return formatMoney(value);
  }

  if (typeof value === "number" && column.kind === "number") {
    return value.toLocaleString("vi-VN");
  }

  return String(value);
}

export function buildDashboardPrintHtml(
  stats: DashboardStats,
  options: DashboardExportOptions,
) {
  const data = buildDashboardExportData(stats, options);
  const fileName = makeFileName(options.days, "pdf");
  const generatedAt = formatDateCustom(new Date().toISOString(), undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const sections = data.sheets.map((sheet) => {
    const headerCells = sheet.columns
      .map((column) => `<th>${escapeHtml(column.header)}</th>`)
      .join("");
    const bodyRows = sheet.rows.length > 0
      ? sheet.rows.map((row) => {
          const cells = sheet.columns
            .map((column) => {
              const rawValue = row[column.key];
              const renderedValue =
                rawValue === undefined || rawValue === null || rawValue === ""
                  ? "—"
                  : formatSheetCellValue(rawValue, column);
              const alignClass = column.kind === "currency" || column.kind === "number"
                ? " class=\"numeric\""
                : "";
              return `<td${alignClass}>${escapeHtml(renderedValue)}</td>`;
            })
            .join("");
          return `<tr>${cells}</tr>`;
        }).join("")
      : `<tr><td colspan="${sheet.columns.length}">Không có dữ liệu trong khoảng này.</td></tr>`;

    return [
      `<section class="sheet">`,
      `<div class="sheet-header">`,
      `<h2>${escapeHtml(sheet.name)}</h2>`,
      `<span>${sheet.rows.length.toLocaleString("vi-VN")} dòng</span>`,
      `</div>`,
      `<table>`,
      `<thead><tr>${headerCells}</tr></thead>`,
      `<tbody>${bodyRows}</tbody>`,
      `</table>`,
      `</section>`,
    ].join("");
  }).join("");

  return [
    "<!DOCTYPE html>",
    "<html lang=\"vi\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    `<title>${escapeHtml(fileName)}</title>`,
    "<style>",
    "body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#f8fafc;color:#0f172a;}",
    ".page{padding:32px;}",
    ".hero{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:24px;padding-bottom:18px;border-bottom:2px solid #e2e8f0;}",
    ".hero h1{margin:0;font-size:28px;line-height:1.1;}",
    ".hero p{margin:6px 0 0;color:#475569;font-size:13px;}",
    ".meta{display:grid;gap:6px;font-size:12px;color:#475569;text-align:right;}",
    ".sheet{margin-bottom:28px;break-inside:avoid;}",
    ".sheet-header{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin-bottom:10px;}",
    ".sheet-header h2{margin:0;font-size:18px;}",
    ".sheet-header span{font-size:12px;color:#475569;}",
    "table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #cbd5e1;}",
    "th,td{padding:8px 10px;border:1px solid #e2e8f0;font-size:12px;vertical-align:top;text-align:left;}",
    "th{background:#0f172a;color:#fff;font-weight:700;}",
    ".numeric{text-align:right;white-space:nowrap;}",
    "@media print{body{background:#fff;}.page{padding:0 0 8mm;} .sheet{page-break-inside:avoid;}}",
    "</style>",
    "</head>",
    "<body>",
    "<main class=\"page\">",
    "<header class=\"hero\">",
    "<div>",
    "<h1>Báo cáo dashboard ManagerOrder</h1>",
    `<p>Khoảng thời gian: ${escapeHtml(options.rangeLabel || `${options.days} ngày`)}</p>`,
    "</div>",
    "<div class=\"meta\">",
    `<span>Tệp: ${escapeHtml(fileName)}</span>`,
    `<span>Xuất lúc: ${escapeHtml(generatedAt)}</span>`,
    `<span>Cập nhật dữ liệu: ${escapeHtml(formatDateCustom(stats.calculatedAt, undefined, { dateStyle: "medium", timeStyle: "short" }))}</span>`,
    "</div>",
    "</header>",
    sections,
    "</main>",
    "<script>",
    "window.addEventListener('load',()=>{setTimeout(()=>window.print(),150);});",
    "window.addEventListener('afterprint',()=>{window.close();});",
    "</script>",
    "</body>",
    "</html>",
  ].join("");
}

function openDashboardPrintPreview(fileName: string, html: string) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    throw new Error("Trình duyệt đã chặn cửa sổ in PDF. Hãy cho phép popup rồi thử lại.");
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return fileName;
}

async function loadExcelJs() {
  const excelModule = await import("exceljs");
  return (excelModule.default ?? excelModule) as typeof ExcelJs;
}

function applySheetStyles(sheet: ExcelJs.Worksheet, columns: DashboardExportColumn[]) {
  const headerRow = sheet.getRow(1);
  headerRow.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 22;
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  columns.forEach((column, index) => {
    if (column.kind !== "currency" && column.kind !== "number") {
      return;
    }

    const excelColumnIndex = index + 1;
    for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
      const cell = sheet.getRow(rowIndex).getCell(excelColumnIndex);
      if (cell.value === undefined || cell.value === null || cell.value === "") {
        continue;
      }

      cell.numFmt = "#,##0";
      cell.alignment = { horizontal: "right" };
    }
  });
}

function addSheet(workbook: ExcelJs.Workbook, sheet: DashboardExportSheet) {
  const worksheet = workbook.addWorksheet(sheet.name);
  worksheet.columns = sheet.columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));
  worksheet.addRows(sheet.rows);
  applySheetStyles(worksheet, sheet.columns);
  return worksheet;
}

export async function downloadDashboardReport(
  stats: DashboardStats,
  options: DashboardExportOptions,
  format: DashboardExportFormat = "xlsx",
) {
  if (format === "pdf") {
    const fileName = makeFileName(options.days, "pdf");
    return openDashboardPrintPreview(fileName, buildDashboardPrintHtml(stats, options));
  }

  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ManagerOrder";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = `Dashboard export ${options.rangeLabel}`;
  workbook.title = "Dashboard report";
  workbook.company = "ManagerOrder";

  const data = buildDashboardExportData(stats, options);
  for (const sheet of data.sheets) {
    addSheet(workbook, sheet);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = data.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1_000);

  return data.fileName;
}
