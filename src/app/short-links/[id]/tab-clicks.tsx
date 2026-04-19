"use client";

import { useState, useMemo, useCallback, memo } from "react";
import {
  List, Eye, Download, Search, Loader2, Globe, CheckCircle2,
  AlertTriangle, Monitor, Smartphone, Bot,
} from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import type { TabProps, ClickRecord } from "./detail-types";
import { timeAgo, formatDate, extractBrowser } from "./detail-types";

type ClickDeviceFilter = "all" | "desktop" | "mobile" | "tablet" | "bot";
type ClickStatusFilter = "all" | "clean" | "suspicious";

const DEVICE_ICONS: Record<string, typeof Monitor> = {
  desktop: Monitor, mobile: Smartphone, tablet: Smartphone, bot: Bot,
};

/** Export click data to CSV */
function exportClicksCSV(clicks: ClickRecord[], slug: string) {
  const headers = ["Thời gian", "IP", "Thiết bị", "Trình duyệt", "Nguồn", "Trạng thái", "Lý do"];
  const rows = clicks.map(c => [
    formatDate(c.clicked_at),
    c.ip_address,
    c.device_type || "unknown",
    extractBrowser(c.user_agent),
    c.referer || "direct",
    c.is_suspicious ? "suspicious" : "clean",
    c.suspicious_reason || "",
  ]);
  const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `clicks_${slug}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function ClicksTab({ link, clicks, isLoading }: TabProps) {
  const [expandedClickId, setExpandedClickId] = useState<string | null>(null);
  const [clickDeviceFilter, setClickDeviceFilter] = useState<ClickDeviceFilter>("all");
  const [clickStatusFilter, setClickStatusFilter] = useState<ClickStatusFilter>("all");
  const [clickSearch, setClickSearch] = useState("");

  const filteredClicks = useMemo(() => {
    let result = clicks;
    if (clickDeviceFilter !== "all") result = result.filter(c => c.device_type === clickDeviceFilter);
    if (clickStatusFilter === "clean") result = result.filter(c => !c.is_suspicious);
    if (clickStatusFilter === "suspicious") result = result.filter(c => c.is_suspicious);
    if (clickSearch.trim()) {
      const q = clickSearch.toLowerCase();
      result = result.filter(c => c.ip_address?.toLowerCase().includes(q) || c.user_agent?.toLowerCase().includes(q));
    }
    return result;
  }, [clicks, clickDeviceFilter, clickStatusFilter, clickSearch]);

  const handleExportCSV = useCallback(() => {
    if (clicks.length === 0) return;
    exportClicksCSV(clicks, link.slug);
    appToast.success(`Exported ${clicks.length} clicks to CSV`);
  }, [clicks, link.slug]);

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl shadow-sm overflow-hidden border border-[var(--border-soft)]">
      <div className="p-5 border-b border-[var(--border-soft)]">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[15px] font-bold text-[var(--fg-base)] flex items-center gap-2">
            <List className="text-blue-500 size-5" />
            Chi tiết lượt click
          </h3>
          <div className="flex items-center gap-2">
            <span className="bg-blue-500/10 text-blue-500 text-[11px] font-bold px-2.5 py-1 rounded-full">
              {filteredClicks.length}/{clicks.length}
            </span>
            <button onClick={handleExportCSV} disabled={clicks.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-30"
            >
              <Download className="size-3" /> CSV
            </button>
          </div>
        </div>
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--fg-muted)]" />
            <input
              type="text" placeholder="Tìm IP hoặc UA..."
              value={clickSearch} onChange={e => setClickSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-[var(--border-soft)] text-[12px] text-[var(--fg-base)] focus:ring-2 focus:ring-blue-500/30 outline-none"
            />
          </div>
          <select value={clickDeviceFilter} onChange={e => setClickDeviceFilter(e.target.value as ClickDeviceFilter)}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-[var(--border-soft)] text-[12px] font-bold text-[var(--fg-base)] cursor-pointer outline-none"
          >
            <option value="all">Tất cả thiết bị</option>
            <option value="desktop">🖥️ Desktop</option>
            <option value="mobile">📱 Mobile</option>
            <option value="tablet">📟 Tablet</option>
            <option value="bot">🤖 Bot</option>
          </select>
          <select value={clickStatusFilter} onChange={e => setClickStatusFilter(e.target.value as ClickStatusFilter)}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-[var(--border-soft)] text-[12px] font-bold text-[var(--fg-base)] cursor-pointer outline-none"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="clean">✅ Sạch</option>
            <option value="suspicious">⚠️ Nghi ngờ</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 text-blue-500 animate-spin" />
        </div>
      ) : filteredClicks.length === 0 ? (
        <div className="py-16 text-center">
          <Eye className="size-10 text-[var(--fg-muted)] mx-auto mb-3 opacity-30" />
          <p className="text-[13px] text-[var(--fg-muted)]">{clicks.length === 0 ? "Chưa có lượt click nào" : "Không tìm thấy kết quả phù hợp"}</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-soft)] max-h-[600px] overflow-y-auto">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-[var(--border-soft)]/30 text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider sticky top-0 z-10">
            <div className="col-span-1">#</div>
            <div className="col-span-2">IP Address</div>
            <div className="col-span-2">Device</div>
            <div className="col-span-2">Browser</div>
            <div className="col-span-2">Nguồn</div>
            <div className="col-span-2">Thời gian</div>
            <div className="col-span-1">Status</div>
          </div>

          {filteredClicks.map((click, idx) => {
            const isExpanded = expandedClickId === click.id;
            const DeviceIcon = click.device_type ? (DEVICE_ICONS[click.device_type] || Globe) : Globe;

            return (
              <div key={click.id}>
                <button
                  onClick={() => setExpandedClickId(isExpanded ? null : click.id)}
                  className="grid grid-cols-12 gap-2 px-5 py-3 w-full text-left hover:bg-[var(--border-soft)]/20 transition-colors cursor-pointer"
                >
                  <div className="col-span-1 text-[11px] font-bold text-[var(--fg-muted)]">{idx + 1}</div>
                  <div className="col-span-2 text-[12px] font-mono font-bold text-[var(--fg-base)] truncate">{click.ip_address}</div>
                  <div className="col-span-2 text-[12px] flex items-center gap-1.5 capitalize text-[var(--fg-muted)]">
                    <DeviceIcon className="size-3.5" />
                    {click.device_type || "—"}
                  </div>
                  <div className="col-span-2 text-[12px] text-[var(--fg-muted)] truncate">
                    {extractBrowser(click.user_agent)}
                  </div>
                  <div className="col-span-2 text-[12px] text-[var(--fg-muted)] truncate">
                    {click.referer ? (() => { try { return new URL(click.referer).hostname; } catch { return click.referer.slice(0, 25); } })() : "🎯 Trực tiếp"}
                  </div>
                  <div className="col-span-2 text-[11px] text-[var(--fg-muted)]">{timeAgo(click.clicked_at)}</div>
                  <div className="col-span-1">
                    {click.is_suspicious ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold">
                        <AlertTriangle className="size-2.5" /> ⚠️
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[9px] font-bold">
                        <CheckCircle2 className="size-2.5" /> ✓
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-4 bg-[var(--border-soft)]/10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                      <div>
                        <span className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider block mb-1">User-Agent</span>
                        <p className="font-mono text-[11px] text-[var(--fg-base)] break-all bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-soft)]">
                          {click.user_agent || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider block mb-1">Referer đầy đủ</span>
                        <p className="font-mono text-[11px] text-[var(--fg-base)] break-all bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-soft)]">
                          {click.referer || "Trực tiếp"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider block mb-1">Thời gian chính xác</span>
                        <p className="text-[var(--fg-base)] font-bold">{formatDate(click.clicked_at)}</p>
                      </div>
                      {click.suspicious_reason && (
                        <div>
                          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block mb-1">⚠️ Lý do nghi ngờ</span>
                          <p className="text-red-600 font-bold">{click.suspicious_reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(ClicksTab);
