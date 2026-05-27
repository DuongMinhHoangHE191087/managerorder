"use client";

import { useDeferredValue, useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  Activity,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  KeyRound,
  Link2,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
  XCircle,
} from "lucide-react";
import { AppLayout } from "@/widgets/layout/app-layout";
import { Button } from "@/shared/ui/button";
import { EmptyState, FiltersBar, PageContainer, PageHeader, SectionHeader, StatsGrid, SurfaceCard } from "@/shared/ui/page-layout";
import { Input } from "@/shared/ui/input";
import { appToast } from "@/shared/ui/app-toast";
import { cn, formatDateLabel, formatRelativeTime } from "@/lib/utils";
import { hasSearchTokens, matchesSearchQuery } from "@/shared/lib/filtering/search";
import {
  useAccountShareLogs,
  useAccountShares,
  useDeleteAccountShare,
  useUpdateAccountShare,
  type AccountShareAccessLog,
  type AccountShareFieldType,
  type AccountShareLink,
} from "@/widgets/pages/inventory/hooks/use-account-shares";

type StatusFilter = "all" | AccountShareLink["status"];

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "active", label: "Đang mở" },
  { id: "disabled", label: "Đã tắt" },
  { id: "expired", label: "Hết hạn" },
];

const FIELD_LABELS: Record<AccountShareFieldType, string> = {
  email: "Tài khoản",
  password: "Mật khẩu",
  link_join: "Link invite",
  "2fa": "2FA",
  "2fa_backup": "Backup code",
  duolingo_id: "Duolingo ID",
  other: "Khác",
};

