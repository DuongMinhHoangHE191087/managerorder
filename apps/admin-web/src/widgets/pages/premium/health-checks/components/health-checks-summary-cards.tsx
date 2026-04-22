"use client";

import { Activity, AlertCircle, CheckCircle2, Clock3, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { StatsGrid } from "@/shared/ui/page-layout";

function SummaryCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: number;
  hint: string;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <div className="app-card flex h-full flex-col gap-2 p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{label}</p>
        <span className={`rounded-lg p-1.5 ${tone}`}>{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <p className="text-3xl font-black text-[var(--fg-base)]">{value}</p>
        <p className="mb-1 text-[13px] font-medium text-[var(--fg-muted)]">{hint}</p>
      </div>
    </div>
  );
}

export function HealthChecksSummaryCards({
  totalResults,
  workingCount,
  errorCount,
  unknownCount,
  manualCount,
}: {
  totalResults: number;
  workingCount: number;
  errorCount: number;
  unknownCount: number;
  manualCount: number;
}) {
  return (
    <StatsGrid className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
      <SummaryCard
        label="Tổng log"
        value={totalResults}
        hint="khớp bộ lọc"
        tone="bg-[var(--accent)]/10 text-[var(--accent)]"
        icon={<Activity className="size-5" />}
      />
      <SummaryCard
        label="Working"
        value={workingCount}
        hint="trang hiện tại"
        tone="bg-emerald-500/10 text-emerald-600"
        icon={<CheckCircle2 className="size-5" />}
      />
      <SummaryCard
        label="Lỗi"
        value={errorCount}
        hint="trang hiện tại"
        tone="bg-red-500/10 text-red-600"
        icon={<AlertCircle className="size-5" />}
      />
      <SummaryCard
        label="Chưa rõ"
        value={unknownCount}
        hint="trang hiện tại"
        tone="bg-amber-500/10 text-amber-600"
        icon={<Clock3 className="size-5" />}
      />
      <SummaryCard
        label="Thủ công"
        value={manualCount}
        hint="trang hiện tại"
        tone="bg-sky-500/10 text-sky-600"
        icon={<Zap className="size-5" />}
      />
    </StatsGrid>
  );
}
