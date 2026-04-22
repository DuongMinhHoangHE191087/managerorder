"use client";

import React, { useState } from "react";
import { Loader2, Zap, X, AtSign, FileText, BookUser, CheckCircle, ChevronRight, CheckCheck } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { fetcher } from "@/lib/api/fetcher";
import { useConnectSourceAccount } from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

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
  nick_used:  { label: "Nick đã dùng",   icon: AtSign,    color: "text-indigo-400 bg-indigo-500/10" },
  item_notes: { label: "Ghi chú đơn",    icon: FileText,  color: "text-amber-400 bg-amber-500/10" },
  registry:   { label: "Danh bạ nick",   icon: BookUser,  color: "text-emerald-400 bg-emerald-500/10" },
};

function getConfidenceInfo(confidence?: number) {
  const score = confidence ?? 50;
  if (score >= 80) return { label: "Cao", color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30", bar: "bg-emerald-400" };
  if (score >= 50) return { label: "Trung bình", color: "text-amber-400 bg-amber-500/15 border-amber-500/30", bar: "bg-amber-400" };
  return { label: "Thấp", color: "text-red-400 bg-red-500/15 border-red-500/30", bar: "bg-red-400" };
}

export function SmartMatchPanel({ onClose }: { onClose: () => void }) {
  const [isScanning, setIsScanning] = useState(false);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[] | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBatchConnecting, setIsBatchConnecting] = useState(false);
  const { mutateAsync: connect, isPending: isConnecting } = useConnectSourceAccount();

  const scan = async () => {
    setIsScanning(true);
    setSuggestions(null);
    setSelected(new Set());
    try {
      const res = await fetcher<SmartSuggestion[]>("/api/source-accounts/smart-match");
      setSuggestions(res ?? []);
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : "Quét thất bại");
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnect = async (s: SmartSuggestion) => {
    try {
      await connect({ sourceAccountId: s.sourceAccountId, orderItemId: s.orderItemId, quantity: s.orderItemQuantity });
      appToast.success(`Đã kết nối ${s.customerName} ↔ ${s.sourceAccountEmail}`);
      setSuggestions(prev => prev ? prev.filter(p => p.orderItemId !== s.orderItemId) : prev);
      setSelected(prev => { const next = new Set(prev); next.delete(s.orderItemId); return next; });
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : "Kết nối thất bại");
    }
  };

  const handleBatchConnect = async () => {
    const toConnect = visible.filter(s => selected.has(s.orderItemId));
    if (toConnect.length === 0) return;

    setIsBatchConnecting(true);
    let success = 0;
    let fail = 0;

    for (const s of toConnect) {
      try {
        await connect({ sourceAccountId: s.sourceAccountId, orderItemId: s.orderItemId, quantity: s.orderItemQuantity });
        success++;
        setSuggestions(prev => prev ? prev.filter(p => p.orderItemId !== s.orderItemId) : prev);
      } catch {
        fail++;
      }
    }

    setSelected(new Set());
    setIsBatchConnecting(false);

    if (success > 0) appToast.success(`Đã kết nối thành công ${success} gợi ý`);
    if (fail > 0) appToast.error(`${fail} gợi ý kết nối thất bại`);
  };

  const dismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === visible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map(s => s.orderItemId)));
    }
  };

  const visible = (suggestions ?? []).filter(s => !dismissed.has(s.orderItemId));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-2xl bg-[#0d1a30] border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-100">Quét Gợi Ý Kết Nối Thông Minh</h3>
              <p className="text-[11px] text-slate-500">
                So khớp nick / ghi chú đơn hàng với email / ghi chú kho hàng
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 custom-scrollbar">

          {/* Scan CTA */}
          {suggestions === null && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Zap className="w-8 h-8 text-amber-400" />
              </div>
              <div className="text-center">
                <p className="text-slate-200 font-semibold mb-1">Chưa có kết quả</p>
                <p className="text-slate-500 text-sm max-w-sm">
                  Nhấn nút bên dưới để hệ thống quét và so khớp tự động các đơn hàng
                  chưa kết nối với kho hàng phù hợp.
                </p>
              </div>
              <Button
                onClick={scan}
                disabled={isScanning}
                className="bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 px-6 h-10"
              >
                {isScanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                {isScanning ? "Đang quét..." : "Quét ngay"}
              </Button>
            </div>
          )}

          {/* Empty result */}
          {suggestions !== null && visible.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400" />
              <p className="text-slate-200 font-semibold">Không tìm thấy gợi ý nào</p>
              <p className="text-slate-500 text-sm">Tất cả đơn hàng đã được kết nối hoặc không có nick/ghi chú khớp với kho.</p>
              <Button onClick={scan} disabled={isScanning} className="mt-2 text-sm bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-slate-200 h-8 px-4">
                {isScanning ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : "Quét lại"}
              </Button>
            </div>
          )}

          {/* Batch select bar */}
          {visible.length > 0 && (
            <div className="flex items-center justify-between p-2.5 bg-slate-800/40 border border-slate-700/40 rounded-lg">
              <button
                onClick={toggleSelectAll}
                className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
              >
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                  selected.size === visible.length && visible.length > 0
                    ? "bg-indigo-500 border-indigo-500"
                    : "border-slate-600 hover:border-slate-400"
                )}>
                  {selected.size === visible.length && visible.length > 0 && <CheckCheck className="w-3 h-3 text-white" />}
                </div>
                {selected.size === visible.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
              {selected.size > 0 && (
                <Button
                  size="sm"
                  disabled={isBatchConnecting || isConnecting}
                  onClick={handleBatchConnect}
                  className="text-[11px] h-7 px-3 bg-indigo-500/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/30 shadow-none"
                >
                  {isBatchConnecting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5 mr-1" />}
                  Kết nối {selected.size} mục
                </Button>
              )}
            </div>
          )}

          {/* Suggestions */}
          {visible.map(s => {
            const matchMeta =
              MATCH_LABEL[s.matchedField] ??
              {
                label: "Nick đã giữ",
                icon: CheckCircle,
                color: "text-emerald-400 bg-emerald-500/10",
              };
            const MatchIcon = matchMeta.icon;
            const conf = getConfidenceInfo(s.confidence);
            const isSelected = selected.has(s.orderItemId);

            return (
              <div key={s.orderItemId} className={cn(
                "bg-slate-800/40 border rounded-xl p-4 flex items-start gap-3 transition-colors",
                isSelected ? "border-indigo-500/50 bg-indigo-900/20" : "border-slate-700/50 hover:border-slate-600/60"
              )}>
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelect(s.orderItemId)}
                  className={cn(
                    "w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-1 transition-colors",
                    isSelected ? "bg-indigo-500 border-indigo-500" : "border-slate-600 hover:border-slate-400"
                  )}
                >
                  {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                </button>

                <div className="flex-1 min-w-0">
                  {/* Connection pair */}
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="font-semibold text-slate-200 truncate max-w-[140px]">{s.customerName}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <span className="font-semibold text-indigo-300 truncate max-w-[160px]">{s.sourceAccountEmail}</span>
                  </div>

                  {/* Details row */}
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                    <span>#{s.orderId.split("-")[0]}</span>
                    <span>•</span>
                    <span className="truncate max-w-[140px]">{s.productNameSnapshot}</span>
                    <span>•</span>
                    <span className="font-bold text-slate-400">SL: {s.orderItemQuantity}</span>
                  </div>

                  {/* Match badge + confidence */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <div className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md", matchMeta.color)}>
                      <MatchIcon className="w-3 h-3" />
                      {matchMeta.label}: <span className="font-mono">{s.matchedValue}</span>
                    </div>
                    <div className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border", conf.color)}>
                      <div className="w-8 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", conf.bar)} style={{ width: `${s.confidence ?? 50}%` }} />
                      </div>
                      {conf.label} ({s.confidence ?? 50}%)
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    disabled={isConnecting || isBatchConnecting}
                    onClick={() => handleConnect(s)}
                    className="text-[11px] h-8 px-3 bg-indigo-500/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/30 shadow-none"
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    Kết nối
                  </Button>
                  <button
                    onClick={() => dismiss(s.orderItemId)}
                    className="text-[11px] text-slate-500 hover:text-slate-300 text-center py-0.5 transition-colors"
                  >
                    Bỏ qua
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between">
          {suggestions !== null && visible.length > 0 && (
            <Button onClick={scan} disabled={isScanning} className="text-[12px] h-8 px-3 bg-slate-800/60 border border-slate-700 text-slate-400 hover:text-slate-200 shadow-none">
              {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
              Quét lại
            </Button>
          )}
          <div className="ml-auto">
            {visible.length > 0 && <span className="text-[11px] text-slate-500 mr-4">{visible.length} gợi ý</span>}
            <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Đóng</button>
          </div>
        </div>
      </div>
    </div>
  );
}
