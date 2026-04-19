"use client";

import React, { useMemo } from "react";
import {
  AlertTriangle, Bell, Search, ListFilter,
  RefreshCw, CheckCircle2, Trash2,
} from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";

import {
  ScaleButton,
  StaggerContainer,
  StaggerItem,
} from "@/shared/ui/animations";
import { RenewalCard, RenewalEmptyState } from "@/widgets/pages/calendar/components/renewal-card";
import type { RenewalItem } from "@/shared/types/premium";

/* ─── Constants ─────────────────────────────────────────────────────── */

const URGENCY_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "expired", label: "Hết hạn" },
  { key: "3d", label: "≤ 3 ngày" },
  { key: "7d", label: "≤ 7 ngày" },
  { key: "30d", label: "≤ 30 ngày" },
] as const;
type UrgencyKey = (typeof URGENCY_TABS)[number]["key"];

/* ─── Props ─────────────────────────────────────────────────────────── */

interface RenewalPanelProps {
  renewals: RenewalItem[];
  isLoading: boolean;
  error: string | null;
  onRefetch: () => void;
  onRequestRenewal: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
  onManualCancel: (id: string) => void;
}

/* ─── Component ─────────────────────────────────────────────────────── */

export const RenewalPanel = React.memo(function RenewalPanel({
  renewals,
  isLoading,
  error,
  onRefetch,
  onRequestRenewal,
  onMarkAsPaid,
  onManualCancel,
}: RenewalPanelProps) {
  const [renewalSearch, setRenewalSearch] = React.useState("");
  const [urgencyFilter, setUrgencyFilter] = React.useState<UrgencyKey>("all");

  // Urgency stats
  const stats = useMemo(() => ({
    expired: renewals.filter(i => i.days_remaining <= 0).length,
    urgent: renewals.filter(i => i.days_remaining > 0 && i.days_remaining <= 3).length,
    soon: renewals.filter(i => i.days_remaining > 3 && i.days_remaining <= 7).length,
    total: renewals.length,
  }), [renewals]);

  // Filtered list
  const filteredRenewals = useMemo(() => {
    let items = renewals;

    if (urgencyFilter === "expired") items = items.filter(i => i.days_remaining <= 0);
    else if (urgencyFilter === "3d") items = items.filter(i => i.days_remaining > 0 && i.days_remaining <= 3);
    else if (urgencyFilter === "7d") items = items.filter(i => i.days_remaining > 0 && i.days_remaining <= 7);
    else if (urgencyFilter === "30d") items = items.filter(i => i.days_remaining > 0 && i.days_remaining <= 30);

    const q = renewalSearch.trim().toLowerCase();
    if (q) {
      items = items.filter(
        i =>
          i.customer_name?.toLowerCase().includes(q) ||
          i.customer_email?.toLowerCase().includes(q) ||
          i.service_name?.toLowerCase().includes(q) ||
          i.package_name?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [renewals, urgencyFilter, renewalSearch]);

  return (
    <div className="glass-card rounded-xl border border-[var(--border-soft)] bg-white overflow-hidden flex flex-col flex-1" style={{ minHeight: 320 }}>
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border-soft)] bg-[var(--bg-app)]/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-[#ff9500]" />
          <h3 className="text-[13px] font-black text-[var(--fg-base)]">Sắp gia hạn</h3>
          {stats.total > 0 && (
            <span className="text-[10px] font-black bg-[#ff9500]/15 text-[#ff9500] px-2 py-0.5 rounded-full">
              {stats.total}
            </span>
          )}
        </div>
        <ScaleButton
          onClick={onRefetch}
          aria-label="Tải lại"
          className="p-1.5 rounded-lg hover:bg-[var(--surface-light)] transition-colors cursor-pointer"
        >
          <RefreshCw className={`size-3.5 text-[var(--fg-muted)] ${isLoading ? "animate-spin" : ""}`} />
        </ScaleButton>
      </div>

      {/* Quick Action Summary Row */}
      <div className="flex gap-2 px-3 py-2 bg-[var(--surface-light)] border-b border-[var(--border-soft)] shrink-0 overflow-x-auto">
         <button onClick={() => appToast.success("Đã gửi thông báo đến 14 KH sắp hết hạn")} className="shrink-0 text-[10px] font-bold px-2 py-1 bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer">
           <Bell className="size-3" /> Gửi nhắc nhở hàng loạt
         </button>
         <button onClick={() => appToast.info("Tính năng kết xuất danh sách (Demo)")} className="shrink-0 text-[10px] font-bold px-2 py-1 bg-[var(--surface-strong)] text-[var(--fg-base)] hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer">
           Export Excel
         </button>
      </div>

      {/* Urgency filter tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-[var(--border-soft)] shrink-0 overflow-x-auto">
        {URGENCY_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setUrgencyFilter(tab.key)}
            className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
              urgencyFilter === tab.key
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--fg-muted)] hover:bg-[var(--surface-light)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-[var(--border-soft)] shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-[var(--fg-muted)]" />
          <input
            type="search"
            value={renewalSearch}
            onChange={e => setRenewalSearch(e.target.value)}
            placeholder="Tìm khách hàng, dịch vụ..."
            className="w-full pl-7 pr-3 py-1.5 bg-[var(--bg-app)]/50 border border-[var(--border-soft)] rounded-lg text-[11px] outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[92px] rounded-xl bg-[var(--surface-light)] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
            <AlertTriangle className="size-8 text-[var(--danger)] opacity-60" />
            <p className="text-[12px] font-bold text-[var(--danger)]">{error}</p>
            <button
              onClick={onRefetch}
              className="text-[11px] text-[var(--accent)] hover:underline cursor-pointer mt-1"
            >
              Thử lại
            </button>
          </div>
        ) : filteredRenewals.length === 0 ? (
          <RenewalEmptyState />
        ) : (
          <StaggerContainer staggerDelay={0.04} className="space-y-2">
            {filteredRenewals.map(item => (
              <StaggerItem key={item.id}>
                <div className="relative group">
                  <RenewalCard item={item} onRequestRenewal={onRequestRenewal} />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                     <button onClick={() => onMarkAsPaid(item.id)} title="Đánh dấu đã thanh toán" className="p-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-md cursor-pointer"><CheckCircle2 className="size-3" /></button>
                     <button onClick={() => onManualCancel(item.id)} title="Hủy & Xóa" className="p-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-md cursor-pointer"><Trash2 className="size-3" /></button>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>

      {/* Footer count */}
      {filteredRenewals.length > 0 && !isLoading && (
        <div className="px-4 py-2 border-t border-[var(--border-soft)] shrink-0">
          <p className="text-[10px] text-[var(--fg-muted)] font-medium flex items-center gap-1">
            <ListFilter className="size-3" />
            Hiển thị {filteredRenewals.length} / {renewals.length} subscriptions
          </p>
        </div>
      )}
    </div>
  );
});
