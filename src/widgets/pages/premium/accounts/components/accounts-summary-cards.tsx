"use client";

import { Activity, Database } from "lucide-react";

export function AccountsSummaryCards({
  totalAccounts,
  totalSlots,
  totalUsed,
}: {
  totalAccounts: number;
  totalSlots: number;
  totalUsed: number;
}) {
  const fillRate = totalSlots > 0 ? ((totalUsed / totalSlots) * 100).toFixed(1) : "0.0";

  return (
    <div className="grid gap-6 md:grid-cols-3 mb-8">
      <div>
        <div className="app-card flex h-full flex-col gap-2 p-6">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[11px] font-bold uppercase tracking-widest">Tổng tài khoản gốc</p>
            <span className="bg-[var(--accent)]/10 text-[var(--accent)] p-1.5 rounded-lg">
              <Database className="size-5" />
            </span>
          </div>
          <p className="text-[var(--fg-base)] text-3xl font-black">{totalAccounts}</p>
        </div>
      </div>
      <div>
        <div className="app-card flex h-full flex-col gap-2 p-6">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[11px] font-bold uppercase tracking-widest">Tỉ lệ lấp đầy (Slots)</p>
            <span className="bg-[#ff9500]/10 text-[#ff9500] p-1.5 rounded-lg">
              <Activity className="size-5" />
            </span>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-[var(--fg-base)] text-3xl font-black">{fillRate}%</p>
            <p className="text-[13px] text-[var(--fg-muted)] font-medium mb-1">
              ({totalUsed}/{totalSlots})
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
