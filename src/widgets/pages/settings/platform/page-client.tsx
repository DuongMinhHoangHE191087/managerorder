"use client";

import { useState } from "react";
import loadDynamic from "next/dynamic";
import { BarChart3, Zap, Clock, Users, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { formatNumber } from "@/lib/utils";
import type { PlatformMetrics } from "./platform-metrics-panels";
import { useQuery } from "@tanstack/react-query";
import type { ElementType } from "react";

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
          Đang tải chi tiết metric...
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

  const { data: metrics, isLoading, isError } = useQuery<PlatformMetrics>({
    queryKey: ["platform-metrics", timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/settings/platform/metrics?range=${timeRange}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      return json.data;
    },
  });

  return (
    <AppLayout>
      <PageContainer>
        {isLoading && <div className="p-8 text-center text-[var(--fg-muted)]">Đang tải dữ liệu thực...</div>}
        {isError && <div className="p-8 text-center text-red-500">Lỗi khi tải dữ liệu metric.</div>}
        {metrics && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mt-2">
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-[var(--fg-base)] flex items-center gap-3">
                  <BarChart3 className="size-9 text-[var(--accent)]" />
                  Platform Metrics
                </h1>
                <p className="text-[15px] text-[var(--fg-muted)] font-medium mt-1">
                  Giám sát API usage, rate limits, auth failures và hiệu suất hệ thống
                </p>
              </div>
              <div className="flex bg-white border border-[var(--border-soft)] rounded-xl overflow-hidden">
                {(["24h", "7d", "30d"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-2 text-[12px] font-bold transition-all ${
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Zap}
                label="API Calls (hôm nay)"
                value={formatNumber(metrics.apiCalls.today)}
                subValue={`Tổng: ${formatNumber(metrics.apiCalls.total)}`}
                trend={metrics.apiCalls.trend}
                trendLabel="vs hôm qua"
                color="text-blue-600"
              />
              <StatCard
                icon={Clock}
                label="Avg Response"
                value={`${metrics.apiCalls.avgResponseMs}ms`}
                subValue={`p95: ${metrics.apiCalls.p95ResponseMs}ms`}
                color="text-emerald-600"
              />
              <StatCard
                icon={AlertTriangle}
                label="Error Rate"
                value={`${metrics.apiCalls.errorRate}%`}
                subValue={`${metrics.rateLimits.blocked} blocked by rate limit`}
                color="text-amber-600"
              />
              <StatCard
                icon={Users}
                label="Active Users"
                value={metrics.authMetrics.activeUsers}
                subValue={`${metrics.authMetrics.loginFailed} failed logins`}
                color="text-violet-600"
              />
            </div>

            <PlatformMetricsPanels metrics={metrics} />
          </>
        )}
      </PageContainer>
    </AppLayout>
  );
}
