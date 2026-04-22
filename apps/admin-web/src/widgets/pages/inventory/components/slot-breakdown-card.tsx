"use client";

import React from "react";
import {
  Link2, Bookmark, Package, Loader2,
  RefreshCw, ChevronRight, User, AtSign,
} from "lucide-react";
import { useSlotBreakdown, useRecalculateSlots } from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { Button } from "@/shared/ui/button";
import { appToast } from "@/shared/ui/app-toast";
import { cn } from "@/lib/utils";
import type { SlotBreakdownData } from "@/shared/types/inventory";
import { vi } from "@/shared/messages/vi";

interface SlotBreakdownCardProps {
  sourceAccountId: string;
  onScrollToConnections?: () => void;
  onScrollToReserved?: () => void;
}

function BreakdownBar({ data }: { data: SlotBreakdownData }) {
  const text = vi.inventory.page.slotBreakdown;
  const { connectedCount, reservedCount, availableCount, total } = data;
  if (total <= 0) return null;

  const connPct = (connectedCount / total) * 100;
  const resPct = (reservedCount / total) * 100;
  const availPct = (availableCount / total) * 100;

  return (
    <div className="space-y-2">
      {/* Stacked bar */}
      <div className="h-4 rounded-full bg-[var(--border-soft)] overflow-hidden flex">
        {connPct > 0 && (
          <div
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${connPct}%` }}
            title={text.connectedTooltip(connectedCount)}
          />
        )}
        {resPct > 0 && (
          <div
            className="h-full bg-purple-500 transition-all duration-500"
            style={{ width: `${resPct}%` }}
            title={text.reservedTooltip(reservedCount)}
          />
        )}
        {availPct > 0 && (
          <div
            className="h-full bg-emerald-500/30 transition-all duration-500"
            style={{ width: `${availPct}%` }}
            title={text.freeTooltip(availableCount)}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-[var(--fg-muted)]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
          <span>{text.connections} ({connectedCount})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
          <span>{text.reserved} ({reservedCount})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
          <span>{text.free} ({availableCount})</span>
        </div>
      </div>
    </div>
  );
}

export function SlotBreakdownCard({
  sourceAccountId,
  onScrollToConnections,
  onScrollToReserved,
}: SlotBreakdownCardProps) {
  const text = vi.inventory.page.slotBreakdown;
  const { data, isLoading, isError } = useSlotBreakdown(sourceAccountId);
  const { mutateAsync: recalculate, isPending: isRecalculating } = useRecalculateSlots();

  const handleRecalculate = async () => {
    try {
      const result = await recalculate(sourceAccountId);
      if (result.changed) {
        appToast.success(text.recalculated(result.previous, result.recalculated));
      } else {
        appToast.info(text.exact);
      }
    } catch {
      appToast.error(vi.inventory.page.toast.syncError);
    }
  };

  if (isLoading) {
    return (
      <div className="app-card border border-[var(--border-soft)] rounded-[1.15rem] p-5 flex items-center justify-center h-40 bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="app-card border border-[var(--border-soft)] rounded-[1.15rem] p-5 text-center bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <p className="text-sm text-[var(--fg-muted)]">{text.error}</p>
      </div>
    );
  }

  return (
    <div className="app-card border border-[var(--border-soft)] rounded-[1.15rem] overflow-hidden bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-4 py-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-[var(--accent)]" />
          <h4 className="text-[13px] font-bold text-[var(--fg-base)]">{text.title}</h4>
        </div>
        <Button
          size="sm"
          disabled={isRecalculating}
          onClick={handleRecalculate}
          className="text-[11px] h-7 px-2.5 bg-[var(--surface-strong)] text-[var(--fg-muted)] border-[var(--border-soft)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 shadow-none"
        >
          {isRecalculating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          {text.recalculate}
        </Button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={onScrollToConnections}
            className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/60 p-3 text-center transition-colors hover:border-[var(--accent)]/30 hover:bg-white group"
          >
            <Link2 className="w-4 h-4 text-[var(--accent)] mx-auto mb-1" />
            <div className="text-xl font-bold text-[var(--fg-base)]">{data.connectedCount}</div>
            <div className="text-[10px] text-[var(--fg-muted)] group-hover:text-[var(--accent)] transition-colors">{text.connections}</div>
          </button>
          <button
            onClick={onScrollToReserved}
            className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/60 p-3 text-center transition-colors hover:border-purple-400/40 hover:bg-white group"
          >
            <Bookmark className="w-4 h-4 text-purple-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-[var(--fg-base)]">{data.reservedCount}</div>
            <div className="text-[10px] text-[var(--fg-muted)] group-hover:text-purple-500 transition-colors">{text.reserved}</div>
          </button>
          <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/60 p-3 text-center">
            <Package className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-[var(--fg-base)]">{data.availableCount}</div>
            <div className="text-[10px] text-[var(--fg-muted)]">{text.free}</div>
          </div>
        </div>

        {/* Visual breakdown bar */}
        <BreakdownBar data={data} />

        {/* Connected items preview (collapsed, max 3) */}
        {data.connectedItems.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--fg-muted)]">
              {text.connectedLatest}
            </p>
            {data.connectedItems.slice(0, 3).map((item) => (
              <div
                key={item.orderItemId}
                className="flex items-center gap-2 rounded-[0.9rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/70 px-2.5 py-2 text-[11px] text-[var(--fg-muted)]"
              >
                <User className="w-3 h-3 text-[var(--accent)] shrink-0" />
                <span className="text-[var(--fg-base)] font-semibold truncate max-w-[100px]">{item.customerName}</span>
                {item.nickUsed && (
                  <span className="text-[var(--accent)] font-mono bg-[var(--accent)]/10 px-1 rounded text-[10px]">
                    @{item.nickUsed}
                  </span>
                )}
                <span className="text-[var(--border-soft)]">•</span>
                <span className="text-[var(--fg-muted)]">#{item.orderId.split("-")[0]}</span>
                <span className="ml-auto font-bold text-[var(--fg-muted)]">×{item.quantity}</span>
              </div>
            ))}
            {data.connectedItems.length > 3 && (
              <button
                onClick={onScrollToConnections}
                className="w-full text-[11px] text-[var(--accent)] hover:text-[var(--accent-strong)] flex items-center justify-center gap-1 py-1 transition-colors"
              >
                {text.seeAll(data.connectedItems.length)}
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Reserved nicks preview (collapsed, max 4) */}
        {data.reservedNicks.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--fg-muted)]">
              {text.reservedNick}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.reservedNicks.slice(0, 4).map((nick) => (
                <div
                  key={nick}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono",
                    "bg-purple-50 text-purple-600 border border-purple-200"
                  )}
                >
                  <AtSign className="w-2.5 h-2.5" />
                  {nick}
                </div>
              ))}
              {data.reservedNicks.length > 4 && (
                <button
                  onClick={onScrollToReserved}
                  className="text-[11px] text-purple-500 hover:text-purple-400 flex items-center gap-0.5 transition-colors"
                >
                  {text.more(data.reservedNicks.length - 4)}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
