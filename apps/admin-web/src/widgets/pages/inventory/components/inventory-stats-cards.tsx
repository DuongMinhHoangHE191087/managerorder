"use client";
 
import React from "react";
import { Server, Key, PackageSearch, AlertTriangle, XCircle, Gauge, DollarSign } from "lucide-react";
import { StaggerContainer, StaggerItem, GlassHoverCard } from "@/shared/ui/animations";
import { formatMoney } from "@/lib/utils";
import type { InventoryDashboardData } from "@/shared/types/inventory";
import { INVENTORY_COPY as copy } from "../copy";
 
interface InventoryStatsCardsProps {
  dashboard: InventoryDashboardData;
}
 
export const InventoryStatsCards = React.memo(function InventoryStatsCards({ dashboard }: InventoryStatsCardsProps) {
  const utilPct = dashboard.avgUtilization;
  const showCost = dashboard.totalPurchaseCostVnd > 0;
 
  return (
    <StaggerContainer 
      delayChildren={0.2} 
      staggerDelay={0.08} 
      className={`grid grid-cols-2 gap-2 mb-4 ${
        showCost ? "xl:grid-cols-4 2xl:grid-cols-7" : "xl:grid-cols-3 2xl:grid-cols-6"
      }`}
    >
      {/* Card 1: Tổng kho */}
      <StaggerItem>
        <GlassHoverCard className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
          <div className="min-w-0 flex-1">
            <p className="text-[var(--fg-muted)] text-[9px] font-bold uppercase tracking-widest mb-1">{copy.stats.sourceAccounts}</p>
            <p className="text-[var(--fg-base)] text-lg font-black tracking-tight font-mono leading-none mb-1.5">{dashboard.activeAccounts}</p>
            <div className="flex items-center gap-1 text-[9px] font-bold text-[var(--fg-muted)] font-mono">
              <span>{dashboard.usedSlots}/{dashboard.totalSlots} Slots</span>
              <span className="text-[var(--accent)] font-bold">({utilPct}%)</span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  utilPct >= 90 ? "bg-red-500" : utilPct >= 70 ? "bg-amber-500" : "bg-[var(--accent)]"
                }`}
                style={{ width: `${utilPct}%` }}
              />
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-[var(--accent)]/10 p-1.5 text-[var(--accent)] self-start">
            <Server className="size-4" />
          </span>
        </GlassHoverCard>
      </StaggerItem>
 
      {/* Card 2: Key khả dụng */}
      <StaggerItem>
        <GlassHoverCard className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
          <div className="min-w-0">
            <p className="text-[var(--fg-muted)] text-[9px] font-bold uppercase tracking-widest mb-1">{copy.stats.licenseKeysAvailable}</p>
            <p className="text-[var(--fg-base)] text-lg font-black tracking-tight font-mono leading-none mb-1.5">{dashboard.keys.available}</p>
            <div className="flex flex-wrap items-center gap-1">
              <span className="rounded bg-slate-50 text-[var(--fg-muted)] px-1 py-px text-[9px] font-bold font-mono border border-slate-100">{dashboard.keys.total} Tổng</span>
              <span className="rounded bg-emerald-50 text-emerald-600 px-1 py-px text-[9px] font-bold font-mono border border-emerald-100">{dashboard.keys.used} Dùng</span>
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-emerald-500/10 p-1.5 text-emerald-500 self-start">
            <Key className="size-4" />
          </span>
        </GlassHoverCard>
      </StaggerItem>
 
      {/* Card 3: Sắp hết hạn */}
      <StaggerItem>
        <GlassHoverCard className="flex items-center justify-between gap-2 rounded-xl border border-amber-200/60 bg-amber-50/30 p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
          <div className="min-w-0">
            <p className="text-amber-600 text-[9px] font-bold uppercase tracking-widest mb-1">{copy.stats.expiringSoon}</p>
            <p className="text-amber-600 text-lg font-black tracking-tight font-mono leading-none mb-1.5">{dashboard.expiringSoon30d}</p>
            <div className="flex items-center gap-1 text-[9px] font-bold text-amber-700/80 font-mono">
              <span>Trong 30 ngày</span>
              {dashboard.expiringSoon7d > 0 && <span className="text-red-500">({dashboard.expiringSoon7d} đ / 7n)</span>}
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-amber-500/10 p-1.5 text-amber-500 self-start">
            <AlertTriangle className="size-4" />
          </span>
        </GlassHoverCard>
      </StaggerItem>
 
      {/* Card 4: Đã hết hạn */}
      <StaggerItem>
        <GlassHoverCard className="flex items-center justify-between gap-2 rounded-xl border border-red-200/60 bg-red-50/30 p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
          <div className="min-w-0">
            <p className="text-red-600 text-[9px] font-bold uppercase tracking-widest mb-1">{copy.stats.expired}</p>
            <p className="text-red-600 text-lg font-black tracking-tight font-mono leading-none mb-1.5">{dashboard.expiredAccounts}</p>
            <div className="flex items-center gap-1 text-[9px] font-bold text-red-700/80 font-mono">
              <span>Tổng: {dashboard.totalAccounts} kho</span>
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-red-500/10 p-1.5 text-red-500 self-start">
            <XCircle className="size-4" />
          </span>
        </GlassHoverCard>
      </StaggerItem>
 
      {/* Card 5: Gần đầy */}
      <StaggerItem>
        <GlassHoverCard className="flex items-center justify-between gap-2 rounded-xl border border-orange-200/60 bg-orange-50/30 p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
          <div className="min-w-0">
            <p className="text-orange-600 text-[9px] font-bold uppercase tracking-widest mb-1">{copy.stats.nearFull}</p>
            <p className="text-orange-600 text-lg font-black tracking-tight font-mono leading-none mb-1.5">{dashboard.lowCapacityCount}</p>
            <div className="flex items-center gap-1 text-[9px] font-bold text-orange-700/80 font-mono">
              <span>Trống dưới 20%</span>
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-orange-500/10 p-1.5 text-orange-500 self-start">
            <Gauge className="size-4" />
          </span>
        </GlassHoverCard>
      </StaggerItem>
 
      {/* Card 6: Slot trống */}
      <StaggerItem>
        <GlassHoverCard className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
          <div className="min-w-0">
            <p className="text-[var(--fg-muted)] text-[9px] font-bold uppercase tracking-widest mb-1">{copy.stats.freeSlots}</p>
            <p className="text-[var(--accent)] text-lg font-black tracking-tight font-mono leading-none mb-1.5">{dashboard.availableSlots}</p>
            <div className="flex items-center gap-1 text-[9px] font-bold text-[var(--fg-muted)] font-mono">
              <span>Đang hoạt động: {dashboard.activeAccounts}</span>
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-[var(--accent)]/10 p-1.5 text-[var(--accent)] self-start">
            <PackageSearch className="size-4" />
          </span>
        </GlassHoverCard>
      </StaggerItem>
 
      {/* Card 7: Chi phí (Hiển thị nếu có) */}
      {showCost && (
        <StaggerItem>
          <GlassHoverCard className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/30 p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
            <div className="min-w-0">
              <p className="text-emerald-700 text-[9px] font-bold uppercase tracking-widest mb-1">{copy.stats.totalPurchaseCost}</p>
              <p className="text-emerald-700 text-lg font-black tracking-tight font-mono leading-none mb-1.5">{formatMoney(dashboard.totalPurchaseCostVnd)}</p>
              <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-700/80 font-mono">
                <span>Tổng vốn đầu tư</span>
              </div>
            </div>
            <span className="shrink-0 rounded-lg bg-emerald-500/10 p-1.5 text-emerald-500 self-start">
              <DollarSign className="size-4" />
            </span>
          </GlassHoverCard>
        </StaggerItem>
      )}
    </StaggerContainer>
  );
});
