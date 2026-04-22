"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { DeferredSection } from "@/shared/ui/deferred-section";
import { appToast } from "@/shared/ui/app-toast";
import { useDashboardStats, useRefreshDashboard } from "./hooks/use-dashboard";
import { DashboardKPIs } from "./components/dashboard-kpis";
import { DashboardAlerts } from "./components/dashboard-alerts";
import { DashboardAnalyticsSkeleton, DashboardGrowthSkeleton, DashboardOrdersSkeleton, DashboardRevenueSkeleton } from "./components/dashboard-skeletons";
import { DashboardHeader } from "./components/dashboard-header";
import { DashboardInsightPanels } from "./components/dashboard-insight-panels";
import { DashboardRecentOrders } from "./components/dashboard-recent-orders";
import { downloadDashboardReport } from "./lib/dashboard-export";
import { TIME_TABS, type TimeRange } from "./constants";
import type { DashboardRecentOrder } from "./types";
import { vi } from "@/shared/messages/vi";

const RevenueChart = dynamic(
  () => import("./components/revenue-chart").then((module) => ({ default: module.RevenueChart })),
  { ssr: false }
);
const ProductProfitTable = dynamic(
  () => import("./components/product-profit-table").then((module) => ({ default: module.ProductProfitTable })),
  { ssr: false }
);
const ImportSummaryTable = dynamic(
  () => import("./components/import-summary-table").then((module) => ({ default: module.ImportSummaryTable })),
  { ssr: false }
);
const ShortLinksWidget = dynamic(
  () => import("./components/short-links-widget").then((module) => ({ default: module.ShortLinksWidget })),
  { ssr: false }
);
const DashboardGrowthPanels = dynamic(
  () => import("./components/dashboard-growth-panels").then((module) => ({ default: module.DashboardGrowthPanels })),
  { ssr: false }
);

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30");
  const [isExporting, setIsExporting] = useState(false);
  const selectedTimeTab = useMemo(
    () => TIME_TABS.find((tab) => tab.value === timeRange) ?? TIME_TABS[0],
    [timeRange]
  );
  const days = Number.parseInt(timeRange, 10);

  const { data: stats, isLoading, isFetching } = useDashboardStats(days);
  const { refresh } = useRefreshDashboard();

  const totalRevenue = stats?.totalRevenue ?? 0;
  const totalCollected = stats?.totalCollected ?? 0;
  const totalProfit = stats?.totalProfit ?? 0;
  const fillRate = stats?.fillRate ?? 0;
  const availableSlots = stats?.availableSlots ?? 0;
  const usedSlots = stats?.usedSlots ?? 0;
  const totalSlots = stats?.totalSlots ?? 0;
  const pendingCount = stats?.pendingCount ?? 0;
  const overdueCustomers = stats?.overdueCustomers ?? [];
  const expiringAccounts = stats?.expiringAccounts ?? [];
  const topProductsByRevenue = stats?.topProducts ?? [];
  const productSlots = stats?.productSlots ?? [];
  const chartData = stats?.chartData ?? [];

  const pendingOrders = useMemo(
    () =>
      (stats?.pendingOrders ?? []).map((order) => ({
        id: order.id,
        customer_id: order.customerId,
        total_amount_vnd: order.totalAmountVnd,
      })),
    [stats?.pendingOrders]
  );
  const recentOrders = useMemo(
    () => (stats?.recentOrders ?? []) as DashboardRecentOrder[],
    [stats?.recentOrders]
  );

  async function handleExportDashboard() {
    if (!stats) {
      appToast.error("Chưa có dữ liệu tổng quan để xuất");
      return;
    }

    setIsExporting(true);
    try {
      const fileName = await downloadDashboardReport(stats, {
        days,
        rangeLabel: selectedTimeTab.short,
      });
      appToast.success("Đã xuất báo cáo Excel", {
        description: fileName,
      });
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : "Không thể xuất báo cáo tổng quan");
    } finally {
      setIsExporting(false);
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-[80vh] w-full flex-col items-center justify-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-[var(--border-soft)] border-t-[var(--accent)]" />
          <p className="animate-pulse text-[13px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            {vi.dashboard.loadingSummary}
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageContainer>
        <DashboardHeader
          calculatedAt={stats?.calculatedAt}
          isFetching={isFetching}
          isExporting={isExporting}
          onExport={handleExportDashboard}
          onRefresh={refresh}
          onTimeRangeChange={setTimeRange}
          timeRange={timeRange}
        />

        <DashboardKPIs
          totalRevenue={totalRevenue}
          totalCollected={totalCollected}
          totalProfit={totalProfit}
          timeLabel={selectedTimeTab.label}
          fillRate={fillRate}
          availableKeys={availableSlots}
          reservedKeys={usedSlots}
          consumedKeys={totalSlots}
          overdueCustomersCount={overdueCustomers.length}
          pendingCount={pendingCount}
        />

        <DashboardAlerts
          pendingOrders={pendingOrders}
          topOverdueCustomers={overdueCustomers}
          expiringAccounts={expiringAccounts}
        />

        <DeferredSection fallback={<DashboardAnalyticsSkeleton />}>
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
            <ProductProfitTable days={days} />
            <ImportSummaryTable />
            <ShortLinksWidget />
          </div>
        </DeferredSection>

        <DeferredSection fallback={<DashboardRevenueSkeleton />}>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            <RevenueChart
              timeRange={timeRange}
              setTimeRange={(value: string) => setTimeRange(value as TimeRange)}
              chartData={chartData}
              timeTabs={TIME_TABS}
            />

            <DashboardInsightPanels
              productSlots={productSlots}
              timeShortLabel={selectedTimeTab.short}
              topProductsByRevenue={topProductsByRevenue}
              totalRevenue={totalRevenue}
            />
          </div>
        </DeferredSection>

        <DeferredSection fallback={<DashboardGrowthSkeleton />}>
          <DashboardGrowthPanels
            forecast={stats?.revenueForecast ?? []}
            cohorts={stats?.cohortAnalysis ?? []}
            clvCustomers={stats?.customerClv ?? []}
          />
        </DeferredSection>

        <DeferredSection fallback={<DashboardOrdersSkeleton />}>
          <DashboardRecentOrders recentOrders={recentOrders} />
        </DeferredSection>
      </PageContainer>
    </AppLayout>
  );
}
