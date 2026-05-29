"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, Ban, Check, CheckCircle2, Clock, Copy, ExternalLink, Eye,
  Filter, KeyRound, Link2, Loader2, Lock, RefreshCw, Search, ShieldCheck,
  Trash2, Unlock, XCircle,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
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
    appToast.success(nextStatus === "active" ? "Đã bật lại link share" : "Đã tắt link share");
  };

  const handleDelete = (share: AccountShareLink) => {
    setDeleteConfirmShare(share);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmShare) return;
    await deleteShare.mutateAsync(deleteConfirmShare);
    if (expandedLogsId === deleteConfirmShare.id) setExpandedLogsId(null);
    appToast.success("Đã thu hồi link share");
    setDeleteConfirmShare(null);
  };

  return (
    <div className="space-y-4">
      {deleteConfirmShare ? (
        <div className="fixed inset-0 flex items-center justify-center px-4" style={{ zIndex: "var(--z-modal)" }}>
          <button
            type="button"
            aria-label="Đóng xác nhận"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDeleteConfirmShare(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-title-tab"
            className="relative w-full max-w-md rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <AlertTriangle aria-hidden="true" className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 id="confirm-delete-title-tab" className="text-base font-black text-[var(--fg-base)]">
                  Thu hồi link share
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--fg-muted)]">
                  Thu hồi link share này? Khách sẽ không mở được link nữa.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmShare(null)}
                className="rounded-xl border border-[var(--border-soft)] px-4 py-2 text-sm font-bold text-[var(--fg-base)] transition-colors hover:bg-[var(--surface-light)]"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={deleteShare.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-[background-color,opacity] hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteShare.isPending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                Thu hồi
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Tổng link", value: stats.total, icon: Link2, tone: "default" as const },
          { label: "Đang mở", value: stats.active, icon: CheckCircle2, tone: "green" as const },
          { label: "Có mã khóa", value: stats.protected, icon: Lock, tone: "amber" as const },
          { label: "Nhạy cảm", value: stats.sensitive, icon: KeyRound, tone: "red" as const },
          { label: "Sắp hết hạn", value: stats.expiringSoon, icon: Clock, tone: "blue" as const },
        ].map((s) => (
          <MiniStat key={s.label} {...s} />
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tiêu đề, slug, link, tài khoản nguồn..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            <Filter className="size-3.5" />
          </span>
          <div className="flex gap-1 rounded-xl border border-[var(--border-soft)] bg-white p-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  "rounded-lg px-3 py-1 text-[11px] font-bold transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.95] active:duration-75 cursor-pointer",
                  statusFilter === f.id
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--fg-muted)] hover:bg-[var(--surface-light)] hover:text-[var(--fg-base)]",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" onClick={() => void refetch()} isLoading={isFetching && !isLoading}>
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* List */}
      <div className={cn("rounded-2xl border border-[var(--border-soft)] bg-white overflow-hidden", isFetching && !isLoading ? "opacity-70 pointer-events-none" : "")}>
        {isLoading ? (
          <div className="divide-y divide-[var(--border-soft)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-4">
                <div className="flex gap-4 items-start">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 animate-pulse rounded bg-[var(--border-soft)]" />
                    <div className="h-8 animate-pulse rounded-xl bg-[var(--surface-light)]" />
                    <div className="h-4 w-64 animate-pulse rounded bg-[var(--border-soft)]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredShares.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--surface-light)] mb-3">
              <ShieldCheck className="size-6 text-[var(--fg-muted)]" />
            </div>
            <p className="text-[14px] font-bold text-[var(--fg-base)] mb-1">Chưa có link share phù hợp</p>
            <p className="text-[12px] text-[var(--fg-muted)] max-w-xs">
              Tạo link từ chi tiết tài khoản nguồn trong kho hàng để bắt đầu theo dõi.
            </p>
            <Link href="/inventory" className="mt-3 text-[13px] font-bold text-[var(--accent)] hover:underline">
              Mở kho hàng
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
                onDelete={() => void handleDelete(share)}
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
    <div className="px-4 py-3.5">
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(160px,0.6fr)_minmax(180px,0.7fr)_auto] xl:items-start">
        {/* Left: title + url + fields */}
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold", status.className)}>
              <status.icon className="size-3" />
              {status.label}
            </span>
            {share.passcodeRequired
              ? <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700"><Lock className="size-3" /> Cần mã</span>
              : <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600"><Unlock className="size-3" /> Tự do</span>
            }
            {share.accessPolicy.lockToIp && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700"><ShieldCheck className="size-3" /> Khóa IP</span>
            )}
          </div>
          <div>
            <h3 className="truncate text-[13px] font-black text-[var(--fg-base)]">{share.title || `Share ${share.slug}`}</h3>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
              <code className="min-w-0 truncate rounded bg-[var(--surface-light)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--fg-muted)]">
                {share.publicUrl}
              </code>
              <a href={share.publicUrl} target="_blank" rel="noreferrer"
                className="inline-flex size-5 shrink-0 items-center justify-center rounded transition-[color,transform] duration-200 ease-out active:scale-90 text-[var(--fg-muted)] hover:text-[var(--fg-base)]">
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap gap-1">
            {share.exposurePolicy.fields.map((f) => (
              <span key={f} className="rounded border border-[var(--border-soft)] bg-white px-1.5 py-0.5 text-[10px] font-bold text-[var(--fg-muted)]">
                {FIELD_LABELS[f] ?? f}
              </span>
            ))}
          </div>
        </div>

        {/* Center: view progress */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-2 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--fg-base)]">
            <span className="inline-flex items-center gap-1"><Eye className="size-3 text-[var(--fg-muted)]" /> Lượt xem</span>
            <span>{share.viewCount}/{share.maxViews}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white">
            <div className="h-full rounded-full bg-[var(--accent)] transition-[width]" style={{ width: `${percent}%` }} />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--fg-base)]">
            <span className="inline-flex items-center gap-1"><Lock className="size-3 text-[var(--fg-muted)]" /> Mở khóa</span>
            <span>{share.unlockCount}/{share.maxUnlocks}</span>
          </div>
        </div>

        {/* Right meta */}
        <div className="grid gap-1 text-[11px] font-semibold text-[var(--fg-muted)]">
          <div className="flex justify-between"><span>Tạo</span><span className="text-right">{formatDateLabel(share.createdAt)}</span></div>
          <div className="flex justify-between"><span>Hết hạn</span><span className="text-right">{share.expiresAt ? formatDateLabel(share.expiresAt) : "Không giới hạn"}</span></div>
          {share.sourceAccountId && (
            <div className="flex justify-between">
              <span>Nguồn</span>
              <Link href={`/inventory/source-accounts/${share.sourceAccountId}`} className="font-bold text-[var(--accent)] hover:underline">
                {share.sourceAccountId.slice(0, 8)}...
              </Link>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-wrap gap-1.5 xl:justify-end">
          <IconBtn title="Sao chép link" onClick={onCopy} disabled={isMutating}>
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          </IconBtn>
          <IconBtn title={share.status === "active" ? "Tắt link" : "Bật link"} onClick={onToggleStatus} disabled={isMutating}>
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

      {expanded ? <ShareLogsPanel shareId={share.id} /> : null}
    </div>
  );
}

