"use client";

import { BadgeDollarSign, CalendarRange, TrendingUp } from "lucide-react";
import type { ElementType } from "react";
import { formatMoney } from "@/lib/utils";
import type { DashboardClvRow, DashboardCohortRow, DashboardForecastRow } from "@/shared/types/dashboard";

type DashboardGrowthPanelsProps = {
  forecast: DashboardForecastRow[];
  cohorts: DashboardCohortRow[];
  clvCustomers: DashboardClvRow[];
};

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-[var(--border-soft)] bg-[var(--bg-app)]/50 p-5 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">{title}</h3>
          <p className="text-[12px] text-[var(--fg-muted)]">{description}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-light)]/30 px-4 text-center text-[13px] text-[var(--fg-muted)]">
      {label}
    </div>
  );
}

export function DashboardGrowthPanels({ forecast, cohorts, clvCustomers }: DashboardGrowthPanelsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <section className="app-card flex min-w-0 flex-col overflow-hidden border border-[var(--border-soft)] shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-all hover:shadow-[0_22px_52px_rgba(15,23,42,0.08)]">
        <SectionHeader
          icon={TrendingUp}
          title="Dự báo doanh thu"
          description="Ước tính 30/60/90 ngày dựa trên xu hướng gần đây và đơn chờ thanh toán."
        />
        <div className="flex-1 space-y-3 p-4">
          {forecast.length === 0 ? (
            <EmptyState label="Chưa đủ dữ liệu để dựng dự báo." />
          ) : (
            forecast.map((item) => (
              <div
                key={item.horizonLabel}
                className="rounded-[1rem] border border-[var(--border-soft)] bg-white/80 px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[12px] font-black uppercase tracking-wider text-[var(--fg-base)]">
                      {item.horizonLabel}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-[var(--fg-muted)]">{item.note}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-black text-[var(--accent)]">{formatMoney(item.projectedRevenue)}</p>
                    <p className="mt-0.5 text-[11px] font-bold text-emerald-600">{item.confidence}% tin cậy</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--border-soft)]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))]"
                    style={{ width: `${Math.min(100, item.confidence)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="app-card flex min-w-0 flex-col overflow-hidden border border-[var(--border-soft)] shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-all hover:shadow-[0_22px_52px_rgba(15,23,42,0.08)]">
        <SectionHeader
          icon={CalendarRange}
          title="Cohort retention"
          description="Theo dõi khách mới, khách quay lại và tỷ lệ churn theo tháng."
        />
        <div className="flex-1 space-y-3 p-4">
          {cohorts.length === 0 ? (
            <EmptyState label="Chưa đủ dữ liệu cohort." />
          ) : (
            cohorts.map((item) => (
              <div
                key={item.cohortLabel}
                className="rounded-[1rem] border border-[var(--border-soft)] bg-white/80 px-4 py-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-black uppercase tracking-wider text-[var(--fg-base)]">{item.cohortLabel}</p>
                    <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                      {item.acquiredCustomers} khách mới · {item.returningCustomers} khách quay lại
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-black text-[var(--accent)]">{Math.round(item.retentionRate)}%</p>
                    <p className="mt-0.5 text-[11px] font-bold text-amber-600">{Math.round(item.churnRate)}% churn</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--border-soft)]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(135deg,#10b981,#0f766e)]"
                    style={{ width: `${Math.min(100, item.retentionRate)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-[var(--fg-muted)]">
                  Doanh thu cohort: {formatMoney(item.revenue)}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="app-card flex min-w-0 flex-col overflow-hidden border border-[var(--border-soft)] shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-all hover:shadow-[0_22px_52px_rgba(15,23,42,0.08)]">
        <SectionHeader
          icon={BadgeDollarSign}
          title="Top CLV khách hàng"
          description="Xếp hạng theo giá trị vòng đời ước tính để ưu tiên chăm sóc."
        />
        <div className="flex-1 space-y-3 p-4">
          {clvCustomers.length === 0 ? (
            <EmptyState label="Chưa đủ dữ liệu CLV." />
          ) : (
            clvCustomers.map((customer, index) => (
              <div
                key={customer.customerId}
                className="rounded-[1rem] border border-[var(--border-soft)] bg-white/80 px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[11px] font-black text-[var(--accent)]">
                        #{index + 1}
                      </span>
                      <p className="truncate text-[13px] font-bold text-[var(--fg-base)]">{customer.customerName}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                      {customer.orderCount} đơn · {Math.round(customer.repeatRate)}% khách quay lại
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-black text-[var(--accent)]">{formatMoney(customer.clvScore)}</p>
                    <p className="mt-0.5 text-[11px] font-bold text-emerald-600">CLV ước tính</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                  <div className="rounded-xl bg-[var(--surface-light)]/70 px-3 py-2">
                    <p className="font-bold text-[var(--fg-muted)]">Doanh thu</p>
                    <p className="mt-0.5 font-black text-[var(--fg-base)]">{formatMoney(customer.totalRevenue)}</p>
                  </div>
                  <div className="rounded-xl bg-[var(--surface-light)]/70 px-3 py-2">
                    <p className="font-bold text-[var(--fg-muted)]">Lợi nhuận</p>
                    <p className="mt-0.5 font-black text-[var(--fg-base)]">{formatMoney(customer.totalProfit)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
