"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, Ban, Check, CheckCircle2, Clock, Copy, ExternalLink, Eye,
  KeyRound, Link2, Lock, RefreshCw, Search, ShieldCheck,
  Trash2, Unlock, XCircle,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { FiltersBar } from "@/shared/ui/page-layout";
import { appToast } from "@/shared/ui/app-toast";
import { cn, formatDateLabel, formatRelativeTime } from "@/lib/utils";
import { hasSearchTokens, matchesSearchQuery } from "@/shared/lib/filtering/search";
import { StaggerContainer, StaggerItem, GlassHoverCard } from "@/shared/ui/animations";
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

export function AccountSharesTab() {
  const { data: shares = [], isLoading, isFetching, refetch } = useAccountShares(null);
  const updateShare = useUpdateAccountShare();
  const deleteShare = useDeleteAccountShare();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedLogsId, setExpandedLogsId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirmShare, setDeleteConfirmShare] = useState<AccountShareLink | null>(null);
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
      if (statusFilter !== "all" && share.status !== statusFilter) return false;
      if (!hasSearchTokens(deferredSearchQuery)) return true;
      return matchesSearchQuery(
        deferredSearchQuery,
        share.title, share.slug, share.publicUrl,
        share.sourceAccountId, share.orderId, share.orderItemId, share.customerId,
        share.exposurePolicy.fields.join(" "),
      );
    });
  }, [deferredSearchQuery, shares, statusFilter]);

  const stats = useMemo(() => shares.reduce(
    (acc, share) => {
      acc.total += 1;
      if (share.status === "active") acc.active += 1;
      if (share.passcodeRequired) acc.protected += 1;
      if (share.exposurePolicy.fields.some((f) => f === "password" || f === "2fa" || f === "2fa_backup")) acc.sensitive += 1;
      if (nowMs && share.expiresAt && new Date(share.expiresAt).getTime() <= nowMs + 48 * 60 * 60 * 1000) acc.expiringSoon += 1;
      return acc;
    },
    { total: 0, active: 0, protected: 0, sensitive: 0, expiringSoon: 0 },
  ), [nowMs, shares]);

  const handleCopy = async (share: AccountShareLink) => {
    await appToast.copy(share.publicUrl, "Đã sao chép link share");
    setCopiedId(share.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  const handleToggleStatus = async (share: AccountShareLink) => {
    const nextStatus = share.status === "active" ? "disabled" : "active";
    await updateShare.mutateAsync({ id: share.id, status: nextStatus });
    appToast.success(nextStatus === "active" ? "Đã bật lại link" : "Đã tắt link");
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmShare) return;
    await deleteShare.mutateAsync(deleteConfirmShare);
    if (expandedLogsId === deleteConfirmShare.id) setExpandedLogsId(null);
    appToast.success("Đã thu hồi link share");
    setDeleteConfirmShare(null);
  };

  return (
    <div className="space-y-3">
      {/* Delete confirm */}
      {deleteConfirmShare ? (
        <div className="fixed inset-0 flex items-center justify-center px-4" style={{ zIndex: "var(--z-modal)" }}>
          <button type="button" aria-label="Đóng" className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirmShare(null)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-sm rounded-2xl border border-[var(--border-soft)] bg-white p-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-50">
                <AlertTriangle className="size-4 text-red-600" />
              </div>
              <div>
                <p className="text-[13px] font-black text-[var(--fg-base)]">Thu hồi link share?</p>
                <p className="text-[11px] text-[var(--fg-muted)]">Khách không mở được link nữa.</p>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteConfirmShare(null)} className="rounded-xl border border-[var(--border-soft)] px-3 py-1.5 text-[12px] font-bold text-[var(--fg-base)] hover:bg-[var(--surface-light)]">Huỷ</button>
              <button type="button" onClick={() => void handleConfirmDelete()} disabled={deleteShare.isPending} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-red-700 disabled:opacity-60">
                Thu hồi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Stats */}
      <StaggerContainer delayChildren={0.1} staggerDelay={0.06} className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          { label: "Tổng link", value: stats.total, icon: Link2, color: "text-[var(--accent)] bg-[var(--accent)]/10" },
          { label: "Đang mở", value: stats.active, icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50" },
          { label: "Có mã khóa", value: stats.protected, icon: Lock, color: "text-amber-700 bg-amber-50" },
          { label: "Nhạy cảm", value: stats.sensitive, icon: KeyRound, color: "text-red-700 bg-red-50" },
          { label: "Sắp hết hạn", value: stats.expiringSoon, icon: Clock, color: "text-blue-700 bg-blue-50" },
        ].map((s) => (
          <StaggerItem key={s.label}>
            <GlassHoverCard className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-2.5 shadow-[0_1px_3px_rgba(22,60,30,0.04)]">
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", s.color)}>
                <s.icon className="size-3.5" />
              </span>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{s.label}</div>
                <div className="text-[15px] font-black leading-none text-[var(--fg-base)]">{s.value}</div>
              </div>
            </GlassHoverCard>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {/* Filters */}
      <FiltersBar className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--fg-muted)]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tiêu đề, slug, link..."
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="flex gap-1 rounded-lg border border-[var(--border-soft)] bg-white p-0.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-bold transition-all duration-150",
                  statusFilter === f.id ? "bg-[var(--accent)] text-white" : "text-[var(--fg-muted)] hover:bg-[var(--surface-light)]",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => void refetch()} isLoading={isFetching && !isLoading}>
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </FiltersBar>

      {/* List */}
      <div className={cn("rounded-xl border border-[var(--border-soft)] bg-white overflow-hidden", isFetching && !isLoading ? "opacity-70 pointer-events-none" : "")}>
        {isLoading ? (
          <div className="divide-y divide-[var(--border-soft)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex gap-3 items-start">
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-36 animate-pulse rounded bg-[var(--border-soft)]" />
                    <div className="h-6 animate-pulse rounded-lg bg-[var(--surface-light)]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredShares.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--surface-light)] mb-2">
              <ShieldCheck className="size-5 text-[var(--fg-muted)]" />
            </div>
            <p className="text-[13px] font-bold text-[var(--fg-base)]">Chưa có link share</p>
            <Link href="/inventory" className="mt-1.5 text-[12px] font-bold text-[var(--accent)] hover:underline">
              Mở kho hàng →
            </Link>
          </div>
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
                onDelete={() => setDeleteConfirmShare(share)}
                onToggleLogs={() => setExpandedLogsId((cur) => cur === share.id ? null : share.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ShareRow({
  share, nowMs, copied, expanded, isMutating, onCopy, onToggleStatus, onDelete, onToggleLogs,
}: {
  share: AccountShareLink; nowMs: number; copied: boolean; expanded: boolean; isMutating: boolean;
  onCopy: () => void; onToggleStatus: () => void; onDelete: () => void; onToggleLogs: () => void;
}) {
  const status = getStatusMeta(share, nowMs);
  const percent = share.maxViews > 0 ? Math.min(100, Math.round((share.viewCount / share.maxViews) * 100)) : 0;

  return (
    <div className="px-3.5 py-3">
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(140px,0.5fr)_minmax(160px,0.6fr)_auto] xl:items-start">
        {/* Left */}
        <div className="min-w-0 space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold", status.className)}>
              <status.icon className="size-2.5" />{status.label}
            </span>
            {share.passcodeRequired
              ? <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700"><Lock className="size-2.5" />Mã</span>
              : <span className="inline-flex items-center gap-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-500"><Unlock className="size-2.5" />Tự do</span>
            }
            {share.accessPolicy.lockToIp && (
              <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700"><ShieldCheck className="size-2.5" />IP lock</span>
            )}
          </div>
          <div>
            <h3 className="truncate text-[12px] font-black text-[var(--fg-base)]">{share.title || `Share ${share.slug}`}</h3>
            <div className="mt-0.5 flex min-w-0 items-center gap-1">
              <code className="min-w-0 truncate rounded bg-[var(--surface-light)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--fg-muted)]">
                {share.publicUrl}
              </code>
              <a href={share.publicUrl} target="_blank" rel="noreferrer" className="inline-flex size-4 shrink-0 items-center justify-center rounded text-[var(--fg-muted)] hover:text-[var(--fg-base)]">
                <ExternalLink className="size-2.5" />
              </a>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap gap-1">
            {share.exposurePolicy.fields.map((f) => (
              <span key={f} className="rounded border border-[var(--border-soft)] bg-white px-1 py-0.5 text-[9px] font-bold text-[var(--fg-muted)]">
                {FIELD_LABELS[f] ?? f}
              </span>
            ))}
          </div>
        </div>

        {/* Progress */}
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-light)] px-2.5 py-2 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-[var(--fg-base)]">
            <span className="inline-flex items-center gap-0.5"><Eye className="size-2.5 text-[var(--fg-muted)]" />Xem</span>
            <span>{share.viewCount}/{share.maxViews}</span>
          </div>
          <div className="h-1 rounded-full bg-white">
            <div className="h-full rounded-full bg-[var(--accent)] transition-[width]" style={{ width: `${percent}%` }} />
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-[var(--fg-base)]">
            <span className="inline-flex items-center gap-0.5"><Lock className="size-2.5 text-[var(--fg-muted)]" />Mở</span>
            <span>{share.unlockCount}/{share.maxUnlocks}</span>
          </div>
        </div>

        {/* Meta */}
        <div className="grid gap-0.5 text-[10px] font-semibold text-[var(--fg-muted)]">
          <div className="flex justify-between"><span>Tạo</span><span>{formatDateLabel(share.createdAt)}</span></div>
          <div className="flex justify-between"><span>Hết hạn</span><span>{share.expiresAt ? formatDateLabel(share.expiresAt) : "—"}</span></div>
          {share.sourceAccountId && (
            <div className="flex justify-between">
              <span>Nguồn</span>
              <Link href={`/inventory/source-accounts/${share.sourceAccountId}`} className="font-bold text-[var(--accent)] hover:underline">
                {share.sourceAccountId.slice(0, 8)}…
              </Link>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-wrap gap-1 xl:justify-end">
          <IconBtn title="Sao chép" onClick={onCopy} disabled={isMutating}>
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          </IconBtn>
          <IconBtn title={share.status === "active" ? "Tắt" : "Bật"} onClick={onToggleStatus} disabled={isMutating}>
            {share.status === "active" ? <Ban className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
          </IconBtn>
          <IconBtn title="Nhật ký" onClick={onToggleLogs} disabled={isMutating}>
            <Activity className="size-3.5" />
          </IconBtn>
          <IconBtn title="Thu hồi" onClick={onDelete} disabled={isMutating} danger>
            <Trash2 className="size-3.5" />
          </IconBtn>
        </div>
      </div>

      {expanded && <ShareLogsPanel shareId={share.id} />}
    </div>
  );
}

function ShareLogsPanel({ shareId }: { shareId: string }) {
  const { data: logs = [], isLoading } = useAccountShareLogs(shareId, true);
  return (
    <div className="mt-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-light)] p-2.5">
      <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Nhật ký</p>
      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-6 animate-pulse rounded bg-white" />)}
        </div>
      ) : logs.length === 0 ? (
        <p className="rounded bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[var(--fg-muted)]">Chưa có sự kiện.</p>
      ) : (
        <div className="space-y-1">
          {logs.slice(0, 8).map((log) => <LogLine key={log.id} log={log} />)}
        </div>
      )}
    </div>
  );
}

function LogLine({ log }: { log: AccountShareAccessLog }) {
  const meta = getEventMeta(log.eventType);
  return (
    <div className="grid gap-2 rounded bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[var(--fg-muted)] md:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)]">
      <span className={cn("inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold", meta.className)}>
        <meta.icon className="size-2.5" />{meta.label}
      </span>
      <span className="min-w-0 truncate">{log.ipAddress || "—"}</span>
      <span className="min-w-0 truncate md:text-right">{formatDateLabel(log.createdAt)} · {formatRelativeTime(log.createdAt)}</span>
    </div>
  );
}

function IconBtn({ children, title, onClick, disabled, danger }: {
  children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-lg border transition-all duration-150 disabled:pointer-events-none disabled:opacity-50",
        danger
          ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
          : "border-[var(--border-soft)] bg-white text-[var(--fg-muted)] hover:text-[var(--fg-base)]",
      )}>
      {children}
    </button>
  );
}

function getStatusMeta(share: AccountShareLink, nowMs: number) {
  if (share.status === "disabled") return { label: "Đã tắt", icon: XCircle, className: "bg-red-50 text-red-700" };
  if (share.status === "expired" || (nowMs && share.expiresAt && new Date(share.expiresAt).getTime() <= nowMs))
    return { label: "Hết hạn", icon: Clock, className: "bg-amber-50 text-amber-700" };
  return { label: "Đang mở", icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700" };
}

function getEventMeta(eventType: AccountShareAccessLog["eventType"]) {
  switch (eventType) {
    case "unlock": return { label: "Mở khóa", icon: Lock, className: "bg-emerald-50 text-emerald-700" };
    case "view": return { label: "Xem", icon: Eye, className: "bg-blue-50 text-blue-700" };
    case "copy": return { label: "Copy", icon: Copy, className: "bg-gray-100 text-gray-700" };
    case "totp_view": return { label: "Xem 2FA", icon: KeyRound, className: "bg-amber-50 text-amber-700" };
    case "blocked": return { label: "Bị chặn", icon: Ban, className: "bg-red-50 text-red-700" };
    default: return { label: eventType, icon: Activity, className: "bg-gray-100 text-gray-700" };
  }
}
