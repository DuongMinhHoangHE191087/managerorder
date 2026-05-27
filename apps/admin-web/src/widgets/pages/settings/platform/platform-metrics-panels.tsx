"use client";

import { BarChart3, Clock, TrendingUp, AlertTriangle, Users, ShieldAlert, Link2, MapPinned } from "lucide-react";
import { SectionCard } from "@/shared/ui/section-card";
import { formatDateLabel, formatNumber } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";
import type { ElementType } from "react";

export interface PlatformMetrics {
  apiCalls: {
    total: number;
    today: number;
    avgResponseMs: number;
    p95ResponseMs: number;
    errorRate: number;
    trend: number;
  };
  rateLimits: {
    totalHits: number;
    blocked: number;
    topEndpoints: { path: string; hits: number }[];
    blockedIps: { ipAddress: string; hits: number; lastSeen: string; reason: string | null }[];
    blockedLinks: { shortLinkId: string; slug: string | null; title: string | null; hits: number }[];
  };
  authMetrics: {
    loginSuccess: number;
    loginFailed: number;
    tokenRefreshed: number;
    activeUsers: number;
  };
  hourlyRequests: { hour: string; requests: number; errors: number }[];
  topEndpoints: { path: string; calls: number; avgMs: number; status: "healthy" | "warning" | "critical" }[];
  recentErrors: { time: string; path: string; status: number; message: string }[];
}