function ShareLogsPanel({ shareId }: { shareId: string }) {
  const { data: logs = [], isLoading } = useAccountShareLogs(shareId, true);
  return (
    <div className="mt-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-3">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Nhật ký truy cập</p>
      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-white" />)}
        </div>
      ) : logs.length === 0 ? (
        <p className="rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-[var(--fg-muted)]">Chưa có sự kiện.</p>
      ) : (
        <div className="space-y-1.5">
          {logs.slice(0, 10).map((log) => <LogLine key={log.id} log={log} />)}
        </div>
      )}
    </div>
  );
}

function LogLine({ log }: { log: AccountShareAccessLog }) {
  const meta = getEventMeta(log.eventType);
  return (
    <div className="grid gap-2 rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-[var(--fg-muted)] md:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)]">
      <span className={cn("inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold", meta.className)}>
        <meta.icon className="size-3" /> {meta.label}
      </span>
      <span className="min-w-0 truncate">{log.ipAddress || "—"}</span>
      <span className="min-w-0 truncate md:text-right">{formatDateLabel(log.createdAt)} · {formatRelativeTime(log.createdAt)}</span>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon, tone = "default" }: {
  label: string; value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "green" | "amber" | "red" | "blue";
}) {
  const toneClass = {
    default: "text-[var(--accent)] bg-[rgba(var(--accent-rgb),0.08)]",
    green: "text-emerald-700 bg-emerald-50",
    amber: "text-amber-700 bg-amber-50",
    red: "text-red-700 bg-red-50",
    blue: "text-blue-700 bg-blue-50",
  }[tone];
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border-soft)] bg-white px-3.5 py-3">
      <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", toneClass)}>
        <Icon className="size-4" />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">{label}</div>
        <div className="text-lg font-black text-[var(--fg-base)]">{value}</div>
      </div>
    </div>
  );
}

function IconBtn({ children, title, onClick, disabled, danger }: {
  children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg border transition-[background-color,border-color,box-shadow,color,transform] duration-200 ease-out active:scale-[0.92] active:duration-75 cursor-pointer disabled:pointer-events-none disabled:opacity-50",
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
