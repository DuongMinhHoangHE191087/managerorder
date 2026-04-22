"use client";

import { Activity, Database, ScanSearch } from "lucide-react";

export function AccountsSummaryCards({
  totalAccounts,
  totalSlots,
  totalUsed,
  activeSubscriptions,
  expiringSubscriptions,
  pendingMigrations,
  workingConnections,
  manualCheckNeeded,
  connectionErrors,
}: {
  totalAccounts: number;
  totalSlots: number;
  totalUsed: number;
  activeSubscriptions: number;
  expiringSubscriptions: number;
  pendingMigrations: number;
  workingConnections: number;
  manualCheckNeeded: number;
  connectionErrors: number;
}) {
  const fillRate = totalSlots > 0 ? ((totalUsed / totalSlots) * 100).toFixed(1) : "0.0";
  const connectionIssues = manualCheckNeeded + connectionErrors;

  return (
    <div className="mb-8 grid gap-6 md:grid-cols-2 xl:grid-cols-5">
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

      <div>
        <div className="app-card flex h-full flex-col gap-2 p-6">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[11px] font-bold uppercase tracking-widest">Thuê bao đang hoạt động</p>
            <span className="bg-emerald-500/10 text-emerald-600 p-1.5 rounded-lg">
              <Activity className="size-5" />
            </span>
          </div>
          <div className="flex items-end gap-2">
          <p className="text-[var(--fg-base)] text-3xl font-black">{activeSubscriptions}</p>
            <p className="text-[13px] text-[var(--fg-muted)] font-medium mb-1">
              {expiringSubscriptions > 0 ? `${expiringSubscriptions} sắp hết hạn` : "ổn định"}
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="app-card flex h-full flex-col gap-2 p-6">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[11px] font-bold uppercase tracking-widest">Migration chờ xử lý</p>
            <span className="bg-[#ff9500]/10 text-[#ff9500] p-1.5 rounded-lg">
              <Database className="size-5" />
            </span>
          </div>
          <p className="text-[var(--fg-base)] text-3xl font-black">{pendingMigrations}</p>
        </div>
      </div>

      <div>
        <div className="app-card flex h-full flex-col gap-2 p-6">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[11px] font-bold uppercase tracking-widest">Tình trạng kết nối</p>
            <span className="bg-sky-500/10 text-sky-600 p-1.5 rounded-lg">
              <ScanSearch className="size-5" />
            </span>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-[var(--fg-base)] text-3xl font-black">{workingConnections}</p>
            <p className="text-[13px] text-[var(--fg-muted)] font-medium mb-1">
              {connectionIssues > 0
                ? `${manualCheckNeeded} cần kiểm tra, ${connectionErrors} lỗi`
                : "ổn định"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
