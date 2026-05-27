"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  AtSign,
  BookUser,
  CheckCheck,
  CheckCircle,
  ChevronRight,
  FileText,
  Loader2,
  X,
  Zap,
} from "lucide-react";

import { appToast } from "@/shared/ui/app-toast";
import { fetcher } from "@/lib/api/fetcher";
import { useConnectSourceAccount } from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";
import { INVENTORY_COPY as copy } from "../copy";

interface SmartSuggestion {
  sourceAccountId: string;
  sourceAccountEmail: string;
  orderItemId: string;
  orderItemQuantity: number;
  productNameSnapshot: string;
  customerName: string;
  orderId: string;
  matchedField: "nick_used" | "item_notes" | "registry" | "reserved_nick";
  matchedValue: string;
  confidence?: number;
}

const MATCH_LABEL: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  nick_used: { label: copy.smartMatch.matchLabels.nickUsed, icon: AtSign, color: "text-indigo-400 bg-indigo-500/10" },
  item_notes: { label: copy.smartMatch.matchLabels.itemNotes, icon: FileText, color: "text-amber-400 bg-amber-500/10" },
  registry: { label: copy.smartMatch.matchLabels.registry, icon: BookUser, color: "text-emerald-400 bg-emerald-500/10" },
};

function getConfidenceInfo(confidence?: number) {
  const score = confidence ?? 50;
  if (score >= 80) {
    return { label: copy.smartMatch.confidence.high, color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30", bar: "bg-emerald-400" };
  }
  if (score >= 50) {
    return { label: copy.smartMatch.confidence.medium, color: "text-amber-400 bg-amber-500/15 border-amber-500/30", bar: "bg-amber-400" };
  }
  return { label: copy.smartMatch.confidence.low, color: "text-red-400 bg-red-500/15 border-red-500/30", bar: "bg-red-400" };
}

export function SmartMatchPanel({ onClose }: { onClose: () => void }) {
  const [isScanning, setIsScanning] = useState(false);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[] | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBatchConnecting, setIsBatchConnecting] = useState(false);
  const { mutateAsync: connect, isPending: isConnecting } = useConnectSourceAccount();

  const visible = (suggestions ?? []).filter((item) => !dismissed.has(item.orderItemId));

  const scan = async () => {
    setIsScanning(true);
    setSuggestions(null);
    setSelected(new Set());

    try {
      const res = await fetcher<SmartSuggestion[]>("/api/source-accounts/smart-match");
      setSuggestions(res ?? []);
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : copy.smartMatch.scanError);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnect = async (item: SmartSuggestion) => {
    try {
      await connect({
        sourceAccountId: item.sourceAccountId,
        orderItemId: item.orderItemId,
        quantity: item.orderItemQuantity,
      });
      appToast.success(copy.smartMatch.connected(item.customerName, item.sourceAccountEmail));
      setSuggestions((previous) => previous?.filter((suggestion) => suggestion.orderItemId !== item.orderItemId) ?? previous);
      setSelected((previous) => {
        const next = new Set(previous);
        next.delete(item.orderItemId);
        return next;
      });
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : copy.smartMatch.connectError);
    }
  };

  const handleBatchConnect = async () => {
    const toConnect = visible.filter((item) => selected.has(item.orderItemId));
    if (toConnect.length === 0) return;

    setIsBatchConnecting(true);
    let success = 0;
    let fail = 0;

    for (const item of toConnect) {
      try {
        await connect({
          sourceAccountId: item.sourceAccountId,
          orderItemId: item.orderItemId,
          quantity: item.orderItemQuantity,
        });
        success++;
        setSuggestions((previous) => previous?.filter((suggestion) => suggestion.orderItemId !== item.orderItemId) ?? previous);
      } catch {
        fail++;
      }
    }

    setSelected(new Set());
    setIsBatchConnecting(false);

    if (success > 0) appToast.success(copy.smartMatch.connectedSuccess(success));
    if (fail > 0) appToast.error(copy.smartMatch.connectedFail(fail));
  };

  const dismiss = (id: string) => {
    setDismissed((previous) => new Set([...previous, id]));
    setSelected((previous) => {
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === visible.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(visible.map((item) => item.orderItemId)));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-700/60 bg-[#0d1a30] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-700/50 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/20">
              <Zap className="size-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-100">{copy.smartMatch.title}</h3>
              <p className="text-[11px] text-slate-500">{copy.smartMatch.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {suggestions === null && (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <div className="flex size-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
                <Zap className="size-8 text-amber-400" />
              </div>
              <div className="text-center">
                <p className="mb-1 font-semibold text-slate-200">{copy.smartMatch.emptyTitle}</p>
                <p className="max-w-sm text-sm text-slate-500">{copy.smartMatch.emptyDescription}</p>
              </div>
              <Button
                onClick={scan}
                disabled={isScanning}
                className="h-10 border border-amber-500/40 bg-amber-500/20 px-6 text-amber-400 hover:bg-amber-500/30"
              >
                {isScanning ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Zap className="mr-2 size-4" />}
                {isScanning ? copy.smartMatch.scanning : copy.smartMatch.scan}
              </Button>
            </div>
          )}

          {suggestions !== null && visible.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <CheckCircle className="size-12 text-emerald-400" />
              <p className="font-semibold text-slate-200">{copy.smartMatch.emptyResultTitle}</p>
              <p className="text-sm text-slate-500">{copy.smartMatch.emptyResultDescription}</p>
              <Button
                onClick={scan}
                disabled={isScanning}
                className="mt-2 h-8 border border-slate-700 bg-slate-800/50 px-4 text-sm text-slate-400 hover:text-slate-200"
              >
                {isScanning ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
                {copy.smartMatch.rescans}
              </Button>
            </div>
          )}

          {visible.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-slate-700/40 bg-slate-800/40 p-2.5">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-200"
              >
                <div
                  className={cn(
                    "flex size-4 items-center justify-center rounded border transition-colors",
                    selected.size === visible.length && visible.length > 0
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-slate-600 hover:border-slate-400",
                  )}
                >
                  {selected.size === visible.length && visible.length > 0 ? <CheckCheck className="size-3 text-white" /> : null}
                </div>
                {selected.size === visible.length ? copy.smartMatch.deselectAll : copy.smartMatch.selectAll}
              </button>

              {selected.size > 0 && (
                <Button
                  size="sm"
                  disabled={isBatchConnecting || isConnecting}
                  onClick={handleBatchConnect}
                  className="h-7 border border-indigo-500/30 bg-indigo-500/20 px-3 text-[11px] text-indigo-400 hover:bg-indigo-500/30"
                >
                  {isBatchConnecting ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <CheckCheck className="mr-1 size-3.5" />}
                  {copy.smartMatch.connectSelected(selected.size)}
                </Button>
              )}
            </div>
          )}

          {visible.map((item) => {
            const matchMeta =
              MATCH_LABEL[item.matchedField] ?? {
                label: copy.smartMatch.matchLabels.reservedNick,
                icon: CheckCircle,
                color: "text-emerald-400 bg-emerald-500/10",
              };
            const MatchIcon = matchMeta.icon;
            const confidence = getConfidenceInfo(item.confidence);
            const isSelected = selected.has(item.orderItemId);

            return (
              <div
                key={item.orderItemId}
                className={cn(
                  "flex items-start gap-3 rounded-xl border bg-slate-800/40 p-4 transition-colors",
                  isSelected ? "border-indigo-500/50 bg-indigo-900/20" : "border-slate-700/50 hover:border-slate-600/60",
                )}
              >
                <button
                  onClick={() => toggleSelect(item.orderItemId)}
                  className={cn(
                    "mt-1 flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                    isSelected ? "border-indigo-500 bg-indigo-500" : "border-slate-600 hover:border-slate-400",
                  )}
                >
                  {isSelected ? <CheckCircle className="size-3.5 text-white" /> : null}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="max-w-[140px] truncate font-semibold text-slate-200">{item.customerName}</span>
                    <ChevronRight className="size-3.5 shrink-0 text-slate-600" />
                    <span className="max-w-[160px] truncate font-semibold text-indigo-300">{item.sourceAccountEmail}</span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span>#{item.orderId.split("-")[0]}</span>
                    <span>•</span>
                    <span className="max-w-[140px] truncate">{item.productNameSnapshot}</span>
                    <span>•</span>
                    <span className="font-bold text-slate-400">SL: {item.orderItemQuantity}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold", matchMeta.color)}>
                      <MatchIcon className="size-3" />
                      {matchMeta.label}: <span className="font-mono">{item.matchedValue}</span>
                    </div>
                    <div className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold", confidence.color)}>
                      <div className="h-1.5 w-8 overflow-hidden rounded-full bg-slate-700">
                        <div
                          className={cn("h-full rounded-full transition-[background-color,border-color,box-shadow,color,opacity,transform,width]", confidence.bar)}
                          style={{ width: `${item.confidence ?? 50}%` }}
                        />
                      </div>
                      {confidence.label} ({item.confidence ?? 50}%)
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-1.5">
                  <Button
                    size="sm"
                    disabled={isConnecting || isBatchConnecting}
                    onClick={() => handleConnect(item)}
                    className="h-8 border border-indigo-500/30 bg-indigo-500/20 px-3 text-[11px] text-indigo-400 hover:bg-indigo-500/30"
                  >
                    <CheckCircle className="mr-1 size-3.5" />
                    {copy.smartMatch.connect}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => dismiss(item.orderItemId)}
                    className="h-8 border-slate-700 bg-slate-800/50 px-3 text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    <AlertCircle className="mr-1 size-3.5" />
                    {copy.smartMatch.dismiss}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
          <span className="text-[11px] text-slate-500">
            {copy.smartMatch.title}
          </span>
          <Button variant="secondary" onClick={onClose} className="h-8 border-slate-700 bg-slate-800/50 px-4 text-[11px] text-slate-300 hover:text-slate-100">
            {copy.close}
          </Button>
        </div>
      </div>
    </div>
  );
}