export default function AccountSharesPageClient() {
  const { data: shares = [], isLoading, isFetching, refetch } = useAccountShares(null);
  const updateShare = useUpdateAccountShare();
  const deleteShare = useDeleteAccountShare();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedLogsId, setExpandedLogsId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredShares = useMemo(() => {
    const sorted = [...shares].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sorted.filter((share) => {
      if (statusFilter !== "all" && share.status !== statusFilter) {
        return false;
      }

      if (!hasSearchTokens(deferredSearchQuery)) {
        return true;
      }

      return matchesSearchQuery(
        deferredSearchQuery,
        share.title,
        share.slug,
        share.publicUrl,
        share.sourceAccountId,
        share.orderId,
        share.orderItemId,
        share.customerId,
        share.exposurePolicy.fields.join(" "),
      );
    });
  }, [deferredSearchQuery, shares, statusFilter]);

  const stats = useMemo(() => {
    return shares.reduce(
      (acc, share) => {
        acc.total += 1;
        if (share.status === "active") acc.active += 1;
        if (share.passcodeRequired) acc.protected += 1;
        if (share.exposurePolicy.fields.some((field) => field === "password" || field === "2fa" || field === "2fa_backup")) {
          acc.sensitive += 1;
        }
        if (nowMs && share.expiresAt && new Date(share.expiresAt).getTime() <= nowMs + 48 * 60 * 60 * 1000) {
          acc.expiringSoon += 1;
        }
        return acc;
      },
      { total: 0, active: 0, protected: 0, sensitive: 0, expiringSoon: 0 },
    );
  }, [nowMs, shares]);

  const handleCopy = async (share: AccountShareLink) => {
    await appToast.copy(share.publicUrl, "Đã sao chép link share");
    setCopiedId(share.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  const handleToggleStatus = async (share: AccountShareLink) => {
    const nextStatus = share.status === "active" ? "disabled" : "active";
    await updateShare.mutateAsync({ id: share.id, status: nextStatus });
    appToast.success(nextStatus === "active" ? "Đã bật lại link share" : "Đã tắt link share");
  };

  const handleDelete = async (share: AccountShareLink) => {
    if (!window.confirm("Thu hồi link share này? Khách sẽ không mở được link nữa.")) {
      return;
    }
    await deleteShare.mutateAsync(share);
    if (expandedLogsId === share.id) {
      setExpandedLogsId(null);
    }
    appToast.success("Đã thu hồi link share");
  };

  return (
    <AppLayout>
      <PageContainer variant="wide" className="pb-20">
        <PageHeader
          eyebrow={<><ShieldCheck className="size-4" /> Kho share bảo mật</>}
          title="Chia sẻ tài khoản"
          description="Quản lý toàn bộ link share tài khoản, mật khẩu, invite Duolingo, mã 2FA và lịch sử truy cập theo cùng một màn vận hành."
          actions={
            <>
              <Button variant="secondary" onClick={() => void refetch()} isLoading={isFetching && !isLoading}>
                <RefreshCw className="size-4" />
                Tải lại
              </Button>
              <Link
                href="/inventory"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[1rem] border border-transparent bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-4 py-2 text-sm font-semibold tracking-tight text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-[background-color,border-color,box-shadow,color,opacity,transform,width] hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
              >
                <Link2 className="size-4" />
                Tạo từ kho
              </Link>
            </>
          }
        />

        <StatsGrid className="xl:grid-cols-5">
          <StatCard label="Tổng link" value={stats.total} icon={Link2} />
          <StatCard label="Đang mở" value={stats.active} icon={CheckCircle2} tone="green" />
          <StatCard label="Có mã mở khóa" value={stats.protected} icon={Lock} tone="amber" />
          <StatCard label="Có dữ liệu nhạy cảm" value={stats.sensitive} icon={KeyRound} tone="red" />
          <StatCard label="Sắp hết hạn" value={stats.expiringSoon} icon={Clock} tone="blue" />
        </StatsGrid>

        <FiltersBar sticky className="px-4 py-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Tìm theo tiêu đề, slug, link, tài khoản nguồn, đơn hàng..."
                className="pl-9"
              />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                <Filter className="size-3.5" />
                Trạng thái
              </span>
              <div className="flex min-w-0 flex-wrap gap-1 rounded-2xl border border-[var(--border-soft)] bg-white p-1">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setStatusFilter(filter.id)}
                    className={cn(
                      "rounded-xl px-3 py-1.5 text-[12px] font-bold transition",
                      statusFilter === filter.id
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--fg-muted)] hover:bg-[var(--surface-light)] hover:text-[var(--fg-base)]",
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </FiltersBar>

        <SurfaceCard className={isFetching && !isLoading ? "pointer-events-none opacity-70" : undefined}>
          <SectionHeader
            title="Danh sách share vault"
            description={`${filteredShares.length} link phù hợp bộ lọc hiện tại`}
          />

          {isLoading ? (
            <ShareListSkeleton />
          ) : filteredShares.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="size-6" />}
              title="Chưa có link share phù hợp"
              description="Tạo link từ chi tiết tài khoản nguồn hoặc từ đơn hàng đã gán tài khoản để bắt đầu theo dõi."
              action={
                <Link href="/inventory" className="text-[13px] font-bold text-[var(--accent)] hover:underline">
                  Mở kho hàng
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-[var(--border-soft)]">
              {filteredShares.map((share) => (
                <ShareRow
                  key={share.id}
                  share={share}
                  nowMs={nowMs}
                  copied={copiedId === share.id}
                  expanded={expandedLogsId === share.id}
                  isMutating={updateShare.isPending || deleteShare.isPending}
                  onCopy={() => void handleCopy(share)}
                  onToggleStatus={() => void handleToggleStatus(share)}
                  onDelete={() => void handleDelete(share)}
                  onToggleLogs={() => setExpandedLogsId((current) => current === share.id ? null : share.id)}
                />
              ))}
            </div>
          )}
        </SurfaceCard>
      </PageContainer>
    </AppLayout>
  );
}

