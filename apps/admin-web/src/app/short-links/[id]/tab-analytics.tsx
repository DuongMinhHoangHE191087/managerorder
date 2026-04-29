"use client";

import { memo } from "react";
import {
  BarChart3, Globe, Bot, Loader2, Chrome, Compass, Eye, MousePointerClick,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";
import type { TabProps } from "./detail-types";

const _Monitor = Globe; // Alias for desktop icon

const BROWSER_ICONS: Record<string, typeof Chrome> = {
  [vi.legacy.browser.chrome]: Chrome,
  [vi.legacy.browser.edge]: Chrome,
  [vi.legacy.browser.safari]: Compass,
  [vi.legacy.browser.firefox]: Globe,
  [vi.legacy.browser.opera]: Globe,
  [vi.legacy.browser.zalo]: Globe,
  [vi.legacy.browser.facebook]: Globe,
  [vi.legacy.browser.telegram]: Bot,
  "CLI/Bot": Bot,
};

function AnalyticsTab({ stats, isLoading, link }: TabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 text-purple-500 animate-spin" />
        <span className="ml-3 text-sm text-[var(--fg-muted)]">{vi.legacy.analytics.loading}</span>
      </div>
    );
  }

  if (!stats || (stats.totalClicks === 0 && (link?.current_clicks ?? 0) === 0)) {
    return (
      <div className="py-16 text-center">
        <BarChart3 className="size-10 text-[var(--fg-muted)] mx-auto mb-3 opacity-30" />
        <p className="text-[13px] text-[var(--fg-muted)]">{vi.legacy.analytics.emptyTitle}</p>
        <p className="text-[11px] text-[var(--fg-muted)] mt-1">{vi.legacy.analytics.emptyDescription}</p>
      </div>
    );
  }

  // Old links: have clicks (from DB counter) but no detailed analytics
  if (stats.totalClicks === 0 && (link?.current_clicks ?? 0) > 0) {
    return (
      <div className="p-5 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <BarChart3 className="size-8 text-blue-500 mx-auto mb-2" />
          <p className="text-[13px] font-bold text-blue-700">
            {vi.legacy.analytics.oldLinkTitle(link.current_clicks)}
          </p>
          <p className="text-[11px] text-blue-600 mt-1 whitespace-pre-line">
            {vi.legacy.analytics.oldLinkDescription}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          icon={MousePointerClick}
          label="Click thật"
          value={stats.realUserClicks ?? stats.totalClicks}
          tone="emerald"
        />
        <SummaryMetric
          icon={Eye}
          label="Xem landing"
          value={stats.landingViewCount ?? stats.eventTypes?.landing_view ?? 0}
          tone="sky"
        />
        <SummaryMetric
          icon={Bot}
          label="Bot preview"
          value={stats.botPreviewCount ?? stats.eventTypes?.bot_preview ?? 0}
          tone="slate"
        />
        <SummaryMetric
          icon={ShieldAlert}
          label="Bị chặn"
          value={stats.blockedCount ?? stats.eventTypes?.blocked ?? 0}
          tone="red"
        />
      </div>

      {/* Hourly Timeline */}
      {stats.hourlyTimeline && stats.hourlyTimeline.some(h => h.count > 0) && (
        <div>
          <p className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-3">{vi.legacy.analytics.hourlyTitle}</p>
          <div className="flex items-end gap-px h-28 bg-[var(--border-soft)]/20 rounded-xl p-2">
            {stats.hourlyTimeline.map((h, i) => {
              const maxCount = Math.max(...stats.hourlyTimeline.map(t => t.count), 1);
              const heightPct = (h.count / maxCount) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 group/bar relative">
                  <div
                    className={cn(
                      "w-full rounded-t-sm transition-all min-h-[2px]",
                      h.count > 0 ? "bg-purple-500/80 hover:bg-purple-500" : "bg-[var(--border-soft)]/40"
                    )}
                    style={{ height: `${Math.max(heightPct, 3)}%` }}
                  />
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover/bar:block z-10">
                    <div className="bg-[#1e293b] text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                      {vi.legacy.analytics.hourlyTooltip(h.hour, h.count)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-[var(--fg-muted)] mt-1 px-1">
            <span>{stats.hourlyTimeline[0]?.hour}</span>
            <span>{stats.hourlyTimeline[stats.hourlyTimeline.length - 1]?.hour}</span>
          </div>
        </div>
      )}

      {/* Daily Timeline (7 days) */}
      {stats.dailyTimeline && stats.dailyTimeline.some(d => d.count > 0) && (
        <div>
          <p className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-3">{vi.legacy.analytics.dailyTitle}</p>
          <div className="flex items-end gap-1.5 h-20 bg-[var(--border-soft)]/20 rounded-xl p-2">
            {stats.dailyTimeline.map((d, i) => {
              const maxCount = Math.max(...stats.dailyTimeline.map(t => t.count), 1);
              const heightPct = (d.count / maxCount) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 group/dbar relative">
                  <div
                    className={cn(
                      "w-full rounded-t transition-all min-h-[2px]",
                      d.count > 0 ? "bg-blue-500/80 hover:bg-blue-500" : "bg-[var(--border-soft)]/40"
                    )}
                    style={{ height: `${Math.max(heightPct, 5)}%` }}
                  />
                  <span className="text-[8px] text-[var(--fg-muted)] font-bold mt-0.5">{d.day}</span>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover/dbar:block z-10">
                    <div className="bg-[#1e293b] text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                      {vi.legacy.analytics.dailyTooltip(d.day, d.count)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Browser Breakdown */}
      {stats.browsers && Object.keys(stats.browsers).length > 0 && (
        <div className="bg-[var(--border-soft)]/10 rounded-xl p-4">
          <p className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-3">{vi.legacy.analytics.browserTitle}</p>
          <div className="space-y-2">
            {Object.entries(stats.browsers)
              .sort((a, b) => b[1] - a[1])
              .map(([browser, count]) => {
                const BIcon = BROWSER_ICONS[browser] || Globe;
                const pct = stats.totalClicks > 0 ? Math.round((count / stats.totalClicks) * 100) : 0;
                return (
                  <div key={browser} className="flex items-center gap-2.5 text-[12px]">
                    <BIcon className="size-4 text-[var(--fg-muted)]" />
                    <span className="text-[var(--fg-base)] font-medium w-24 truncate">{browser}</span>
                    <div className="flex-1 h-2 bg-[var(--border-soft)]/50 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-[var(--fg-muted)] w-16 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {stats.ipVersions && Object.keys(stats.ipVersions).length > 0 && (
        <div className="bg-[var(--border-soft)]/10 rounded-xl p-4">
          <p className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-3">IPv4 / IPv6</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {Object.entries(stats.ipVersions)
              .sort((a, b) => b[1] - a[1])
              .map(([version, count]) => {
                const pct = stats.totalClicks > 0 ? Math.round((count / stats.totalClicks) * 100) : 0;
                return (
                  <div key={version} className="rounded-xl border border-[var(--border-soft)] bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[var(--fg-muted)]">{version}</p>
                    <p className="mt-1 text-lg font-black text-[var(--fg-base)]">{count}</p>
                    <p className="text-[10px] font-bold text-[var(--fg-muted)]">{pct}% click thật</p>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Top IPs + Referers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Top IPs */}
        <div className="bg-[var(--border-soft)]/10 rounded-xl p-4">
          <p className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-3">{vi.legacy.analytics.topIpTitle}</p>
          {stats.topIPs && stats.topIPs.length > 0 ? (
            <div className="space-y-2">
              {stats.topIPs.map((entry, i) => (
                <div key={entry.ip} className="flex items-center gap-2 text-[12px]">
                  <span className={cn(
                    "inline-flex items-center justify-center size-5 rounded text-[10px] font-black",
                    i === 0 ? "bg-amber-100 text-amber-700" :
                    i === 1 ? "bg-slate-200 text-slate-600" :
                    "bg-[var(--border-soft)] text-[var(--fg-muted)]"
                  )}>{i + 1}</span>
                  <span className="font-mono text-[var(--fg-base)] flex-1 truncate">{entry.ip}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                    entry.count >= 5 ? "bg-red-100 text-red-600" :
                    entry.count >= 3 ? "bg-amber-100 text-amber-600" :
                    "bg-emerald-100 text-emerald-600"
                  )}>{entry.count}×</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-[var(--fg-muted)]">{vi.legacy.analytics.noData}</p>}
        </div>

        {/* Referer Domains */}
        <div className="bg-[var(--border-soft)]/10 rounded-xl p-4">
          <p className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-3">{vi.legacy.analytics.trafficSourceTitle}</p>
          {stats.referers && Object.keys(stats.referers).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(stats.referers)
                .sort((a, b) => b[1] - a[1])
                .map(([domain, count]) => (
                  <div key={domain} className="flex items-center gap-2 text-[12px]">
                    <span className="text-[var(--fg-base)] flex-1 truncate font-medium">
                      {domain === "direct" ? vi.legacy.analytics.directAccess : domain}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold">
                      {count}×
                    </span>
                  </div>
                ))}
            </div>
          ) : <p className="text-xs text-[var(--fg-muted)]">{vi.legacy.analytics.noData}</p>}
        </div>
      </div>
    </div>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof BarChart3;
  label: string;
  value: number;
  tone: "emerald" | "sky" | "slate" | "red";
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    red: "bg-red-50 text-red-700 border-red-200",
  }[tone];

  return (
    <div className={cn("rounded-xl border p-3", toneClass)}>
      <div className="flex items-center gap-2">
        <Icon className="size-4" />
        <p className="text-[10px] font-black uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

export default memo(AnalyticsTab);
