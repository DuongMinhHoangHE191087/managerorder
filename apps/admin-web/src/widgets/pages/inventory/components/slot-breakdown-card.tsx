"use client";

import React from "react";
import {
  AtSign,
  Bookmark,
  ChevronRight,
  Link2,
  Loader2,
  Package,
  RefreshCw,
  User,
} from "lucide-react";
import { useRecalculateSlots, useSlotBreakdown } from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { Button } from "@/shared/ui/button";
import { appToast } from "@/shared/ui/app-toast";
import { cn } from "@/lib/utils";
import type { SlotBreakdownData } from "@/shared/types/inventory";
import { INVENTORY_COPY as copy } from "../copy";

interface SlotBreakdownCardProps {
  sourceAccountId: string;
  onScrollToConnections?: () => void;
  onScrollToReserved?: () => void;
}

const ITEM_SEPARATOR = "•";

function BreakdownBar({ data }: { data: SlotBreakdownData }) {
  const text = copy.page.slotBreakdown;
  const { connectedCount, reservedCount, availableCount, total } = data;

  if (total <= 0) {
    return null;
  }

  const connPct = (connectedCount / total) * 100;
  const resPct = (reservedCount / total) * 100;
  const availPct = (availableCount / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex h-4 overflow-hidden rounded-full bg-[var(--border-soft)]">
        {connPct > 0 ? (
          <div
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${connPct}%` }}
            title={text.connectedTooltip(connectedCount)}
          />
        ) : null}
        {resPct > 0 ? (
          <div
            className="h-full bg-purple-500 transition-all duration-500"
            style={{ width: `${resPct}%` }}
            title={text.reservedTooltip(reservedCount)}
          />
        ) : null}
        {availPct > 0 ? (
          <div
            className="h-full bg-emerald-500/30 transition-all duration-500"
            style={{ width: `${availPct}%` }}
            title={text.freeTooltip(availableCount)}
          />
        ) : null}
      </div>

      <div className="flex items-center gap-4 text-[11px] text-[var(--fg-muted)]">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
          <span>
            {text.connections} ({connectedCount})
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-purple-500" />
          <span>
            {text.reserved} ({reservedCount})
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/40" />
          <span>
            {text.free} ({availableCount})
          </span>
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
  const text = copy.page.slotBreakdown;
  const { data, isLoading, isError } = useSlotBreakdown(sourceAccountId);
  const { mutateAsync: recalculate, isPending: isRecalculating } = useRecalculateSlots();

  const handleRecalculate = async () => {
    try {
      const result = await recalculate(sourceAccountId);

      if (result.changed) {
        appToast.success(text.recalculated(result.previous, result.recalculated));
        return;
      }

      appToast.info(text.exact);
    } catch {
      appToast.error(copy.page.toast.syncError);
    }
  };

  if (isLoading) {
    return (
      <div className="app-card flex h-40 items-center justify-center rounded-[1.15rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="app-card rounded-[1.15rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-5 text-center shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <p className="text-sm text-[var(--fg-muted)]">{text.error}</p>
      </div>
    );
  }

  return (
    <div className="app-card overflow-hidden rounded-[1.15rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-4 py-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-[var(--accent)]" />
          <h4 className="text-[13px] font-bold text-[var(--fg-base)]">{text.title}</h4>
        </div>
        <Button
          size="sm"
          disabled={isRecalculating}
          onClick={handleRecalculate}
          className="h-7 border-[var(--border-soft)] bg-[var(--surface-strong)] px-2.5 text-[11px] text-[var(--fg-muted)] shadow-none hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]"
        >
          {isRecalculating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
          {text.recalculate}
        </Button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={onScrollToConnections}
            className="group rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/60 p-3 text-center transition-colors hover:border-[var(--accent)]/30 hover:bg-white"
          >
            <Link2 className="mx-auto mb-1 h-4 w-4 text-[var(--accent)]" />
            <div className="text-xl font-bold text-[var(--fg-base)]">{data.connectedCount}</div>
            <div className="text-[10px] text-[var(--fg-muted)] transition-colors group-hover:text-[var(--accent)]">
              {text.connections}
            </div>
          </button>
          <button
            type="button"
            onClick={onScrollToReserved}
            className="group rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/60 p-3 text-center transition-colors hover:border-purple-400/40 hover:bg-white"
          >
            <Bookmark className="mx-auto mb-1 h-4 w-4 text-purple-500" />
            <div className="text-xl font-bold text-[var(--fg-base)]">{data.reservedCount}</div>
            <div className="text-[10px] text-[var(--fg-muted)] transition-colors group-hover:text-purple-500">
              {text.reserved}
            </div>
          </button>
          <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/60 p-3 text-center">
            <Package className="mx-auto mb-1 h-4 w-4 text-emerald-500" />
            <div className="text-xl font-bold text-[var(--fg-base)]">{data.availableCount}</div>
            <div className="text-[10px] text-[var(--fg-muted)]">{text.free}</div>
          </div>
        </div>

        <BreakdownBar data={data} />

        {data.connectedItems.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              {text.connectedLatest}
            </p>
            {data.connectedItems.slice(0, 3).map((item) => (
              <div
                key={item.orderItemId}
                className="flex items-center gap-2 rounded-[0.9rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/70 px-2.5 py-2 text-[11px] text-[var(--fg-muted)]"
              >
                <User className="h-3 w-3 shrink-0 text-[var(--accent)]" />
                <span className="max-w-[100px] truncate font-semibold text-[var(--fg-base)]">{item.customerName}</span>
                {item.nickUsed ? (
                  <span className="rounded bg-[var(--accent)]/10 px-1 text-[10px] font-mono text-[var(--accent)]">
                    @{item.nickUsed}
                  </span>
                ) : null}
                <span className="text-[var(--border-soft)]">{ITEM_SEPARATOR}</span>
                <span className="text-[var(--fg-muted)]">#{item.orderId.split("-")[0]}</span>
                <span className="ml-auto font-bold text-[var(--fg-muted)]">x{item.quantity}</span>
              </div>
            ))}
            {data.connectedItems.length > 3 ? (
              <button
                type="button"
                onClick={onScrollToConnections}
                className="flex w-full items-center justify-center gap-1 py-1 text-[11px] text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)]"
              >
                {text.seeAll(data.connectedItems.length)}
                <ChevronRight className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        ) : null}

        {data.reservedNicks.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              {text.reservedNick}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.reservedNicks.slice(0, 4).map((nick) => (
                <div
                  key={nick}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-mono text-purple-600",
                  )}
                >
                  <AtSign className="h-2.5 w-2.5" />
                  {nick}
                </div>
              ))}
              {data.reservedNicks.length > 4 ? (
                <button
                  type="button"
                  onClick={onScrollToReserved}
                  className="flex items-center gap-0.5 text-[11px] text-purple-500 transition-colors hover:text-purple-400"
                >
                  {text.more(data.reservedNicks.length - 4)}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
