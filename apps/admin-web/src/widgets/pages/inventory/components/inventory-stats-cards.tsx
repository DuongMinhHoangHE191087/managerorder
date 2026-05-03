"use client";

import React from "react";
import { Server, Key, PackageSearch, AlertTriangle, XCircle, Gauge, DollarSign } from "lucide-react";
import {
  StaggerContainer,
  StaggerItem,
  GlassHoverCard,
} from "@/shared/ui/animations";
import { formatMoney } from "@/lib/utils";
import type { InventoryDashboardData } from "@/shared/types/inventory";
import { INVENTORY_COPY as copy } from "../copy";

interface InventoryStatsCardsProps {
  dashboard: InventoryDashboardData;
}

export const InventoryStatsCards = React.memo(function InventoryStatsCards({ dashboard }: InventoryStatsCardsProps) {
  const utilPct = dashboard.avgUtilization;

  return (
    <StaggerContainer delayChildren={0.2} staggerDelay={0.08} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <StaggerItem>
        <GlassHoverCard className="app-card flex h-full flex-col gap-2 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[12px] font-bold uppercase tracking-wider">{copy.stats.sourceAccounts}</p>
            <div className="flex items-center justify-center rounded-2xl bg-[var(--accent)]/10 p-2 text-[var(--accent)]">
              <Server className="size-5" />
            </div>
          </div>
          <p className="text-[var(--fg-base)] text-3xl font-black tracking-tight">{dashboard.activeAccounts}</p>
          <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--fg-muted)]">
            <span>{copy.stats.usedSlots(dashboard.usedSlots, dashboard.totalSlots)}</span>
            <span className="ml-1 text-[var(--accent)]">({utilPct}%)</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                utilPct >= 90 ? "bg-[var(--danger)]" : utilPct >= 70 ? "bg-[var(--warning)]" : "bg-[var(--accent)]"
              }`}
              style={{ width: `${utilPct}%` }}
            />
          </div>
        </GlassHoverCard>
      </StaggerItem>

      <StaggerItem>
        <GlassHoverCard className="app-card flex h-full flex-col gap-2 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[12px] font-bold uppercase tracking-wider">{copy.stats.licenseKeysAvailable}</p>
            <div className="flex items-center justify-center rounded-2xl bg-emerald-500/10 p-2 text-emerald-500">
              <Key className="size-5" />
            </div>
          </div>
          <p className="text-[var(--fg-base)] text-3xl font-black tracking-tight">{dashboard.keys.available}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--fg-muted)]">
            <span>{dashboard.keys.total} tổng</span>
            <span className="text-blue-500">{dashboard.keys.reserved} đặt</span>
            <span className="text-[var(--accent)]">{dashboard.keys.used} dùng</span>
          </div>
        </GlassHoverCard>
      </StaggerItem>

      <StaggerItem>
        <GlassHoverCard className="app-card flex h-full flex-col gap-2 border border-[var(--warning)]/20 bg-[rgba(255,255,255,0.94)] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[12px] font-bold uppercase tracking-wider">{copy.stats.expiringSoon}</p>
            <div className="flex items-center justify-center rounded-2xl bg-[var(--warning)]/10 p-2 text-[var(--warning)]">
              <AlertTriangle className="size-5" />
            </div>
          </div>
          <p className="text-3xl font-black tracking-tight text-[var(--warning)]">{dashboard.expiringSoon30d}</p>
          <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-[var(--fg-muted)]">
            <span>{copy.stats.inDays(30)}</span>
            {dashboard.expiringSoon7d > 0 ? (
              <span className="font-bold text-red-500">{copy.stats.within7Days(dashboard.expiringSoon7d)}</span>
            ) : null}
          </div>
        </GlassHoverCard>
      </StaggerItem>

      <StaggerItem>
        <GlassHoverCard className="app-card flex h-full flex-col gap-2 border border-red-500/20 bg-[rgba(255,255,255,0.94)] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[12px] font-bold uppercase tracking-wider">{copy.stats.expired}</p>
            <div className="flex items-center justify-center rounded-2xl bg-red-500/10 p-2 text-red-500">
              <XCircle className="size-5" />
            </div>
          </div>
          <p className="text-3xl font-black tracking-tight text-red-500">{dashboard.expiredAccounts}</p>
          <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--fg-muted)]">
            <span>{copy.stats.totalAccounts(dashboard.totalAccounts)}</span>
          </div>
        </GlassHoverCard>
      </StaggerItem>

      <StaggerItem>
        <GlassHoverCard className="app-card flex h-full flex-col gap-2 border border-orange-500/20 bg-[rgba(255,255,255,0.94)] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[12px] font-bold uppercase tracking-wider">{copy.stats.nearFull}</p>
            <div className="flex items-center justify-center rounded-2xl bg-orange-500/10 p-2 text-orange-500">
              <Gauge className="size-5" />
            </div>
          </div>
          <p className="text-3xl font-black tracking-tight text-orange-500">{dashboard.lowCapacityCount}</p>
          <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--fg-muted)]">
            <span>{copy.stats.below20Percent}</span>
          </div>
        </GlassHoverCard>
      </StaggerItem>

      <StaggerItem>
        <GlassHoverCard className="app-card flex h-full flex-col gap-2 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[12px] font-bold uppercase tracking-wider">{copy.stats.freeSlots}</p>
            <div className="flex items-center justify-center rounded-2xl bg-[var(--accent)]/10 p-2 text-[var(--accent)]">
              <PackageSearch className="size-5" />
            </div>
          </div>
          <p className="text-[var(--accent)] text-3xl font-black tracking-tight">{dashboard.availableSlots}</p>
          <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--fg-muted)]">
            <span>{copy.stats.activeAccounts(dashboard.activeAccounts)}</span>
          </div>
        </GlassHoverCard>
      </StaggerItem>

      {dashboard.totalPurchaseCostVnd > 0 ? (
        <StaggerItem>
          <GlassHoverCard className="app-card flex h-full flex-col gap-2 border border-emerald-500/20 bg-[rgba(255,255,255,0.94)] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
            <div className="flex justify-between items-start">
              <p className="text-[var(--fg-muted)] text-[12px] font-bold uppercase tracking-wider">{copy.stats.totalPurchaseCost}</p>
              <div className="flex items-center justify-center rounded-2xl bg-emerald-500/10 p-2 text-emerald-500">
                <DollarSign className="size-5" />
              </div>
            </div>
            <p className="text-3xl font-black tracking-tight text-emerald-600">
              {formatMoney(dashboard.totalPurchaseCostVnd)}
            </p>
            <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--fg-muted)]">
              <span>{copy.stats.totalInvestment}</span>
            </div>
          </GlassHoverCard>
        </StaggerItem>
      ) : null}
    </StaggerContainer>
  );
});
