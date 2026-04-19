"use client";

import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBotRuntimeStatus } from "@/shared/hooks/use-bot-runtime-status";

function resolveRuntimeLabel(runtimeMode?: string) {
  switch (runtimeMode) {
    case "webhook-first":
      return "Webhook-first";
    case "polling-fallback":
      return "Polling fallback";
    case "inactive":
      return "Bot inactive";
    default:
      return "Runtime check";
  }
}

function resolveHealthLabel({
  broadcastReady,
  tenantAligned,
}: {
  broadcastReady?: boolean;
  tenantAligned?: boolean;
}) {
  if (broadcastReady) {
    return "Broadcast ready";
  }

  if (tenantAligned === false) {
    return "Check tenant";
  }

  return "Needs setup";
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
  const { data: status, isLoading, isFetching } = useBotRuntimeStatus();

  const runtimeMode = status?.operational.runtimeMode;
  const runtimeLabel = isLoading && !status ? "Checking runtime" : resolveRuntimeLabel(runtimeMode);
  const healthLabel = isLoading && !status
    ? "Syncing"
    : resolveHealthLabel({
        broadcastReady: status?.operational.broadcastReady,
        tenantAligned: status?.operational.tenantAligned,
      });

  return (
    <div className="mt-4 flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[linear-gradient(135deg,rgba(var(--accent-rgb),0.08),rgba(255,255,255,0.92))] px-3 py-2 text-[11px] font-semibold text-[var(--fg-base)] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <ShieldCheck className={cn("size-3.5 shrink-0", resolveTone({ broadcastReady: status?.operational.broadcastReady, runtimeMode }))} />
      <span className="min-w-0 truncate">
        {runtimeLabel} • {healthLabel}
        {isFetching && status ? " • Syncing" : ""}
      </span>
    </div>
  );
}
