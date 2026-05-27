"use client";

import { useState } from "react";
import loadDynamic from "next/dynamic";
import { BarChart3, Zap, Clock, Users, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { vi } from "@/shared/messages/vi";
import { formatNumber } from "@/lib/utils";
import type { PlatformMetrics } from "./platform-metrics-panels";
import { useQuery } from "@tanstack/react-query";
import type { ElementType } from "react";
import { PlatformExportPanel } from "./platform-export-panel";

const PlatformMetricsPanels = loadDynamic(
  () => import("./platform-metrics-panels").then((mod) => mod.PlatformMetricsPanels),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="mt-4 h-8 w-20 rounded bg-gray-200" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-8 animate-pulse">
          {vi.settings.platform.page.loadingDetails}
        </div>
      </div>
    ),
    ssr: false,
  }
);

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  trendLabel,
  color = "text-[var(--accent)]",
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: number;
  trendLabel?: string;
  color?: string;
}) {
  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-current/10 to-current/5 ${color}`}>
          <Icon className="size-4" />
        </div>
        <span className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">{label}</span>
      </div>
      <div>
        <p className="text-3xl font-black text-[var(--fg-base)] tracking-tight">{value}</p>
        {subValue && <p className="text-[11px] text-[var(--fg-muted)] mt-1">{subValue}</p>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-[11px] font-bold ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          <Zap className={`size-3 ${trend < 0 ? "rotate-180" : ""}`} />
          {trend > 0 ? "+" : ""}{trend}% {trendLabel}
        </div>
      )}
    </div>
  );
}

export default function PlatformMetricsPage() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");

  const { data: metrics, isLoading, isError, dataUpdatedAt } = useQuery<PlatformMetrics>({
    queryKey: ["platform-metrics", timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/settings/platform/metrics?range=${timeRange}`);
      if (!res.ok) throw new Error(vi.settings.platform.page.fetchFailed);
      const json = await res.json();
      return json.data;
    },
  });

  const runtimeNote = [
    "Trang analytics chỉ đọc, không có thao tác ghi dữ liệu.",
    "Metrics được ghép từ nguồn live và vẫn hiển thị phần còn lại nếu một nguồn phụ lỗi.",
    "Chọn mốc thời gian để đối chiếu tải, lỗi và tốc độ phản hồi gần nhất.",
  ];

  const lastUpdatedLabel = dataUpdatedAt
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(dataUpdatedAt))
    : "Đang chờ dữ liệu";

  return (
    <AppLayout>
      <PageContainer>
        {isLoading && <div className="p-8 text-center text-[var(--fg-muted)]">{vi.settings.platform.page.loadingLiveData}</div>}
        {isError && <div className="p-8 text-center text-red-500">{vi.settings.platform.page.errorLoading}</div>}
        {metrics && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mt-2">
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-[var(--fg-base)] flex items-center gap-3">
                  <BarChart3 className="size-9 text-[var(--accent)]" />
                  {vi.settings.platform.page.title}
                </h1>
                <p className="text-[15px] text-[var(--fg-muted)] font-medium mt-1">
                  {vi.settings.platform.page.description}
                </p>
              </div>
              <div className="flex bg-white border border-[var(--border-soft)] rounded-xl overflow-hidden">
                {(["24h", "7d", "30d"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-2 text-[12px] font-bold transition-[background-color,border-color,box-shadow,color,opacity,transform,width] ${
                      timeRange === range
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
                    }`}
                    type="button"
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-card border border-[var(--border-soft)] bg-gradient-to-br from-[var(--accent)]/5 to-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                    <AlertTriangle className="size-4 text-[var(--accent)]" />
                    Release / runtime note
                  </div>
                  <p className="mt-2 text-[13px] text-[var(--fg-base)] leading-6">
                    {runtimeNote[0]} {runtimeNote[1]} {runtimeNote[2]}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">Chỉ đọc</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Live data</span>
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">Fail-soft</span>
                  </div>
                </div>
                <div className="shrink-0 rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-right shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">Cập nhật lúc</p>
                  <p className="mt-1 text-[13px] font-semibold text-[var(--fg-base)]">{lastUpdatedLabel}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Zap}
                label={vi.settings.platform.page.apiCallsToday}
                value={formatNumber(metrics.apiCalls.today)}
                subValue={vi.settings.platform.page.todayTotal(formatNumber(metrics.apiCalls.total))}
                trend={metrics.apiCalls.trend}
                trendLabel={vi.settings.platform.page.vsYesterday}
                color="text-blue-600"
              />
              <StatCard
                icon={Clock}
                label={vi.settings.platform.page.avgResponse}
                value={`${metrics.apiCalls.avgResponseMs}ms`}
                subValue={`p95: ${metrics.apiCalls.p95ResponseMs}ms`}
                color="text-emerald-600"
              />
              <StatCard
                icon={AlertTriangle}
                label={vi.settings.platform.page.errorRate}
                value={`${metrics.apiCalls.errorRate}%`}
                subValue={vi.settings.platform.page.blockedByRateLimit(metrics.rateLimits.blocked)}
                color="text-amber-600"
              />
              <StatCard
                icon={Users}
                label={vi.settings.platform.page.activeUsers}
                value={metrics.authMetrics.activeUsers}
                subValue={vi.settings.platform.page.failedLogins(metrics.authMetrics.loginFailed)}
                color="text-violet-600"
              />
            </div>

            <PlatformMetricsPanels metrics={metrics} />
            <div className="mt-6">
              <PlatformExportPanel />
            </div>
          </>
        )}
      </PageContainer>
    </AppLayout>
  );
}
