"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ChevronRight, Link2, Copy, ExternalLink, Clock,
  Shield, ShieldCheck, BarChart3, Globe,
  Lock, Unlock, Monitor, Smartphone, Bot, Bell, ScanLine,
  ArrowLeft, Settings, Activity, List, Trash2,
  RefreshCw, Power, AlertTriangle,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { appToast } from "@/shared/ui/app-toast";
import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import {
  useShortLinkDetail,
  useUpdateShortLink,
  useDeleteShortLink,
} from "@/widgets/pages/short-links/hooks/use-short-links";
import { formatDate } from "@/app/short-links/[id]/detail-types";
import { vi } from "@/shared/messages/vi";

// â”€â”€ Dynamic imports for code-splitting (tabs load on demand) â”€â”€
const AnalyticsTab = dynamic(() => import("@/app/short-links/[id]/tab-analytics"), {
  loading: () => <TabSkeleton />,
});
const ClicksTab = dynamic(() => import("@/app/short-links/[id]/tab-clicks"), {
  loading: () => <TabSkeleton />,
});
const SettingsTab = dynamic(() => import("@/app/short-links/[id]/tab-settings"), {
  loading: () => <TabSkeleton />,
});

function TabSkeleton() {
  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-soft)] p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-32 bg-gray-200 rounded-xl" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}

