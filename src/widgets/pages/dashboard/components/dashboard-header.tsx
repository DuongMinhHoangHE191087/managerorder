"use client";

import { RefreshCw } from "lucide-react";
import { formatDateCustom } from "@/lib/utils";
import { TIME_TABS, type TimeRange } from "../constants";

type DashboardHeaderProps = {
  calculatedAt?: string | null;
  isFetching: boolean;
  onExport: () => void;
  onRefresh: () => void;
  onTimeRangeChange: (value: TimeRange) => void;
  timeRange: TimeRange;
};

export function DashboardHeader({
  calculatedAt,
  isFetching,
  onExport,
  onRefresh,
  onTimeRangeChange,
  timeRange,
}: DashboardHeaderProps) {
  return (
    <div className="app-card mb-2 flex flex-col gap-4 border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-3xl font-black tracking-tight text-[var(--fg-base)]">Tổng Quan</h2>
        <div className="mt-1 flex items-center gap-3">
          <p className="text-[15px] tracking-wide text-[var(--fg-muted)]">Hiệu suất kinh doanh và báo cáo trực quan.</p>
          {calculatedAt ? (
            <span className="rounded-full bg-[var(--surface-strong)] px-2 py-0.5 text-[10px] font-medium text-[var(--fg-muted)]">
              Cập nhật: {formatDateCustom(calculatedAt, undefined, { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.82)] p-1 shadow-sm">
          {TIME_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onTimeRangeChange(tab.value)}
              className={`rounded-lg px-4 py-1.5 text-[12px] font-bold transition-all ${
                timeRange === tab.value
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--fg-muted)] hover:bg-white hover:text-[var(--fg-base)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center justify-center rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.84)] px-3 py-2 text-[13px] font-bold text-[var(--fg-muted)] transition-all hover:border-[var(--accent)]/30 hover:text-[var(--accent)]"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>

        <button
          type="button"
          onClick={onExport}
          className="rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-4 py-2 text-[13px] font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-all hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
        >
          Xuất báo cáo
        </button>
      </div>
    </div>
  );
}
