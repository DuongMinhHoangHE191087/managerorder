import type { CustomerStatsDashboardModel } from "./customer-stats-dashboard";

function csvEscape(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

function csvRow(values: Array<string | number | null | undefined>): string {
  return values.map(csvEscape).join(",");
}

export function buildCustomerDebtSummaryCsv(model: CustomerStatsDashboardModel): string {
  const lines: string[] = [];

  lines.push(csvRow(["section", "label", "value", "value_2", "value_3"]));
  lines.push(csvRow(["summary", "totalDebtVnd", model.totalDebt]));
  lines.push(csvRow(["summary", "customersWithDebt", model.customersWithDebt]));
  lines.push(csvRow(["summary", "overdueCount", model.overdueCount]));
  lines.push(csvRow(["summary", "avgDebt", model.avgDebt]));
  lines.push(csvRow(["summary", "avgReliabilityScore", model.avgReliabilityScore]));
  lines.push("");

  lines.push(csvRow(["section", "bucket", "amount", "percent"]));
  for (const bucket of model.agingBuckets) {
    lines.push(csvRow(["aging", bucket.label, bucket.amount, `${bucket.percent.toFixed(0)}%`]));
  }
  lines.push("");

  lines.push(csvRow(["section", "rank", "name", "debtAmountVnd", "overdueDays", "segment"]));
  model.topDebtors.forEach((debtor, index) => {
    lines.push(csvRow([
      "top_debtor",
      index + 1,
      debtor.name,
      debtor.debtAmountVnd,
      debtor.overdueDays,
      debtor.segment ?? "",
    ]));
  });
  lines.push("");

  lines.push(csvRow(["section", "segment", "count", "totalDebt", "share"]));
  model.segmentBreakdown.forEach((segment) => {
    lines.push(csvRow([
      "segment",
      segment.segment,
      segment.count,
      segment.totalDebt,
      `${segment.share}%`,
    ]));
  });

  return lines.join("\r\n");
}