function maskUrl(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname.length > 30 ? u.pathname.slice(0, 30) + "..." : u.pathname}`;
  } catch { return url.length > 50 ? url.slice(0, 50) + "..." : url; }
}

const DEVICE_ICONS: Record<string, typeof Monitor> = {
  desktop: Monitor, mobile: Smartphone, tablet: Smartphone, bot: Bot,
};

function formatDeviceTypeLabel(type?: string | null) {
  switch (type) {
    case "desktop":
      return vi.shortLinks.shared.deviceLabels.desktop;
    case "mobile":
      return vi.shortLinks.shared.deviceLabels.mobile;
    case "tablet":
      return vi.shortLinks.shared.deviceLabels.tablet;
    case "bot":
      return vi.shortLinks.shared.deviceLabels.bot;
    default:
      return vi.common.notAvailable;
  }
}

function getDeliveryModeLabel(mode?: string | null) {
  switch (mode) {
    case "direct_redirect":
      return "Chuyển hướng trực tiếp";
    case "landing_page":
      return "Qua landing giới thiệu";
    default:
      return "Kế thừa theo kênh bán";
  }
}

function getLandingTemplateLabel(key?: string | null) {
  switch (key) {
    case "owner_intro":
      return "Giới thiệu chủ shop";
    case "ctv_neutral":
      return "Mẫu CTV trung tính";
    default:
      return "Kế thừa theo kênh bán";
  }
}

function getPolicySourceLabel(source?: string | null) {
  switch (source) {
    case "link_override":
      return "Từ link";
    case "channel_default":
      return "Từ kênh bán";
    case "system_default":
      return "Mặc định hệ thống";
    case "not_applicable":
      return "Không áp dụng";
    default:
      return source ?? "Không rõ";
  }
}

type DetailTab = "analytics" | "clicks" | "settings";

const TABS: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
  { id: "analytics", label: vi.shortLinks.detail.analyticsTab, icon: <BarChart3 className="size-4" /> },
  { id: "clicks", label: vi.shortLinks.detail.clicksTab, icon: <List className="size-4" /> },
  { id: "settings", label: vi.shortLinks.detail.settingsTab, icon: <Settings className="size-4" /> },
];

// â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function ShortLinkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const linkId = params.id as string;

  const { data, isLoading, isError } = useShortLinkDetail(linkId);
  const link = data?.link ?? null;
  const salesChannel = data?.salesChannel ?? null;
  const resolvedPolicy = data?.resolvedPolicy ?? null;
  const clicks = data?.clicks ?? [];
  const stats = data?.stats ?? null;

  const updateMut = useUpdateShortLink();
  const deleteMut = useDeleteShortLink();

  const [activeTab, setActiveTab] = useState<DetailTab>("analytics");

  const securitySummary = useMemo(() => {
    if (!stats) return null;
    const cleanClicks = stats.totalClicks - stats.suspiciousCount;
    const trustScore = stats.totalClicks > 0 ? Math.round((cleanClicks / stats.totalClicks) * 100) : 100;
    return { cleanClicks, trustScore };
  }, [stats]);

  const handleCopy = () => {
    if (!link) return;
    const url = `${getBaseUrl()}/s/${link.slug}${link.require_token && link.access_token ? `?t=${link.access_token}` : ""}`;
    appToast.copy(url, vi.shortLinks.shared.copiedLink);
  };

  const publicUrl = link
    ? `${getBaseUrl()}/s/${link.slug}${link.require_token && link.access_token ? `?t=${link.access_token}` : ""}`
    : null;
  const orderId = link?.order_id ?? null;
  const orderHref = orderId ? `/orders/${orderId}` : null;

  const handleDelete = async () => {
    if (!link || !confirm(vi.shortLinks.detail.confirmDelete)) return;
    await deleteMut.mutateAsync(link.id);
    router.push("/short-links");
  };

  const handleToggleStatus = async () => {
    if (!link) return;
    const newStatus = link.status === "active" ? "disabled" : "active";
    const msg = newStatus === "disabled"
      ? vi.shortLinks.detail.confirmDisable
      : vi.shortLinks.detail.confirmEnable;
    if (!confirm(msg)) return;
    await updateMut.mutateAsync({ id: link.id, status: newStatus });
  };

  const handleUnlockIP = async () => {
    if (!link) return;
    await updateMut.mutateAsync({ id: link.id, locked_ip: null, locked_ipv6: null });
  };

  // â”€â”€ Loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isLoading) {
    return (
      <AppLayout>
        <PageContainer className="mt-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-12 bg-gray-200 rounded w-1/2" />
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-4 space-y-4">
                <div className="h-64 bg-gray-200 rounded-2xl" />
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
                </div>
              </div>
              <div className="col-span-8 space-y-4">
                <div className="h-96 bg-gray-200 rounded-2xl" />
              </div>
            </div>
          </div>
        </PageContainer>
      </AppLayout>
    );
  }

  // â”€â”€ Not Found â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isError || !link) {
    return (
      <AppLayout>
        <PageContainer variant="narrow" className="py-20 text-center">
          <AlertTriangle className="size-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[var(--fg-base)] mb-2">{vi.shortLinks.detail.notFoundTitle}</h2>
          <p className="text-[var(--fg-muted)] text-sm mb-4">{vi.shortLinks.detail.notFoundDescription}</p>
          <Link href="/short-links" className="text-[var(--accent)] font-bold text-sm hover:underline">{vi.shortLinks.detail.backToList}</Link>
        </PageContainer>
      </AppLayout>
    );
  }

  const progress = link.max_clicks > 0 ? (link.current_clicks / link.max_clicks) * 100 : 0;
  const statusLabel = link.status === "active" ? `🟢 ${vi.shortLinks.shared.active}` : link.status === "expired" ? `🟡 ${vi.shortLinks.shared.expired}` : `🔴 ${vi.shortLinks.shared.disabled}`;
  const statusColor = link.status === "active" ? "bg-emerald-100 text-emerald-600"
                     : link.status === "expired" ? "bg-amber-100 text-amber-600"
                     : "bg-red-100 text-red-500";

  const tabProps = { link, clicks, stats, isLoading };

  return (
    <AppLayout>
      <PageContainer className="relative">
        {/* Breadcrumbs & Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2 mt-2">
          <div>
            <div className="flex items-center gap-2 text-[var(--accent)] text-[13px] font-bold mb-1.5">
              <Link className="hover:underline flex items-center gap-1" href="/short-links">
                <ArrowLeft className="size-3" /> {vi.shortLinks.page.title}
              </Link>
              <ChevronRight className="size-3" />
              <span className="text-[var(--fg-muted)]">{link.title || link.slug}</span>
            </div>
            <h1 className="text-3xl font-black text-[var(--fg-base)] tracking-tight flex items-center gap-3">
              {vi.shortLinks.detail.title}
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2.5 py-1 rounded-full animate-pulse">
                <RefreshCw className="size-3" /> {vi.shortLinks.detail.updated}
              </span>
            </h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-xl text-[13px] font-bold hover:bg-[var(--accent)]/5 hover:border-[var(--accent)]/30 transition-all shadow-sm text-[var(--fg-base)] cursor-pointer">
              <Copy className="size-4" /> {vi.shortLinks.detail.copyLink}
            </button>
            {publicUrl ? (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[var(--border-soft)] rounded-xl text-[13px] font-bold text-[var(--fg-base)] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/5 transition-all shadow-sm cursor-pointer">
                <Globe className="size-4" /> Xem trang chia sẻ
              </a>
            ) : null}
            <a href={link.target_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[13px] font-bold text-blue-600 hover:bg-blue-100 transition-all shadow-sm cursor-pointer">
              <ExternalLink className="size-4" /> {vi.shortLinks.detail.openTarget}
            </a>
            <button onClick={handleToggleStatus} className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all shadow-sm cursor-pointer border",
              link.status === "active"
                ? "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
                : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
            )}>
              <Power className="size-4" /> {link.status === "active" ? vi.shortLinks.detail.toggleOff : vi.shortLinks.detail.toggleOn}
            </button>
            <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-[13px] font-bold text-red-600 hover:bg-red-100 transition-all shadow-sm cursor-pointer">
              <Trash2 className="size-4" /> {vi.shortLinks.detail.delete}
            </button>
          </div>
        </div>

        {/* Security Trust Banner */}
        {securitySummary && stats && stats.totalClicks > 0 && (
          <div className={cn(
            "flex items-center gap-4 p-4 rounded-2xl border shadow-sm transition-all",
            securitySummary.trustScore >= 90
              ? "bg-emerald-50 border-emerald-200"
              : securitySummary.trustScore >= 70
              ? "bg-amber-50 border-amber-200"
              : "bg-red-50 border-red-200"
          )}>
            <div className={cn(
              "size-12 rounded-xl flex items-center justify-center text-white shadow-lg",
              securitySummary.trustScore >= 90 ? "bg-emerald-500" :
              securitySummary.trustScore >= 70 ? "bg-amber-500" : "bg-red-500"
            )}>
              <Shield className="size-6" />
            </div>
            <div className="flex-1">
                <p className="text-[13px] font-bold text-[var(--fg-base)]">
                {vi.shortLinks.detail.trustScore}: <span className={cn(
                  "text-lg",
                  securitySummary.trustScore >= 90 ? "text-emerald-600" :
                  securitySummary.trustScore >= 70 ? "text-amber-600" : "text-red-600"
                )}>{securitySummary.trustScore}%</span>
              </p>
              <p className="text-[11px] text-[var(--fg-muted)]">
                {vi.shortLinks.detail.securitySummaryText(securitySummary.cleanClicks, stats.suspiciousCount, stats.totalClicks)}
              </p>
            </div>
            <div className="flex gap-3">
              <div className="text-center">
                <p className="text-lg font-black text-emerald-600">{securitySummary.cleanClicks}</p>
                <p className="text-[9px] font-bold text-[var(--fg-muted)] uppercase">{vi.shortLinks.detail.cleanClicks}</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-red-500">{stats.suspiciousCount}</p>
                <p className="text-[9px] font-bold text-[var(--fg-muted)] uppercase">{vi.shortLinks.detail.suspiciousClicks}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* â”€â”€ Left Column (4 cols) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="col-span-12 lg:col-span-4 space-y-5">
            {/* Link Info Card */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] p-6 rounded-2xl shadow-sm">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center text-white text-2xl mb-3 shadow-lg">
                  <Link2 className="size-7" />
                </div>
                <h2 className="text-xl font-bold text-[var(--fg-base)] tracking-tight">
                  {link.title || vi.shortLinks.detail.unnamed}
                </h2>
                <div className="mt-2 flex items-center gap-2 flex-wrap justify-center">
                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${statusColor}`}>
                    {statusLabel}
                  </span>
                  {link.require_token && (
                    <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-violet-100 text-violet-600 flex items-center gap-1">
                      <ShieldCheck className="size-3" /> {vi.shortLinks.card.token}
                    </span>
                  )}
                  {link.notify_clicks && (
                    <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-amber-100 text-amber-600 flex items-center gap-1">
                      <Bell className="size-3" /> {vi.shortLinks.shared.telegram}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-5 border-t border-[var(--border-soft)]">
                <InfoRow icon={<Link2 className="size-4" />} iconColor="blue" label={vi.shortLinks.detail.slugLabel} value={`/s/${link.slug}`} mono />
                <InfoRow icon={<ExternalLink className="size-4" />} iconColor="emerald" label={vi.shortLinks.page.targetUrl} value={maskUrl(link.target_url)} />
                {salesChannel && (
                  <InfoRow
                    icon={<Store className="size-4" />}
                    iconColor="blue"
                    label="Kênh bán"
                    value={salesChannel.name ?? "Không rõ"}
                  />
                )}
                {orderId && orderHref && (
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--border-soft)]/30 transition-colors">
                    <div className="size-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <ExternalLink className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-[var(--fg-muted)] font-bold uppercase tracking-wider block">Đơn gốc</span>
                      <Link
                        href={orderHref}
                        className="text-[13px] font-bold truncate block text-[var(--accent)] hover:underline"
                        title={orderId}
                      >
                        {orderId.slice(0, 8).toUpperCase()}
                      </Link>
                    </div>
                  </div>
                )}
                {resolvedPolicy && (
                  <>
                    <InfoRow
                      icon={<RefreshCw className="size-4" />}
                      iconColor="emerald"
                      label="Cách mở link"
                      value={getDeliveryModeLabel(resolvedPolicy.effectiveDeliveryMode)}
                    />
                    <InfoRow
                      icon={<ShieldCheck className="size-4" />}
                      iconColor="violet"
                      label="Mẫu landing"
                      value={getLandingTemplateLabel(resolvedPolicy.effectiveLandingTemplateKey)}
                    />
                    <InfoRow
                      icon={<Shield className="size-4" />}
                      iconColor="gray"
                      label="Nguồn quyết định"
                      value={`${getPolicySourceLabel(resolvedPolicy.deliveryModeSource)} / ${getPolicySourceLabel(resolvedPolicy.landingTemplateSource)}`}
                    />
                  </>
                )}
                {link.access_token && (
                  <InfoRow icon={<ScanLine className="size-4" />} iconColor="violet" label={vi.shortLinks.detail.tokenLabel} value={link.access_token} mono accent />
                )}
                {link.locked_ip && (
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-50 border border-blue-200/40">
                    <div className="size-8 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
                      <Lock className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block">{vi.shortLinks.card.ipLocked}</span>
                      <span className="text-[13px] font-bold text-blue-700 font-mono">{link.locked_ip}</span>
                    </div>
                    <button onClick={handleUnlockIP} className="px-2.5 py-1 bg-blue-500 text-white text-[10px] font-bold rounded-lg cursor-pointer hover:bg-blue-600 transition-colors flex items-center gap-1">
                      <Unlock className="size-3" /> {vi.shortLinks.card.unlockIp}
                    </button>
                  </div>
                )}
                <InfoRow icon={<Clock className="size-4" />} iconColor="gray" label={vi.shortLinks.detail.createdAt} value={formatDate(link.created_at)} />
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label={vi.shortLinks.analytics.totalClicks} value={Math.max(link.current_clicks, stats?.totalClicks ?? 0)} sub={vi.shortLinks.detail.maxClicksSummary(link.max_clicks)} />
              <StatCard label={vi.shortLinks.analytics.uniqueIPs} value={stats?.uniqueIPs ?? (link.current_clicks > 0 ? "—" : 0)} color="text-blue-500" />
              <StatCard label={vi.shortLinks.analytics.suspicious} value={stats?.suspiciousCount ?? 0}
                color={(stats?.suspiciousCount ?? 0) > 0 ? "text-red-500" : "text-emerald-500"}
                highlight={(stats?.suspiciousCount ?? 0) > 0}
              />
              <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] p-4 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-1">{vi.shortLinks.analytics.device}</p>
                <div className="space-y-0.5">
                  {stats?.devices && Object.keys(stats.devices).length > 0 ? Object.entries(stats.devices).map(([type, count]) => {
                    const Icon = DEVICE_ICONS[type] || Globe;
                    return (
                      <div key={type} className="flex items-center text-[11px] gap-1">
                        <Icon className="size-3 text-[var(--fg-muted)]" />
                        <span className="text-[var(--fg-muted)]">{formatDeviceTypeLabel(type)}</span>
                        <span className="font-bold ml-auto">{count}</span>
                      </div>
                    );
                  }) : <span className="text-[var(--fg-muted)] text-xs">{vi.shortLinks.analytics.noData}</span>}
                </div>
              </div>
            </div>

            {/* Sync notice when clicks exist but no detailed data */}
            {link.current_clicks > 0 && (stats?.totalClicks ?? 0) === 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-600 flex items-center gap-2">
                <Activity className="size-4 shrink-0" />
                <span>{vi.shortLinks.detail.syncNotice(link.current_clicks)}</span>
              </div>
            )}

            {/* Progress Bar */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest flex items-center gap-1.5">
                  <Activity className="size-3" /> {vi.shortLinks.detail.usageProgress}
                </p>
                <span className="text-[13px] font-black text-[var(--accent)]">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-[var(--border-soft)] h-2.5 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    progress >= 100 ? "bg-red-500" : progress >= 70 ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              {link.expires_at && (
                <p className="text-[10px] text-[var(--fg-muted)] mt-2 flex items-center gap-1">
                  <Clock className="size-3" /> {vi.shortLinks.detail.expiresAt} {formatDate(link.expires_at)}
                </p>
              )}
            </div>
          </div>

          {/* â”€â”€ Right Column (8 cols) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Tab Navigation */}
            <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-soft)] p-1 rounded-xl shadow-sm">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-[12px] font-bold rounded-lg transition-all cursor-pointer flex-1 justify-center ${
                    activeTab === tab.id
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : "text-[var(--fg-muted)] hover:bg-[var(--surface-light)]"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content â€” Dynamic Imports */}
            {activeTab === "analytics" && (
              <div className="bg-[var(--bg-surface)] rounded-2xl shadow-sm overflow-hidden border border-[var(--border-soft)]">
                <div className="p-5 border-b border-[var(--border-soft)] flex justify-between items-center">
                  <h3 className="text-[15px] font-bold text-[var(--fg-base)] flex items-center gap-2">
                    <BarChart3 className="text-purple-500 size-5" /> {vi.shortLinks.detail.analyticsTitle}
                  </h3>
                  <span className="bg-purple-500/10 text-purple-500 text-[11px] font-bold px-2.5 py-1 rounded-full">
                    {stats?.totalClicks ?? 0} {vi.shortLinks.shared.clicks}
                  </span>
                </div>
                <AnalyticsTab {...tabProps} />
              </div>
            )}

            {activeTab === "clicks" && <ClicksTab {...tabProps} />}

            {activeTab === "settings" && <SettingsTab link={link} onDelete={handleDelete} />}
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}

