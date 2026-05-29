"use client";

import type { ReactNode } from "react";
import { formatMoney } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";

interface DashboardKPIsProps {
  totalRevenue: number;
  totalCollected: number;
  totalProfit: number;
  timeLabel?: string;
  fillRate: number;
  availableKeys: number;
  reservedKeys: number;
  consumedKeys: number;
  overdueCustomersCount: number;
  pendingCount: number;
}

function KPIStyleCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`app-card flex h-full flex-col justify-between border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,250,244,0.86))] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] transition-[background-color,border-color,box-shadow,color,opacity,transform,width] duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(15,23,42,0.08)] active:scale-[0.98] ${className}`}
    >
      {children}
    </div>
  );
}

export function DashboardKPIs({
  totalRevenue,
  totalCollected,
  totalProfit,
  timeLabel = vi.dashboard.kpis.defaultTimeLabel,
  fillRate,
  availableKeys,
  reservedKeys,
  consumedKeys,
  overdueCustomersCount,
  pendingCount,
}: DashboardKPIsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <KPIStyleCard>
        <div>
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined rounded-2xl bg-[var(--accent)]/10 p-2.5 text-[var(--accent)]">
              payments
            </span>
            <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-xs font-bold text-[var(--accent)]">
              {vi.dashboard.kpis.revenueGrowth}
            </span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            {vi.dashboard.kpis.totalRevenueMonth}
          </p>
        </div>
        <h3 className="mt-2 text-3xl font-black tracking-tight text-[var(--fg-base)] font-mono" data-testid="dashboard-kpi-value">
          {formatMoney(totalRevenue)}
        </h3>
      </KPIStyleCard>

      <KPIStyleCard>
        <div>
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined rounded-2xl bg-emerald-500/10 p-2.5 text-emerald-500">
              account_balance_wallet
            </span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            {vi.dashboard.kpis.collected(timeLabel)}
          </p>
        </div>
        <h3 className="mt-2 text-3xl font-black tracking-tight text-emerald-600 font-mono" data-testid="dashboard-kpi-value">
          {formatMoney(totalCollected)}
        </h3>
      </KPIStyleCard>

      <KPIStyleCard>
        <div>
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined rounded-2xl bg-[var(--accent)]/10 p-2.5 text-[var(--accent)]">
              insights
            </span>
            <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-xs font-bold text-[var(--accent)]">
              {vi.dashboard.kpis.profitGrowth}
            </span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            {vi.dashboard.kpis.totalProfit(timeLabel)}
          </p>
        </div>
        <h3 className="mt-2 text-3xl font-black tracking-tight text-[var(--fg-base)] font-mono" data-testid="dashboard-kpi-value">
          {formatMoney(totalProfit)}
        </h3>
      </KPIStyleCard>

      <KPIStyleCard>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">{vi.dashboard.kpis.fillRate}</p>
          <span className="text-lg font-bold text-[var(--accent)] font-mono" data-testid="dashboard-kpi-value">
            {fillRate}%
          </span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[var(--border-soft)] shadow-inner">
          <div
            className="h-full rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] shadow-[0_0_10px_rgba(var(--accent-rgb),0.32)] transition-[background-color,border-color,box-shadow,color,opacity,transform,width] duration-1000 ease-out"
            style={{ width: `${fillRate}%` }}
          />
        </div>
        <p className="mt-5 text-[10px] font-bold tracking-wider text-[var(--fg-muted)]">{vi.dashboard.kpis.maxUsage}</p>
      </KPIStyleCard>

      <KPIStyleCard>
        <p className="mb-3 border-b border-[var(--border-soft)] pb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
          {vi.dashboard.kpis.serviceStatus}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 font-mono">
          <div className="flex-1 text-center">
            <p className="text-2xl font-black text-[var(--accent)]" data-testid="dashboard-kpi-value">
              {availableKeys}
            </p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[var(--fg-muted)] font-sans">{vi.dashboard.kpis.active}</p>
          </div>
          <div className="h-8 w-px bg-[var(--border-soft)]" />
          <div className="flex-1 text-center">
            <p className="text-2xl font-black text-[var(--warning)]" data-testid="dashboard-kpi-value">
              {reservedKeys}
            </p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[var(--fg-muted)] font-sans">{vi.dashboard.kpis.expiring}</p>
          </div>
          <div className="h-8 w-px bg-[var(--border-soft)]" />
          <div className="flex-1 text-center">
            <p className="text-2xl font-black text-[var(--danger)]" data-testid="dashboard-kpi-value">
              {consumedKeys}
            </p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[var(--fg-muted)] font-sans">{vi.dashboard.kpis.used}</p>
          </div>
        </div>
      </KPIStyleCard>

      <KPIStyleCard className="bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(254,242,242,0.84))]">
        <div>
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined rounded-2xl bg-[var(--danger)]/10 p-2.5 text-[var(--danger)]">
              assignment_late
            </span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--danger)]">{vi.dashboard.kpis.actionRequired}</p>
        </div>
        <div className="mt-2 text-[var(--fg-base)] font-mono">
          <p className="text-xl font-black tracking-tight">
            <span className="text-[var(--danger)]" data-testid="dashboard-kpi-value">
              {overdueCustomersCount}
            </span>{" "}
            <span className="font-sans font-bold text-[13px] text-[var(--fg-muted)]">{vi.dashboard.kpis.debtCustomerSuffix}</span>
          </p>
          <p className="mt-1 text-xl font-black tracking-tight">
            <span className="text-[var(--warning)]" data-testid="dashboard-kpi-value">
              {pendingCount}
            </span>{" "}
            <span className="font-sans font-bold text-[13px] text-[var(--fg-muted)]">{vi.dashboard.kpis.pendingOrderSuffix}</span>
          </p>
        </div>
      </KPIStyleCard>
    </div>
  );
}
