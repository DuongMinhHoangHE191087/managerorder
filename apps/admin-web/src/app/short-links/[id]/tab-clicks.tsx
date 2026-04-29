"use client";

import { useState, useMemo, useCallback, memo } from "react";
import {
  List, Eye, Download, Search, Loader2, Globe, CheckCircle2,
  AlertTriangle, Monitor, Smartphone, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";
import { appToast } from "@/shared/ui/app-toast";
import type { TabProps, ClickRecord } from "./detail-types";
import { timeAgo, formatDate, extractBrowser } from "./detail-types";

type ClickDeviceFilter = "all" | "desktop" | "mobile" | "tablet" | "bot";
type ClickStatusFilter = "all" | "clean" | "suspicious";
type ClickIpVersionFilter = "all" | "IPv4" | "IPv6" | "unknown";

const DEVICE_ICONS: Record<string, typeof Monitor> = {
  desktop: Monitor, mobile: Smartphone, tablet: Smartphone, bot: Bot,
};

const EVENT_TYPE_LABELS: Record<ClickRecord["event_type"], string> = {
  bot_preview: "Xem trước bot",
  landing_view: "Xem landing",
  redirect_click: "Click thật",
  blocked: "Bị chặn",
};

const EVENT_TYPE_STYLES: Record<ClickRecord["event_type"], string> = {
  bot_preview: "bg-slate-100 text-slate-600",
  landing_view: "bg-sky-100 text-sky-700",
  redirect_click: "bg-emerald-100 text-emerald-700",
  blocked: "bg-red-100 text-red-700",
};

function getIpVersion(click: ClickRecord): "IPv4" | "IPv6" | "unknown" {
  if (click.ip_version === "IPv4" || click.ip_version === "IPv6") {
    return click.ip_version;
  }
  if (click.ip_address?.includes(":")) {
    return "IPv6";
  }
  if (click.ip_address) {
    return "IPv4";
  }
  return "unknown";
}

/** Export click data to CSV */
function exportClicksCSV(clicks: ClickRecord[], slug: string) {
  const headers = [
    vi.legacy.clicks.tableTime,
    vi.legacy.clicks.tableIp,
    "Phiên bản IP",
    vi.legacy.clicks.tableDevice,
    vi.legacy.clicks.tableBrowser,
    vi.legacy.clicks.tableSource,
    "Loại sự kiện",
    vi.legacy.clicks.tableStatus,
    vi.legacy.clicks.detailSuspiciousReason,
  ];
  const rows = clicks.map(c => [
    formatDate(c.clicked_at),
    c.ip_address,
    getIpVersion(c),
    c.device_type ? (vi.shortLinks.shared.deviceLabels[c.device_type as keyof typeof vi.shortLinks.shared.deviceLabels] ?? vi.legacy.clicks.unknownDevice) : vi.legacy.clicks.unknownDevice,
    extractBrowser(c.user_agent),
    c.referer || vi.legacy.clicks.directAccess,
    EVENT_TYPE_LABELS[c.event_type ?? "redirect_click"],
    c.is_suspicious ? vi.legacy.clicks.statusSuspicious : vi.legacy.clicks.statusClean,
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
  const [clickIpVersionFilter, setClickIpVersionFilter] = useState<ClickIpVersionFilter>("all");
  const [clickSearch, setClickSearch] = useState("");

  const filteredClicks = useMemo(() => {
    let result = clicks;
    if (clickDeviceFilter !== "all") result = result.filter(c => c.device_type === clickDeviceFilter);
    if (clickStatusFilter === "clean") result = result.filter(c => !c.is_suspicious);
    if (clickStatusFilter === "suspicious") result = result.filter(c => c.is_suspicious);
    if (clickIpVersionFilter !== "all") result = result.filter(c => getIpVersion(c) === clickIpVersionFilter);
    if (clickSearch.trim()) {
      const q = clickSearch.toLowerCase();
      result = result.filter(c =>
        c.ip_address?.toLowerCase().includes(q)
        || c.user_agent?.toLowerCase().includes(q)
        || c.referer?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [clicks, clickDeviceFilter, clickStatusFilter, clickIpVersionFilter, clickSearch]);

  const formatDeviceLabel = useCallback((deviceType?: string | null) => {
    switch (deviceType) {
      case "desktop":
        return "Máy tính";
      case "mobile":
        return "Điện thoại";
      case "tablet":
        return "Máy tính bảng";
      case "bot":
        return "Bot";
      default:
        return "Chưa rõ";
    }
  }, []);

  const handleExportCSV = useCallback(() => {
    if (clicks.length === 0) return;
    exportClicksCSV(clicks, link.slug);
    appToast.success(vi.legacy.clicks.exportSuccess(clicks.length));
  }, [clicks, link.slug]);

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl shadow-sm overflow-hidden border border-[var(--border-soft)]">
      <div className="p-5 border-b border-[var(--border-soft)]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[15px] font-bold text-[var(--fg-base)] flex items-center gap-2">
              <List className="text-blue-500 size-5" />
              {vi.legacy.clicks.title}
            </h3>
            <div className="flex items-center gap-2">
              <span className="bg-blue-500/10 text-blue-500 text-[11px] font-bold px-2.5 py-1 rounded-full">
                {filteredClicks.length}/{clicks.length}
              </span>
            <button onClick={handleExportCSV} disabled={clicks.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-30"
            >
              <Download className="size-3" /> {vi.legacy.clicks.exportCsv}
            </button>
          </div>
        </div>
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--fg-muted)]" />
            <input
              type="text" placeholder={vi.legacy.clicks.searchPlaceholder}
              value={clickSearch} onChange={e => setClickSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-[var(--border-soft)] text-[12px] text-[var(--fg-base)] focus:ring-2 focus:ring-blue-500/30 outline-none"
            />
          </div>
          <select value={clickDeviceFilter} onChange={e => setClickDeviceFilter(e.target.value as ClickDeviceFilter)}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-[var(--border-soft)] text-[12px] font-bold text-[var(--fg-base)] cursor-pointer outline-none"
          >
            <option value="all">{vi.legacy.clicks.filterAllDevices}</option>
            <option value="desktop">{vi.legacy.clicks.filterDesktop}</option>
            <option value="mobile">{vi.legacy.clicks.filterMobile}</option>
            <option value="tablet">{vi.legacy.clicks.filterTablet}</option>
            <option value="bot">{vi.legacy.clicks.filterBot}</option>
          </select>
          <select value={clickStatusFilter} onChange={e => setClickStatusFilter(e.target.value as ClickStatusFilter)}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-[var(--border-soft)] text-[12px] font-bold text-[var(--fg-base)] cursor-pointer outline-none"
          >
            <option value="all">{vi.legacy.clicks.filterAllStatuses}</option>
            <option value="clean">{vi.legacy.clicks.filterClean}</option>
            <option value="suspicious">{vi.legacy.clicks.filterSuspicious}</option>
          </select>
          <select value={clickIpVersionFilter} onChange={e => setClickIpVersionFilter(e.target.value as ClickIpVersionFilter)}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-[var(--border-soft)] text-[12px] font-bold text-[var(--fg-base)] cursor-pointer outline-none"
          >
            <option value="all">Tất cả IP</option>
            <option value="IPv4">IPv4</option>
            <option value="IPv6">IPv6</option>
            <option value="unknown">IP chưa rõ</option>
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
          <p className="text-[13px] text-[var(--fg-muted)]">
            {clicks.length === 0 ? vi.legacy.clicks.emptyTitle : vi.legacy.clicks.emptyFilteredTitle}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-soft)] max-h-[600px] overflow-y-auto">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-[var(--border-soft)]/30 text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider sticky top-0 z-10">
            <div className="col-span-1">{vi.legacy.clicks.tableIndex}</div>
            <div className="col-span-2">{vi.legacy.clicks.tableIp}</div>
            <div className="col-span-2">{vi.legacy.clicks.tableDevice}</div>
            <div className="col-span-2">Sự kiện</div>
            <div className="col-span-2">{vi.legacy.clicks.tableSource}</div>
            <div className="col-span-2">{vi.legacy.clicks.tableTime}</div>
            <div className="col-span-1">{vi.legacy.clicks.tableStatus}</div>
          </div>

          {filteredClicks.map((click, idx) => {
            const isExpanded = expandedClickId === click.id;
            const DeviceIcon = click.device_type ? (DEVICE_ICONS[click.device_type] || Globe) : Globe;
            const ipVersion = getIpVersion(click);

            return (
              <div key={click.id}>
                <button
                  onClick={() => setExpandedClickId(isExpanded ? null : click.id)}
                  className="grid grid-cols-12 gap-2 px-5 py-3 w-full text-left hover:bg-[var(--border-soft)]/20 transition-colors cursor-pointer"
                >
                  <div className="col-span-1 text-[11px] font-bold text-[var(--fg-muted)]">{idx + 1}</div>
                  <div className="col-span-2 min-w-0">
                    <p className="truncate font-mono text-[12px] font-bold text-[var(--fg-base)]">{click.ip_address}</p>
                    <span className={cn(
                      "mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-black",
                      ipVersion === "IPv6" ? "bg-indigo-100 text-indigo-700" : ipVersion === "IPv4" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600",
                    )}>
                      {ipVersion}
                    </span>
                  </div>
                  <div className="col-span-2 text-[12px] flex items-center gap-1.5 capitalize text-[var(--fg-muted)]">
                    <DeviceIcon className="size-3.5" />
                    {formatDeviceLabel(click.device_type)}
                  </div>
                  <div className="col-span-2">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                      EVENT_TYPE_STYLES[click.event_type ?? "redirect_click"],
                    )}>
                      {EVENT_TYPE_LABELS[click.event_type ?? "redirect_click"]}
                    </span>
                  </div>
                  <div className="col-span-2 text-[12px] text-[var(--fg-muted)] truncate">
                    {click.referer ? (() => { try { return new URL(click.referer).hostname; } catch { return click.referer.slice(0, 25); } })() : vi.legacy.clicks.directAccess}
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
                        <span className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider block mb-1">{vi.legacy.clicks.detailUserAgent}</span>
                        <p className="font-mono text-[11px] text-[var(--fg-base)] break-all bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-soft)]">
                          {click.user_agent || vi.legacy.clicks.unknownUserAgent}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider block mb-1">{vi.legacy.clicks.detailReferer}</span>
                        <p className="font-mono text-[11px] text-[var(--fg-base)] break-all bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-soft)]">
                          {click.referer || vi.legacy.clicks.directAccess}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider block mb-1">IP / phiên bản</span>
                        <p className="font-mono text-[11px] text-[var(--fg-base)] break-all bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-soft)]">
                          {click.ip_address} · {ipVersion}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider block mb-1">{vi.legacy.clicks.detailExactTime}</span>
                        <p className="text-[var(--fg-base)] font-bold">{formatDate(click.clicked_at)}</p>
                      </div>
                      {click.suspicious_reason && (
                        <div>
                          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block mb-1">{vi.legacy.clicks.detailSuspiciousReason}</span>
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