// â”€â”€ Reusable Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function InfoRow({ icon, iconColor, label, value, mono, accent }: {
  icon: React.ReactNode; iconColor: string; label: string; value: string; mono?: boolean; accent?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    emerald: "bg-emerald-100 text-emerald-600",
    violet: "bg-violet-100 text-violet-600",
    gray: "bg-[var(--border-soft)] text-[var(--fg-muted)]",
  };
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--border-soft)]/30 transition-colors">
      <div className={`size-8 rounded-full ${colorMap[iconColor]} flex items-center justify-center shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <span className="text-[10px] text-[var(--fg-muted)] font-bold uppercase tracking-wider block">{label}</span>
        <span className={cn("text-[13px] font-bold truncate block",
          accent ? "text-violet-600" : "text-[var(--fg-base)]",
          mono && "font-mono"
        )}>{value}</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, highlight }: {
  label: string; value: string | number; sub?: string; color?: string; highlight?: boolean;
}) {
  return (
    <div className={cn(
      "border p-4 rounded-xl shadow-sm",
      highlight ? "bg-red-50 border-red-200" : "bg-[var(--bg-surface)] border-[var(--border-soft)]"
    )}>
      <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-black ${color ?? "text-[var(--fg-base)]"}`}>{value}</p>
      {sub && <p className="text-[10px] text-[var(--fg-muted)] font-medium mt-0.5">{sub}</p>}
    </div>
  );
}


