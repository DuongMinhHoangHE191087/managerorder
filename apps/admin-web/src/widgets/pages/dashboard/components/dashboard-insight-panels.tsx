"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/utils";
import type { DashboardProductSlot, DashboardTopProduct } from "../types";
import { vi } from "@/shared/messages/vi";

type DashboardInsightPanelsProps = {
  productSlots: DashboardProductSlot[];
  timeShortLabel: string;
  topProductsByRevenue: DashboardTopProduct[];
  totalRevenue: number;
};

function getSlotState(item: DashboardProductSlot) {
  const isFull = item.max > 0 && item.used >= item.max;
  const isAlmostFull = item.max > 0 && item.used >= item.max * 0.8 && !isFull;
  const statusColor = isFull ? "text-[var(--danger)]" : isAlmostFull ? "text-[var(--warning)]" : "text-[var(--accent)]";
  const statusText = isFull ? vi.dashboard.insightPanels.full : isAlmostFull ? vi.dashboard.insightPanels.almostFull : vi.dashboard.insightPanels.empty;

  return { statusColor, statusText };
}

export function DashboardInsightPanels({
  productSlots,
  timeShortLabel,
  topProductsByRevenue,
  totalRevenue,
}: DashboardInsightPanelsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:col-span-2">
      <div className="app-card flex min-w-0 flex-col overflow-hidden border border-[var(--border-soft)] shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-[background-color,border-color,box-shadow,color,opacity,transform,width] hover:shadow-[0_22px_52px_rgba(15,23,42,0.08)]">
        <div className="border-b border-[var(--border-soft)] bg-[var(--bg-app)]/50 p-5 backdrop-blur-sm">
          <h3 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">{vi.dashboard.insightPanels.productStockStatus}</h3>
        </div>

        <div className="space-y-2 p-4">
          {productSlots.map((item) => {
            const { statusColor, statusText } = getSlotState(item);

            return (
              <div
                key={item.name}
                className="group flex cursor-pointer items-center gap-4 rounded-[1rem] border border-transparent p-3 transition-colors hover:border-[var(--border-soft)] hover:bg-[var(--surface-light)]"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-[var(--accent)]/10 font-bold text-[var(--accent)] transition-transform group-hover:scale-105 group-hover:bg-[var(--accent)] group-hover:text-white group-hover:shadow-[0_0_10px_rgba(85,202,2,0.4)]">
                  {item.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate text-[13px] font-bold text-[var(--fg-base)] transition-colors group-hover:text-[var(--accent)]">
                    {item.name}
                  </p>
                  <p className="text-[11px] font-medium text-[var(--fg-muted)]">{vi.dashboard.insightPanels.autoRenewActive}</p>
                </div>
                <div className="text-right">
                  <p className={`text-[13px] font-black ${statusColor}`}>
                    {vi.dashboard.insightPanels.unitsUsed(item.used, item.max)}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">{statusText}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-auto border-t border-[var(--border-soft)] bg-[var(--surface-light)]/30 p-4">
          <Link
            href="/inventory"
            className="block w-full rounded-[1rem] py-2 text-center text-[13px] font-bold text-[var(--accent)] transition-colors active:scale-95 hover:bg-[var(--accent)]/10"
          >
            {vi.dashboard.insightPanels.viewInventory}
          </Link>
        </div>
      </div>

      <div className="app-card flex min-w-0 flex-col overflow-hidden border border-[var(--border-soft)] shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-[background-color,border-color,box-shadow,color,opacity,transform,width] hover:shadow-[0_22px_52px_rgba(15,23,42,0.08)]">
        <div className="border-b border-[var(--border-soft)] bg-[var(--bg-app)]/50 p-5 backdrop-blur-sm">
          <h3 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">{vi.dashboard.insightPanels.revenueByProduct}</h3>
          <p className="mt-0.5 text-[12px] text-[var(--fg-muted)]">{vi.dashboard.insightPanels.topDisplay(timeShortLabel)}</p>
        </div>

        <div className="flex-1 space-y-4 p-4">
          {topProductsByRevenue.map((item) => {
            const percent = totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0;

            return (
              <div key={item.name} className="group">
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="min-w-0 flex-1 truncate font-bold text-[var(--fg-base)]">{item.name}</span>
                  <span className="font-black text-[var(--fg-base)]">{formatMoney(item.revenue)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
                    <div
                      className="h-full bg-[var(--accent)] transition-colors group-hover:bg-[#ff9500]"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-[10px] font-bold text-[var(--fg-muted)]">
                    {Math.round(percent)}%
                  </span>
                </div>
              </div>
            );
          })}

          {topProductsByRevenue.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[12px] text-[var(--fg-muted)]">
              {vi.dashboard.insightPanels.noRevenue}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
