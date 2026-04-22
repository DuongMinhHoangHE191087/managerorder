import type { Customer } from "@/lib/domain/types";
import type { DebtSummary } from "@/widgets/pages/customers/hooks/use-customers";

export interface DashboardStatBar {
  label: string;
  value: number;
  color: string;
  percent: number;
}

export interface DashboardDebtBucket {
  key: keyof DebtSummary["aging"];
  label: string;
  amount: number;
  percent: number;
  color: string;
}

export interface DashboardSegmentDebtRow {
  segment: string;
  count: number;
  totalDebt: number;
  share: number;
}

export interface CustomerStatsDashboardModel {
  typeBars: DashboardStatBar[];
  totalDebt: number;
  customersWithDebt: number;
  overdueCount: number;
  avgDebt: number;
  avgReliabilityScore: number;
  topDebtors: DebtSummary["topDebtors"];
  agingBuckets: DashboardDebtBucket[];
  segmentBreakdown: DashboardSegmentDebtRow[];
}

const TYPE_BAR_COLORS = {
  retail: "#6366f1",
  wholesale: "#f59e0b",
  agency: "#10b981",
} as const;

const AGING_BUCKET_META: Array<{
  key: keyof DebtSummary["aging"];
  label: string;
  color: string;
}> = [
  { key: "current", label: "Chưa quá hạn", color: "#0f766e" },
  { key: "days_1_30", label: "1-30 ngày", color: "#2563eb" },
  { key: "days_31_60", label: "31-60 ngày", color: "#d97706" },
  { key: "days_61_90", label: "61-90 ngày", color: "#dc2626" },
  { key: "days_90_plus", label: "90+ ngày", color: "#7c3aed" },
];

const SEGMENT_LABELS: Record<string, string> = {
  vip: "VIP",
  loyal: "Trung thành",
  regular: "Thường xuyên",
  at_risk: "Có rủi ro",
  churned: "Sắp rời bỏ",
};

function roundPercent(value: number) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function buildFallbackDebtSummary(customers: Customer[]): DebtSummary {
  const customersWithDebt = customers.filter((customer) => customer.debtAmountVnd > 0);
  const totalDebtVnd = customers.reduce((sum, customer) => sum + customer.debtAmountVnd, 0);

  const aging: DebtSummary["aging"] = {
    current: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_90_plus: 0,
  };

  for (const customer of customersWithDebt) {
    if (customer.debtOverdueDays <= 0) aging.current += customer.debtAmountVnd;
    else if (customer.debtOverdueDays <= 30) aging.days_1_30 += customer.debtAmountVnd;
    else if (customer.debtOverdueDays <= 60) aging.days_31_60 += customer.debtAmountVnd;
    else if (customer.debtOverdueDays <= 90) aging.days_61_90 += customer.debtAmountVnd;
    else aging.days_90_plus += customer.debtAmountVnd;
  }

  const segmentBreakdown = customers.reduce<Record<string, { count: number; totalDebt: number }>>((acc, customer) => {
    const segment = customer.segment || "regular";
    if (!acc[segment]) {
      acc[segment] = { count: 0, totalDebt: 0 };
    }
    acc[segment].count += 1;
    acc[segment].totalDebt += customer.debtAmountVnd;
    return acc;
  }, {});

  return {
    totalDebtVnd,
    totalCustomers: customers.length,
    customersWithDebt: customersWithDebt.length,
    overdueCustomers: customers.filter((customer) => customer.debtOverdueDays > 0).length,
    avgReliabilityScore: 100,
    aging,
    topDebtors: [...customersWithDebt]
      .sort((left, right) => right.debtAmountVnd - left.debtAmountVnd)
      .slice(0, 10)
      .map((customer) => ({
        id: customer.id,
        name: customer.name,
        debtAmountVnd: customer.debtAmountVnd,
        overdueDays: customer.debtOverdueDays,
        segment: customer.segment || "regular",
      })),
    segmentBreakdown,
  };
}

export function formatSegmentLabel(segment: string) {
  return SEGMENT_LABELS[segment] ?? segment.replaceAll("_", " ");
}

export function buildCustomerStatsDashboardModel(input: {
  customers: Customer[];
  debtSummary?: DebtSummary | null;
}): CustomerStatsDashboardModel {
  const { customers, debtSummary } = input;
  const summary = debtSummary ?? buildFallbackDebtSummary(customers);
  const totalCustomers = customers.length;

  const countsByType = {
    retail: customers.filter((customer) => customer.customerType === "retail").length,
    wholesale: customers.filter((customer) => customer.customerType === "wholesale").length,
    agency: customers.filter((customer) => customer.customerType === "agency").length,
  };

  const typeBars: DashboardStatBar[] = [
    {
      label: "Khách lẻ",
      value: countsByType.retail,
      color: TYPE_BAR_COLORS.retail,
      percent: totalCustomers > 0 ? (countsByType.retail / totalCustomers) * 100 : 0,
    },
    {
      label: "Sỉ",
      value: countsByType.wholesale,
      color: TYPE_BAR_COLORS.wholesale,
      percent: totalCustomers > 0 ? (countsByType.wholesale / totalCustomers) * 100 : 0,
    },
    {
      label: "Đại lý",
      value: countsByType.agency,
      color: TYPE_BAR_COLORS.agency,
      percent: totalCustomers > 0 ? (countsByType.agency / totalCustomers) * 100 : 0,
    },
  ];

  const agingBuckets = AGING_BUCKET_META.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    amount: summary.aging[bucket.key],
    percent: summary.totalDebtVnd > 0 ? (summary.aging[bucket.key] / summary.totalDebtVnd) * 100 : 0,
    color: bucket.color,
  }));

  const segmentBreakdown = Object.entries(summary.segmentBreakdown)
    .sort((left, right) => right[1].totalDebt - left[1].totalDebt)
    .map(([segment, row]) => ({
      segment: formatSegmentLabel(segment),
      count: row.count,
      totalDebt: row.totalDebt,
      share: summary.totalDebtVnd > 0 ? roundPercent((row.totalDebt / summary.totalDebtVnd) * 100) : 0,
    }));

  const avgDebt = summary.customersWithDebt > 0
    ? Math.round(summary.totalDebtVnd / summary.customersWithDebt)
    : 0;

  return {
    typeBars,
    totalDebt: summary.totalDebtVnd,
    customersWithDebt: summary.customersWithDebt,
    overdueCount: summary.overdueCustomers,
    avgDebt,
    avgReliabilityScore: summary.avgReliabilityScore,
    topDebtors: summary.topDebtors,
    agingBuckets,
    segmentBreakdown,
  };
}
