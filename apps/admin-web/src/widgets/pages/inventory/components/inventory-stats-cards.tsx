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
        <GlassHoverCard className="app-card flex h-full flex-col gap-2 border border-[var(--border-soft)] bg-white/90 backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] rounded-[1.5rem] transition-all duration-300 hover:shadow-[0_18px_38px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 active:scale-[0.98] cursor-default">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[11px] font-extrabold uppercase tracking-wider">{copy.stats.sourceAccounts}</p>
            <div className="flex items-center justify-center rounded-xl bg-[var(--accent)]/10 p-1.5 text-[var(--accent)]">
              <Server className="size-4" />
            </div>
          </div>
          <p className="text-[var(--fg-base)] text-3xl font-black tracking-tight font-mono tabular-nums">{dashboard.activeAccounts}</p>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[var(--fg-muted)]">
            <span>{dashboard.usedSlots}/{dashboard.totalSlots} slots</span>
            <span className="ml-1 text-[var(--accent)] font-mono font-bold">({utilPct}%)</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                utilPct >= 90 ? "bg-red-500" : utilPct >= 70 ? "bg-amber-500" : "bg-[var(--accent)]"
              }`}
              style={{ width: `${utilPct}%` }}
            />
          </div>
        </GlassHoverCard>
      </StaggerItem>

      <StaggerItem>
        <GlassHoverCard className="app-card flex h-full flex-col gap-2 border border-[var(--border-soft)] bg-white/90 backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] rounded-[1.5rem] transition-all duration-300 hover:shadow-[0_18px_38px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 active:scale-[0.98] cursor-default">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[11px] font-extrabold uppercase tracking-wider">{copy.stats.licenseKeysAvailable}</p>
            <div className="flex items-center justify-center rounded-xl bg-emerald-500/10 p-1.5 text-emerald-500">
              <Key className="size-4" />
            </div>
          </div>
          <p className="text-[var(--fg-base)] text-3xl font-black tracking-tight font-mono tabular-nums">{dashboard.keys.available}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">
            <span className="rounded-lg bg-slate-100 px-1.5 py-0.5 font-mono font-extrabold">{dashboard.keys.total} Tổng</span>
            <span className="rounded-lg bg-blue-50 text-blue-600 px-1.5 py-0.5 font-mono font-extrabold">{dashboard.keys.reserved} Đặt</span>
            <span className="rounded-lg bg-emerald-50 text-emerald-600 px-1.5 py-0.5 font-mono font-extrabold">{dashboard.keys.used} Dùng</span>
          </div>
        </GlassHoverCard>
      </StaggerItem>

      <StaggerItem>
        <GlassHoverCard className="app-card flex h-full flex-col gap-2 border border-amber-500/25 bg-amber-500/5 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] rounded-[1.5rem] transition-all duration-300 hover:shadow-[0_18px_38px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 active:scale-[0.98] cursor-default">
          <div className="flex justify-between items-start">
            <p className="text-amber-600 text-[11px] font-extrabold uppercase tracking-wider">{copy.stats.expiringSoon}</p>
            <div className="flex items-center justify-center rounded-xl bg-amber-500/10 p-1.5 text-amber-500">
              <AlertTriangle className="size-4" />
            </div>
          </div>
          <p className="text-3xl font-black tracking-tight text-amber-600 font-mono tabular-nums">{dashboard.expiringSoon30d}</p>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-amber-700/80">
            <span>{copy.stats.inDays(30)}</span>
            {dashboard.expiringSoon7d > 0 ? (
              <span className="font-extrabold text-red-500 font-mono">({dashboard.expiringSoon7d} trong 7 ngày!)</span>
            ) : null}
          </div>
        </GlassHoverCard>
      </StaggerItem>

      <StaggerItem>
        <GlassHoverCard className="app-card flex h-full flex-col gap-2 border border-red-500/25 bg-red-500/5 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] rounded-[1.5rem] transition-all duration-300 hover:shadow-[0_18px_38px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 active:scale-[0.98] cursor-default">
          <div className="flex justify-between items-start">
            <p className="text-red-600 text-[11px] font-extrabold uppercase tracking-wider">{copy.stats.expired}</p>
            <div className="flex items-center justify-center rounded-xl bg-red-500/10 p-1.5 text-red-500">
              <XCircle className="size-4" />
            </div>
          </div>
          <p className="text-3xl font-black tracking-tight text-red-600 font-mono tabular-nums">{dashboard.expiredAccounts}</p>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-700/80">
            <span>Tổng số: <span className="font-mono font-bold">{dashboard.totalAccounts}</span> kho</span>
          </div>
        </GlassHoverCard>
      </StaggerItem>

      <StaggerItem>
        <GlassHoverCard className="app-card flex h-full flex-col gap-2 border border-orange-500/25 bg-orange-500/5 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] rounded-[1.5rem] transition-all duration-300 hover:shadow-[0_18px_38px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 active:scale-[0.98] cursor-default">
          <div className="flex justify-between items-start">
            <p className="text-orange-600 text-[11px] font-extrabold uppercase tracking-wider">{copy.stats.nearFull}</p>
            <div className="flex items-center justify-center rounded-xl bg-orange-500/10 p-1.5 text-orange-500">
              <Gauge className="size-4" />
            </div>
          </div>
          <p className="text-3xl font-black tracking-tight text-orange-600 font-mono tabular-nums">{dashboard.lowCapacityCount}</p>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-orange-700/80">
            <span>{copy.stats.below20Percent}</span>
          </div>
        </GlassHoverCard>
      </StaggerItem>

      <StaggerItem>
        <GlassHoverCard className="app-card flex h-full flex-col gap-2 border border-[var(--border-soft)] bg-white/90 backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] rounded-[1.5rem] transition-all duration-300 hover:shadow-[0_18px_38px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 active:scale-[0.98] cursor-default">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[11px] font-extrabold uppercase tracking-wider">{copy.stats.freeSlots}</p>
            <div className="flex items-center justify-center rounded-xl bg-[var(--accent)]/10 p-1.5 text-[var(--accent)]">
              <PackageSearch className="size-4" />
            </div>
          </div>
          <p className="text-[var(--accent)] text-3xl font-black tracking-tight font-mono tabular-nums">{dashboard.availableSlots}</p>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[var(--fg-muted)]">
            <span>Kho hoạt động: <span className="font-mono font-bold">{dashboard.activeAccounts}</span></span>
          </div>
        </GlassHoverCard>
      </StaggerItem>

      {dashboard.totalPurchaseCostVnd > 0 ? (
        <StaggerItem>
          <GlassHoverCard className="app-card flex h-full flex-col gap-2 border border-emerald-500/25 bg-emerald-500/5 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] rounded-[1.5rem] transition-all duration-300 hover:shadow-[0_18px_38px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 active:scale-[0.98] cursor-default">
            <div className="flex justify-between items-start">
              <p className="text-emerald-700 text-[11px] font-extrabold uppercase tracking-wider">{copy.stats.totalPurchaseCost}</p>
              <div className="flex items-center justify-center rounded-xl bg-emerald-500/10 p-1.5 text-emerald-500">
                <DollarSign className="size-4" />
              </div>
            </div>
            <p className="text-3xl font-black tracking-tight text-emerald-700 font-mono tabular-nums">
              {formatMoney(dashboard.totalPurchaseCostVnd)}
            </p>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-700/80">
              <span>{copy.stats.totalInvestment}</span>
            </div>
          </GlassHoverCard>
        </StaggerItem>
      ) : null}
    </StaggerContainer>
  );
});
