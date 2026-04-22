"use client";

import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";
import { useBotRuntimeStatus } from "@/shared/hooks/use-bot-runtime-status";

function resolveRuntimeLabel(runtimeMode?: string) {
  switch (runtimeMode) {
    case "webhook-first":
      return vi.bot.statusGrid.runtime.webhookFirst;
    case "polling-fallback":
      return vi.bot.statusGrid.runtime.pollingFallback;
    case "inactive":
      return vi.bot.statusGrid.runtime.inactive;
    default:
      return vi.common.loadingData;
  }
}

function resolveHealthLabel({
  broadcastReady,
  tenantAligned,
  runtimeHealthy,
}: {
  broadcastReady?: boolean;
  tenantAligned?: boolean;
  runtimeHealthy?: boolean;
}) {
  if (runtimeHealthy === false) {
    return vi.bot.statusGrid.runtime.runtimeStale;
  }

  if (broadcastReady) {
    return vi.bot.statusGrid.runtime.broadcastReady;
  }

  if (tenantAligned === false) {
    return vi.bot.statusGrid.readiness.mismatch;
  }

  return vi.bot.statusGrid.runtime.notReady;
}

function resolveTone({
  broadcastReady,
  runtimeMode,
}: {
  broadcastReady?: boolean;
  runtimeMode?: string;
}) {
  if (broadcastReady) {
    return "text-[var(--accent)]";
  }

  if (runtimeMode === "inactive") {
    return "text-[var(--fg-muted)]";
  }

  return "text-[#d97706]";
}

export function RuntimeStatusChip() {
  const { data: status, isLoading } = useBotRuntimeStatus();

  const runtimeMode = status?.operational.runtimeMode;
  const runtimeLabel = isLoading && !status ? vi.common.loadingData : resolveRuntimeLabel(runtimeMode);
  const healthLabel = isLoading && !status
    ? vi.bot.statusGrid.runtime.notReady
    : resolveHealthLabel({
        broadcastReady: status?.operational.broadcastReady,
        tenantAligned: status?.operational.tenantAligned,
        runtimeHealthy: status?.operational.runtimeHealthy,
      });

  return (
    <div className="mt-4 flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[linear-gradient(135deg,rgba(var(--accent-rgb),0.08),rgba(255,255,255,0.92))] px-3 py-2 text-[11px] font-semibold text-[var(--fg-base)] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <ShieldCheck className={cn("size-3.5 shrink-0", resolveTone({ broadcastReady: status?.operational.broadcastReady, runtimeMode }))} />
      <span className="min-w-0 truncate">
        {runtimeLabel} • {healthLabel}
      </span>
    </div>
  );
}