function MiniBarChart({ data }: { data: { hour: string; requests: number; errors: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.requests), 1);

  return (
    <div className="flex items-end gap-[2px] h-[100px] w-full">
      {data.map((d, i) => {
        const height = (d.requests / maxVal) * 100;
        const errHeight = (d.errors / maxVal) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0 relative group">
            <div className="w-full flex flex-col justify-end" style={{ height: "100px" }}>
              {errHeight > 0 && (
                <div className="w-full bg-red-400/60 rounded-t-sm" style={{ height: `${errHeight}%` }} />
              )}
              <div
                className="w-full bg-[var(--accent)]/60 hover:bg-[var(--accent)] transition-colors rounded-t-sm"
                style={{ height: `${height - errHeight}%` }}
              />
            </div>
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {vi.settings.platform.panels.requestLabel(d.requests, d.errors)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  trendLabel,
  color = "text-[var(--accent)]",
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: number;
  trendLabel?: string;
  color?: string;
}) {
  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-current/10 to-current/5 ${color}`}>
          <Icon className="size-4" />
        </div>
        <span className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">{label}</span>
      </div>
      <div>
        <p className="text-3xl font-black text-[var(--fg-base)] tracking-tight">{value}</p>
        {subValue && <p className="text-[11px] text-[var(--fg-muted)] mt-1">{subValue}</p>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-[11px] font-bold ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          <TrendingUp className={`size-3 ${trend < 0 ? "rotate-180" : ""}`} />
          {trend > 0 ? "+" : ""}{trend}% {trendLabel}
        </div>
      )}
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case "healthy":
      return "text-emerald-600 bg-emerald-50";
    case "warning":
      return "text-amber-600 bg-amber-50";
    case "critical":
      return "text-red-600 bg-red-50";
    default:
      return "text-gray-500 bg-gray-50";
  }
}

function getStatusLabel(status: keyof typeof vi.settings.platform.panels.endpointStatus) {
  return vi.settings.platform.panels.endpointStatus[status];
}

export function PlatformMetricsPanels({ metrics }: { metrics: PlatformMetrics }) {
  const topEndpointHits = Math.max(metrics.rateLimits.topEndpoints[0]?.hits ?? 0, 1);

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={BarChart3}
          label={vi.settings.platform.page.apiCallsToday}
          value={formatNumber(metrics.apiCalls.today)}
          subValue={vi.settings.platform.page.todayTotal(formatNumber(metrics.apiCalls.total))}
          trend={metrics.apiCalls.trend}
          trendLabel={vi.settings.platform.page.vsYesterday}
          color="text-blue-600"
        />
          <StatCard
          icon={Clock}
          label={vi.settings.platform.page.avgResponse}
          value={`${metrics.apiCalls.avgResponseMs}ms`}
          subValue={`${vi.settings.platform.page.p95Label}: ${metrics.apiCalls.p95ResponseMs}ms`}
          color="text-emerald-600"
        />
        <StatCard
          icon={AlertTriangle}
          label={vi.settings.platform.page.errorRate}
          value={`${metrics.apiCalls.errorRate}%`}
          subValue={vi.settings.platform.page.blockedByRateLimit(metrics.rateLimits.blocked)}
          color="text-amber-600"
        />
        <StatCard
          icon={Users}
          label={vi.settings.platform.page.activeUsers}
          value={metrics.authMetrics.activeUsers}
          subValue={vi.settings.platform.page.failedLogins(metrics.authMetrics.loginFailed)}
          color="text-violet-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title={vi.settings.platform.panels.requestVolume} description={vi.settings.platform.panels.requestVolumeDescription}>
          <MiniBarChart data={metrics.hourlyRequests} />
          <div className="flex items-center gap-4 mt-3 text-[10px] text-[var(--fg-muted)] font-bold">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-[var(--accent)]/60 rounded" />
              {vi.settings.platform.panels.requests}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-red-400/60 rounded" />
              {vi.settings.platform.panels.errors}
            </div>
          </div>
        </SectionCard>

        <SectionCard title={vi.settings.platform.panels.topEndpoints} description={vi.settings.platform.panels.topEndpointsDescription}>
          <div className="space-y-2">
            {metrics.topEndpoints.map((ep, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl bg-white border border-[var(--border-soft)] hover:border-[var(--accent)]/20 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[11px] font-black text-[var(--fg-muted)] w-5">{i + 1}</span>
                  <code className="text-[12px] font-mono font-bold text-[var(--fg-base)] truncate">{ep.path}</code>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="text-[11px] font-bold text-[var(--fg-muted)]">
                    {formatNumber(ep.calls)} {vi.settings.platform.panels.calls}
                  </span>
                  <span className="text-[11px] font-bold text-[var(--fg-muted)]">
                    {ep.avgMs}ms
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getStatusColor(ep.status)}`}>
                    {getStatusLabel(ep.status as keyof typeof vi.settings.platform.panels.endpointStatus)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title={vi.settings.platform.panels.rateLimitHits}
          description={vi.settings.platform.panels.rateLimitHitsDescription}
          action={
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600">
              {metrics.rateLimits.totalHits} {vi.settings.platform.panels.hits} | {metrics.rateLimits.blocked} {vi.settings.platform.panels.blocked}
            </span>
          }
        >
          <div className="space-y-3">
            {metrics.rateLimits.topEndpoints.map((ep, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <code className="text-[12px] font-mono font-bold text-[var(--fg-base)]">{ep.path}</code>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-1.5">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-red-500 transition-[background-color,border-color,box-shadow,color,opacity,transform,width]"
                      style={{ width: `${(ep.hits / topEndpointHits) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-[12px] font-black text-amber-600">{ep.hits}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Blocked IPs"
          description="Các IP bị chặn nhiều nhất từ short-link / landing traffic."
          action={
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--fg-muted)]">
              <ShieldAlert className="size-4 text-red-500" />
              {metrics.rateLimits.blockedIps.length} IP
            </span>
          }
        >
          <div className="space-y-2">
            {metrics.rateLimits.blockedIps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-5 text-center text-[12px] text-[var(--fg-muted)]">
                Chưa ghi nhận IP bị block trong khoảng thời gian này.
              </div>
            ) : (
              metrics.rateLimits.blockedIps.map((item, index) => (
                <div key={`${item.ipAddress}-${index}`} className="rounded-xl border border-red-100 bg-red-50/60 p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-[12px] font-mono font-bold text-[var(--fg-base)]">{item.ipAddress}</code>
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-700">
                          {item.hits} lần
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                        {item.reason || "Blocked by rule"} • Lần cuối {formatDateLabel(item.lastSeen)}
                      </p>
                    </div>
                    <MapPinned className="size-4 shrink-0 text-red-500" />
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Blocked Links"
          description="Short-link / landing pages bị chặn hoặc cảnh báo nhiều nhất."
          action={
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--fg-muted)]">
              <Link2 className="size-4 text-amber-500" />
              {metrics.rateLimits.blockedLinks.length} link
            </span>
          }
        >
          <div className="space-y-2">
            {metrics.rateLimits.blockedLinks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-5 text-center text-[12px] text-[var(--fg-muted)]">
                Không có short-link bị block.
              </div>
            ) : (
              metrics.rateLimits.blockedLinks.map((item, index) => (
                <div key={`${item.shortLinkId}-${index}`} className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-[12px] font-mono font-bold text-[var(--fg-base)]">
                          {item.title || item.slug || item.shortLinkId}
                        </code>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                          {item.hits} lần
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                        {item.slug ? `/${item.slug}` : item.shortLinkId}
                      </p>
                    </div>
                    <ShieldAlert className="size-4 shrink-0 text-amber-500" />
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title={vi.settings.platform.panels.authentication} description={vi.settings.platform.panels.authenticationDescription}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: vi.settings.platform.panels.loginSuccess, value: metrics.authMetrics.loginSuccess, color: "text-emerald-600" },
              { label: vi.settings.platform.panels.loginFailed, value: metrics.authMetrics.loginFailed, color: "text-red-500" },
              { label: vi.settings.platform.panels.tokenRefreshed, value: metrics.authMetrics.tokenRefreshed, color: "text-blue-600" },
              { label: vi.settings.platform.panels.activeUsers, value: metrics.authMetrics.activeUsers, color: "text-violet-600" },
            ].map((item) => (
              <div key={item.label} className="text-center p-4 bg-white rounded-xl border border-[var(--border-soft)]">
                <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                <p className="text-[11px] font-bold text-[var(--fg-muted)] mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={vi.settings.platform.panels.recentErrors} description={vi.settings.platform.panels.recentErrorsDescription}>
          <div className="space-y-2">
            {metrics.recentErrors.map((err, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-3 rounded-xl bg-red-50/50 border border-red-100"
              >
                <span className="text-[11px] font-mono font-bold text-[var(--fg-muted)] mt-0.5">{err.time}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-[12px] font-mono font-bold text-[var(--fg-base)]">{err.path}</code>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        err.status >= 500
                          ? "bg-red-100 text-red-700"
                          : err.status === 429
                          ? "bg-amber-100 text-amber-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {err.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--fg-muted)] mt-1 truncate">{err.message}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