function ShareRow({
  share,
  nowMs,
  copied,
  expanded,
  isMutating,
  onCopy,
  onToggleStatus,
  onDelete,
  onToggleLogs,
}: {
  share: AccountShareLink;
  nowMs: number;
  copied: boolean;
  expanded: boolean;
  isMutating: boolean;
  onCopy: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onToggleLogs: () => void;
}) {
  const status = getStatusMeta(share, nowMs);

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.7fr)_minmax(240px,0.85fr)_auto] xl:items-start">
        <div className="min-w-0 space-y-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold", status.className)}>
              <status.icon className="size-3.5" />
              {status.label}
            </span>
            {share.passcodeRequired ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                <Lock className="size-3.5" />
                Cần mã
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">
                <Unlock className="size-3.5" />
                Không mã
              </span>
            )}
            {share.accessPolicy.lockToIp ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                <ShieldCheck className="size-3.5" />
                Khóa IP
              </span>
            ) : null}
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-black text-[var(--fg-base)]">
              {share.title || `Share ${share.slug}`}
            </h2>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <code className="min-w-0 truncate rounded-lg bg-[var(--surface-light)] px-2 py-1 text-[11px] font-bold text-[var(--fg-muted)]">
                {share.publicUrl}
              </code>
              <a
                href={share.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-light)] hover:text-[var(--fg-base)]"
                title="Mở link"
              >
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap gap-1.5">
            {share.exposurePolicy.fields.map((field) => (
              <span key={field} className="rounded-md border border-[var(--border-soft)] bg-white px-2 py-1 text-[11px] font-bold text-[var(--fg-muted)]">
                {FIELD_LABELS[field] ?? field}
              </span>
            ))}
            {share.exposurePolicy.credentialIds?.length ? (
              <span className="rounded-md bg-[var(--surface-light)] px-2 py-1 text-[11px] font-bold text-[var(--fg-base)]">
                {share.exposurePolicy.credentialIds.length} credential riêng
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2">
          <ProgressMetric label="Lượt xem" current={share.viewCount} max={share.maxViews} icon={Eye} />
          <ProgressMetric label="Mở khóa" current={share.unlockCount} max={share.maxUnlocks} icon={Lock} />
        </div>

        <div className="grid gap-2 text-[12px] font-semibold text-[var(--fg-muted)]">
          <InfoLine label="Tạo" value={formatDate(share.createdAt)} />
          <InfoLine label="Hết hạn" value={formatOptionalDate(share.expiresAt)} />
          <InfoLine
            label="Tài khoản nguồn"
            value={
              <Link href={`/inventory/source-accounts/${share.sourceAccountId}`} className="font-bold text-[var(--accent)] hover:underline">
                {shortId(share.sourceAccountId)}
              </Link>
            }
          />
          {share.orderId ? <InfoLine label="Đơn hàng" value={shortId(share.orderId)} /> : null}
          {share.customerId ? <InfoLine label="Khách" value={shortId(share.customerId)} /> : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
          <IconButton title="Sao chép" onClick={onCopy} disabled={isMutating}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </IconButton>
          <IconButton title={share.status === "active" ? "Tắt link" : "Bật link"} onClick={onToggleStatus} disabled={isMutating}>
            {share.status === "active" ? <Ban className="size-4" /> : <CheckCircle2 className="size-4" />}
          </IconButton>
          <IconButton title="Nhật ký" onClick={onToggleLogs} disabled={isMutating}>
            <Activity className="size-4" />
          </IconButton>
          <IconButton title="Thu hồi" onClick={onDelete} disabled={isMutating} danger>
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      {expanded ? <ShareLogs shareId={share.id} /> : null}
    </div>
  );
}

function ShareLogs({ shareId }: { shareId: string }) {
  const { data: logs = [], isLoading } = useAccountShareLogs(shareId, true);

  return (
    <div className="mt-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-3">
      <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Nhật ký truy cập</p>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-xl bg-white" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="rounded-xl bg-white px-3 py-2 text-[12px] font-semibold text-[var(--fg-muted)]">Chưa có sự kiện truy cập.</p>
      ) : (
        <div className="space-y-2">
          {logs.slice(0, 12).map((log) => (
            <ShareLogLine key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShareLogLine({ log }: { log: AccountShareAccessLog }) {
  const meta = getEventMeta(log.eventType);
  return (
    <div className="grid gap-2 rounded-xl bg-white px-3 py-2 text-[12px] font-semibold text-[var(--fg-muted)] md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
      <span className={cn("inline-flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold", meta.className)}>
        <meta.icon className="size-3.5" />
        {meta.label}
      </span>
      <span className="min-w-0 truncate">
        {log.ipAddress || "Không có IP"} {log.ipVersion ? `· ${log.ipVersion}` : ""}
      </span>
      <span className="min-w-0 truncate md:text-right">
        {formatDate(log.createdAt)}{log.reason ? ` · ${log.reason}` : ""}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "green" | "amber" | "red" | "blue";
}) {
  const toneClass = {
    default: "text-[var(--accent)] bg-[rgba(var(--accent-rgb),0.1)]",
    green: "text-emerald-700 bg-emerald-50",
    amber: "text-amber-700 bg-amber-50",
    red: "text-red-700 bg-red-50",
    blue: "text-blue-700 bg-blue-50",
  }[tone];

  return (
    <div className="app-card flex items-center gap-3 px-5 py-4">
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", toneClass)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">{label}</div>
        <div className="mt-1 text-2xl font-black tracking-tight text-[var(--fg-base)]">{value}</div>
      </div>
    </div>
  );
}

function ProgressMetric({
  label,
  current,
  max,
  icon: Icon,
}: {
  label: string;
  current: number;
  max: number;
  icon: ComponentType<{ className?: string }>;
}) {
  const percent = Math.min(100, Math.round((current / Math.max(1, max)) * 100));
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-[12px] font-bold text-[var(--fg-base)]">
        <span className="inline-flex items-center gap-1">
          <Icon className="size-3.5 text-[var(--fg-muted)]" />
          {label}
        </span>
        <span>{current}/{max}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-light)]">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="shrink-0 text-[var(--fg-muted)]">{label}</span>
      <span className="min-w-0 truncate text-right text-[var(--fg-base)]">{value}</span>
    </div>
  );
}

function IconButton({
  children,
  title,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-xl border transition disabled:pointer-events-none disabled:opacity-50",
        danger
          ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
          : "border-[var(--border-soft)] bg-white text-[var(--fg-muted)] hover:text-[var(--fg-base)]",
      )}
    >
      {children}
    </button>
  );
}

function ShareListSkeleton() {
  return (
    <div className="divide-y divide-[var(--border-soft)]">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="px-5 py-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.7fr)_minmax(240px,0.85fr)_auto]">
            <div className="space-y-3">
              <div className="h-5 w-48 animate-pulse rounded bg-[var(--border-soft)]" />
              <div className="h-9 animate-pulse rounded-xl bg-[var(--surface-light)]" />
              <div className="h-5 w-64 animate-pulse rounded bg-[var(--border-soft)]" />
            </div>
            <div className="h-20 animate-pulse rounded-2xl bg-[var(--surface-light)]" />
            <div className="h-20 animate-pulse rounded-2xl bg-[var(--surface-light)]" />
            <div className="h-9 w-40 animate-pulse rounded-xl bg-[var(--surface-light)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function getStatusMeta(share: AccountShareLink, nowMs: number) {
  if (share.status === "disabled") {
    return { label: "Đã tắt", icon: XCircle, className: "bg-red-50 text-red-700" };
  }
  if (share.status === "expired" || (nowMs && share.expiresAt && new Date(share.expiresAt).getTime() <= nowMs)) {
    return { label: "Hết hạn", icon: Clock, className: "bg-amber-50 text-amber-700" };
  }
  return { label: "Đang mở", icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700" };
}

function getEventMeta(eventType: AccountShareAccessLog["eventType"]) {
  switch (eventType) {
    case "unlock":
      return { label: "Mở khóa", icon: Lock, className: "bg-emerald-50 text-emerald-700" };
    case "view":
      return { label: "Xem", icon: Eye, className: "bg-blue-50 text-blue-700" };
    case "copy":
      return { label: "Copy", icon: Copy, className: "bg-gray-100 text-gray-700" };
    case "totp_view":
      return { label: "Xem 2FA", icon: KeyRound, className: "bg-amber-50 text-amber-700" };
    case "blocked":
      return { label: "Bị chặn", icon: Ban, className: "bg-red-50 text-red-700" };
    default:
      return { label: eventType, icon: Activity, className: "bg-gray-100 text-gray-700" };
  }
}

function formatDate(value: string) {
  return `${formatDateLabel(value)} · ${formatRelativeTime(value)}`;
}

function formatOptionalDate(value: string | null) {
  return value ? formatDate(value) : "Không giới hạn";
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}
