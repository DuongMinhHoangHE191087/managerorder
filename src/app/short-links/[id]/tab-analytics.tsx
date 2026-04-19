"use client";

import { memo } from "react";
import {
  BarChart3, Globe, Bot, Loader2, Chrome, Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TabProps } from "./detail-types";

const _Monitor = Globe; // Alias for desktop icon

const BROWSER_ICONS: Record<string, typeof Chrome> = {
  Chrome: Chrome, Edge: Chrome, Safari: Compass, Firefox: Globe,
  Opera: Globe, Zalo: Globe, "Facebook App": Globe, "Telegram Bot": Bot,
  "CLI/Bot": Bot,
};

function AnalyticsTab({ stats, isLoading, link }: TabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 text-purple-500 animate-spin" />
        <span className="ml-3 text-sm text-[var(--fg-muted)]">Đang tải dữ liệu...</span>
      </div>
    );
  }

  if (!stats || (stats.totalClicks === 0 && (link?.current_clicks ?? 0) === 0)) {
    return (
      <div className="py-16 text-center">
        <BarChart3 className="size-10 text-[var(--fg-muted)] mx-auto mb-3 opacity-30" />
        <p className="text-[13px] text-[var(--fg-muted)]">Chưa có lượt click nào</p>
        <p className="text-[11px] text-[var(--fg-muted)] mt-1">Analytics sẽ hiển thị khi có người truy cập link</p>
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
            {link.current_clicks} click đã ghi nhận
          </p>
          <p className="text-[11px] text-blue-600 mt-1">
            Dữ liệu chi tiết (IP, trình duyệt, thiết bị) sẽ được ghi lại từ các lượt click tiếp theo.
            <br />Analytics dashboard sẽ tự động cập nhật khi có dữ liệu mới.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-6">
      {/* Hourly Timeline */}
      {stats.hourlyTimeline && stats.hourlyTimeline.some(h => h.count > 0) && (
        <div>
          <p className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-3">📊 Hoạt động click 24 giờ qua</p>
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
                      {h.hour}: {h.count} click{h.count !== 1 ? "s" : ""}
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
          <p className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-3">📅 Xu hướng 7 ngày qua</p>
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
                      {d.day}: {d.count} click{d.count !== 1 ? "s" : ""}
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
          <p className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-3">🌐 Trình duyệt</p>
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

      {/* Top IPs + Referers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Top IPs */}
        <div className="bg-[var(--border-soft)]/10 rounded-xl p-4">
          <p className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-3">🌐 Top IP truy cập</p>
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
          ) : <p className="text-xs text-[var(--fg-muted)]">Chưa có dữ liệu</p>}
        </div>

        {/* Referer Domains */}
        <div className="bg-[var(--border-soft)]/10 rounded-xl p-4">
          <p className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-3">🔗 Nguồn truy cập</p>
          {stats.referers && Object.keys(stats.referers).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(stats.referers)
                .sort((a, b) => b[1] - a[1])
                .map(([domain, count]) => (
                  <div key={domain} className="flex items-center gap-2 text-[12px]">
                    <span className="text-[var(--fg-base)] flex-1 truncate font-medium">
                      {domain === "direct" ? "🎯 Trực tiếp" : domain}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold">
                      {count}×
                    </span>
                  </div>
                ))}
            </div>
          ) : <p className="text-xs text-[var(--fg-muted)]">Chưa có dữ liệu</p>}
        </div>
      </div>
    </div>
  );
}

export default memo(AnalyticsTab);
