"use client";

import { ArrowRightLeft, FileText, Loader2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { StatsGrid } from "@/shared/ui/page-layout";
import type { MigrationStatus } from "../types";
import { PREMIUM_MIGRATION_COPY as copy } from "../copy";

function StatusCard({
  label,
  count,
  description,
  accent,
  icon,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  description: string;
  accent: string;
  icon: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-5 text-left shadow-sm transition-[background-color,border-color,box-shadow,color,opacity,transform,width] ${
        selected
          ? `${accent} ring-2 ring-[var(--ring)]`
          : "border-[var(--border-soft)] bg-white hover:border-[var(--accent)]/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{label}</p>
        <span className="text-[var(--accent)]">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-black text-[var(--accent)]">{count}</p>
    </button>
  );
}

export function MigrationStatusCards({
  selectedStatus,
  pendingCount,
  inProgressCount,
  completedCount,
  failedCount,
  onStatusChange,
}: {
  selectedStatus: MigrationStatus;
  pendingCount: number;
  inProgressCount: number;
  completedCount: number;
  failedCount: number;
  onStatusChange: (status: MigrationStatus) => void;
}) {
  return (
    <StatsGrid className="grid gap-4 py-6 md:grid-cols-2 xl:grid-cols-4">
      <StatusCard
        label={copy.statusCards.pending.label}
        count={pendingCount}
        description={copy.statusCards.pending.description}
        accent="border-[#ff9500] bg-[#ff9500]/5"
        icon={<ArrowRightLeft className="size-4 text-[#ff9500]" />}
        selected={selectedStatus === "pending"}
        onClick={() => onStatusChange("pending")}
      />
      <StatusCard
        label={copy.statusCards.inProgress.label}
        count={inProgressCount}
        description={copy.statusCards.inProgress.description}
        accent="border-[var(--accent)] bg-[var(--accent)]/5"
        icon={<Loader2 className="size-4 text-[var(--accent)]" />}
        selected={selectedStatus === "in_progress"}
        onClick={() => onStatusChange("in_progress")}
      />
      <StatusCard
        label={copy.statusCards.completed.label}
        count={completedCount}
        description={copy.statusCards.completed.description}
        accent="border-[#32d74b] bg-[#32d74b]/5"
        icon={<Sparkles className="size-4 text-[#32d74b]" />}
        selected={selectedStatus === "completed"}
        onClick={() => onStatusChange("completed")}
      />
      <StatusCard
        label={copy.statusCards.failed.label}
        count={failedCount}
        description={copy.statusCards.failed.description}
        accent="border-[var(--danger)] bg-[var(--danger)]/5"
        icon={<FileText className="size-4 text-[var(--danger)]" />}
        selected={selectedStatus === "failed"}
        onClick={() => onStatusChange("failed")}
      />
    </StatsGrid>
  );
}
