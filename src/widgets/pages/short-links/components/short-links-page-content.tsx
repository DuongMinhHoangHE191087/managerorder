"use client";

import { Fragment, useCallback, useDeferredValue, useMemo, useState } from "react";
import NextLink from "next/link";
import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { SectionCard } from "@/shared/ui/section-card";
import {
  useShortLinks, useCreateShortLink, useUpdateShortLink,
  useDeleteShortLink, useShortLinkAnalytics,
} from "@/widgets/pages/short-links/hooks/use-short-links";
import type { ShortLinkRow } from "@/lib/supabase/repositories/short-links.repo";
import { formatDateLabel, formatRelativeTime } from "@/lib/utils";
import {
  Link2, Plus, Copy, Trash2, ExternalLink, Clock, CheckCircle2, XCircle,
  Eye, Shield, Loader2, Search, Filter, ChevronLeft, ChevronRight, Check,
  Pencil, Save, X, ShieldCheck, ScanLine, Lock, Unlock, BarChart3,
  Smartphone, Monitor, Bot, AlertTriangle, Globe, ChevronDown,
  Bell, BellOff, CalendarPlus, CheckSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { appToast } from "@/shared/ui/app-toast";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return { label: "Hoạt động", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 };
    case "expired":
      return { label: "Hết hạn", color: "bg-amber-100 text-amber-700", icon: Clock };
    case "disabled":
      return { label: "Đã tắt", color: "bg-red-100 text-red-700", icon: XCircle };
    default:
      return { label: status, color: "bg-gray-100 text-gray-700", icon: Eye };
  }
}

function formatDate(d: string) {
  return formatDateLabel(d);
}

function formatRelative(d: string) {
  return formatRelativeTime(d);
}

function maskUrl(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname.length > 20 ? u.pathname.slice(0, 20) + "..." : u.pathname}`;
  } catch {
    return url.length > 40 ? url.slice(0, 40) + "..." : url;
  }
}

const DEVICE_ICONS: Record<string, typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Smartphone,
  bot: Bot,
};

// ── Expiry Options ──────────────────────────────────────────────────────────

const EXPIRY_OPTIONS = [
  { label: "Không giới hạn", value: "" },
  { label: "1 giờ", value: "1h" },
  { label: "6 giờ", value: "6h" },
  { label: "24 giờ", value: "24h" },
  { label: "48 giờ", value: "48h" },
  { label: "7 ngày", value: "7d" },
  { label: "30 ngày", value: "30d" },
];

function expiryToDate(value: string): string | null {
  if (!value) return null;
  const now = new Date();
  const map: Record<string, number> = {
    "1h": 3600_000, "6h": 6 * 3600_000, "24h": 24 * 3600_000,
    "48h": 48 * 3600_000, "7d": 7 * 24 * 3600_000, "30d": 30 * 24 * 3600_000,
  };
  return new Date(now.getTime() + (map[value] || 0)).toISOString();
}

const PAGE_SIZE = 10;
type StatusFilter = "all" | "active" | "expired" | "disabled";

interface EditState {
  max_clicks: number;
  expiry: string;
  status: string;
  require_token: boolean;
  notify_clicks: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ShortLinksPage() {
  const { data: links = [], isLoading } = useShortLinks();
  const createMut = useCreateShortLink();
  const updateMut = useUpdateShortLink();
  const deleteMut = useDeleteShortLink();

  const [showCreate, setShowCreate] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [form, setForm] = useState({
    target_url: "", title: "", max_clicks: 5, expiry: "", require_token: false, notify_clicks: false,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditState>({ max_clicks: 5, expiry: "", status: "active", require_token: false, notify_clicks: false });
  const [analyticsId, setAnalyticsId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "clicks" | "expiry">("newest");
  const [currentPage, setCurrentPage] = useState(0);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Bulk Select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Analytics
  const { data: analytics, isLoading: analyticsLoading } = useShortLinkAnalytics(analyticsId);

  // Stats
  const stats = useMemo(() => {
    const active = links.filter(l => l.status === "active").length;
    const expired = links.filter(l => l.status === "expired").length;
    const totalClicks = links.reduce((s, l) => s + l.current_clicks, 0);
    const protectedLinks = links.filter(l => l.require_token).length;
    return { total: links.length, active, expired, totalClicks, protectedLinks };
  }, [links]);

  // Filtered + searched
  const filteredLinks = useMemo(() => {
    let result = links;
    if (statusFilter !== "all") result = result.filter(l => l.status === statusFilter);
    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(l =>
        l.title?.toLowerCase().includes(q) ||
        l.slug.toLowerCase().includes(q) ||
        l.target_url.toLowerCase().includes(q)
      );
    }
    
    // Sort
    if (sortOrder === "clicks") {
      result = [...result].sort((a, b) => b.current_clicks - a.current_clicks);
    } else if (sortOrder === "expiry") {
      result = [...result].sort((a, b) => {
        if (!a.expires_at) return 1;
        if (!b.expires_at) return -1;
        return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
      });
    } else {
      result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    
    return result;
  }, [links, statusFilter, deferredSearchQuery, sortOrder]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLinks.length / PAGE_SIZE));
  const paginatedLinks = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredLinks.slice(start, start + PAGE_SIZE);
  }, [filteredLinks, currentPage]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(0);
  }, []);

  const handleFilterChange = useCallback((value: StatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(0);
  }, []);

  const handleCreate = async () => {
    if (!form.target_url) { appToast.error("Vui lòng nhập URL đích"); return; }
    try {
      const result = await createMut.mutateAsync({
        target_url: form.target_url,
        title: form.title || undefined,
        max_clicks: form.max_clicks,
        expires_at: expiryToDate(form.expiry),
        require_token: form.require_token,
        notify_clicks: form.notify_clicks,
      });
      setCreatedSlug((result as { slug?: string; access_token?: string | null })?.slug || null);
      setForm({ target_url: "", title: "", max_clicks: 5, expiry: "", require_token: false, notify_clicks: false });
    } catch { /* handled by mutation */ }
  };

  const handleCopy = (slug: string, token?: string | null) => {
    const url = `${getBaseUrl()}/s/${slug}${token ? `?t=${token}` : ""}`;
    appToast.copy(url, "Đã copy link");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn chắc chắn muốn xoá link này?")) return;
    await deleteMut.mutateAsync(id);
    if (analyticsId === id) setAnalyticsId(null);
  };

  const startEdit = (link: typeof links[0]) => {
    setEditingId(link.id);
    setEditForm({
      max_clicks: link.max_clicks, expiry: "",
      status: link.status, require_token: link.require_token ?? false,
      notify_clicks: link.notify_clicks ?? false,
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    const updates: Record<string, unknown> = {};
    const original = links.find(l => l.id === id);

    if (original && editForm.max_clicks !== original.max_clicks) updates.max_clicks = editForm.max_clicks;
    if (editForm.expiry) updates.expires_at = expiryToDate(editForm.expiry);
    if (original && editForm.status !== original.status) updates.status = editForm.status;
    if (original && editForm.require_token !== (original.require_token ?? false)) updates.require_token = editForm.require_token;
    if (original && editForm.notify_clicks !== (original.notify_clicks ?? false)) updates.notify_clicks = editForm.notify_clicks;

    if (Object.keys(updates).length === 0) {
      appToast.info("Không có thay đổi");
      setEditingId(null);
      return;
    }

    await updateMut.mutateAsync({ id, ...updates } as Parameters<typeof updateMut.mutateAsync>[0]);
    setEditingId(null);
  };

  const handleUnlockIP = async (id: string) => {
    await updateMut.mutateAsync({ id, locked_ip: null });
    appToast.success("Đã mở khoá IP");
  };

  const handleQuickRenew = async (id: string, days: number) => {
    const link = links.find(l => l.id === id);
    if (!link) return;
    const baseDate = link.expires_at && new Date(link.expires_at) > new Date() ? new Date(link.expires_at) : new Date();
    const expires_at = new Date(baseDate.getTime() + days * 24 * 3600_000).toISOString();
    await updateMut.mutateAsync({ id, expires_at, status: link.status === 'expired' ? 'active' : link.status });
  };

  const handleToggleSelectAll = useCallback(() => {
    if (selectedIds.size === paginatedLinks.length && paginatedLinks.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedLinks.map(l => l.id)));
    }
  }, [paginatedLinks, selectedIds.size]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBulkRenew = async (days: number) => {
    const ids = Array.from(selectedIds);
    await Promise.allSettled(
      ids.map(id => {
        const link = links.find(l => l.id === id);
        if (!link) return Promise.resolve();
        const baseDate = link.expires_at && new Date(link.expires_at) > new Date() ? new Date(link.expires_at) : new Date();
        const expires_at = new Date(baseDate.getTime() + days * 24 * 3600_000).toISOString();
        return updateMut.mutateAsync({ id, expires_at, status: link.status === 'expired' ? 'active' : link.status });
      })
    );
    appToast.success(`Đã gia hạn ${days} ngày cho ${ids.length} link`);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Bạn chắc chắn muốn xoá ${selectedIds.size} link?`)) return;
    const ids = Array.from(selectedIds);
    await Promise.allSettled(ids.map(id => deleteMut.mutateAsync(id)));
    appToast.success(`Đã xoá ${ids.length} link`);
    setSelectedIds(new Set());
  };

  const FILTER_OPTIONS: { label: string; value: StatusFilter; count: number }[] = [
    { label: "Tất cả", value: "all", count: stats.total },
    { label: "Hoạt động", value: "active", count: stats.active },
    { label: "Hết hạn", value: "expired", count: stats.expired },
  ];

  return (
    <AppLayout>
      <PageContainer>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 mt-2">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--fg-base)] flex items-center gap-3">
              <Link2 className="size-9 text-[var(--accent)]" />
              Link rút gọn
            </h1>
            <p className="text-[15px] text-[var(--fg-muted)] font-medium mt-1">
              Quản lý link rút gọn chống gian lận • Anti-Fraud D+C System
            </p>
          </div>
          <button
            onClick={() => { setShowCreate(!showCreate); setCreatedSlug(null); }}
            className="flex items-center gap-2 bg-[var(--fg-base)] text-[var(--bg-app)] px-5 py-2.5 rounded-full font-bold text-sm shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="size-4" />
            Tạo link mới
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Tổng link", value: stats.total, color: "from-blue-500/20 to-indigo-500/20", icon: Link2 },
            { label: "Hoạt động", value: stats.active, color: "from-emerald-500/20 to-teal-500/20", icon: CheckCircle2 },
            { label: "Hết hạn", value: stats.expired, color: "from-amber-500/20 to-orange-500/20", icon: Clock },
            { label: "Tổng clicks", value: stats.totalClicks, color: "from-purple-500/20 to-pink-500/20", icon: BarChart3 },
            { label: "Bảo vệ Token", value: stats.protectedLinks, color: "from-violet-500/20 to-indigo-500/20", icon: ShieldCheck },
          ].map(s => (
            <div key={s.label} className={cn("glass-card p-4 rounded-2xl bg-gradient-to-br", s.color)}>
              <div className="flex items-center gap-2 mb-1">
                <s.icon className="size-3.5 text-[var(--fg-muted)]" />
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">{s.label}</p>
              </div>
              <p className="text-2xl font-black text-[var(--fg-base)]">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Create Form */}
        {showCreate && (
          <SectionCard title="✨ Tạo link rút gọn mới" description="Link bảo vệ chống gian lận với token xác thực">
            {createdSlug ? (
              <CreatedSuccess
                slug={createdSlug}
                links={links}
                onCopy={handleCopy}
                onCreateAnother={() => setCreatedSlug(null)}
                onClose={() => { setShowCreate(false); setCreatedSlug(null); }}
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1.5 block">
                    URL đích <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={form.target_url}
                    onChange={e => setForm(f => ({ ...f, target_url: e.target.value }))}
                    placeholder="https://netflix.com/invite/..."
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-[var(--border-soft)] text-sm text-[var(--fg-base)] placeholder:text-[var(--fg-muted)]/50 focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1.5 block">Tên / Label</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Netflix Slot 3"
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-[var(--border-soft)] text-sm text-[var(--fg-base)] placeholder:text-[var(--fg-muted)]/50 focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1.5 block">Max clicks</label>
                    <input
                      type="number" min={1} max={100}
                      value={form.max_clicks}
                      onChange={e => setForm(f => ({ ...f, max_clicks: Number(e.target.value) || 1 }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-[var(--border-soft)] text-sm text-[var(--fg-base)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1.5 block">Hết hạn sau</label>
                    <select
                      value={form.expiry}
                      onChange={e => setForm(f => ({ ...f, expiry: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-[var(--border-soft)] text-sm text-[var(--fg-base)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-all cursor-pointer"
                    >
                      {EXPIRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Anti-Fraud Toggle */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 border border-violet-200/40">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, require_token: !f.require_token }))}
                    className={cn(
                      "relative w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0",
                      form.require_token ? "bg-violet-500" : "bg-slate-300"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform",
                      form.require_token ? "translate-x-[22px]" : "translate-x-0.5"
                    )} />
                  </button>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-violet-700 flex items-center gap-1.5">
                      <ShieldCheck className="size-4" />
                      Bảo vệ Anti-Fraud (Token + IP Lock)
                    </p>
                    <p className="text-[11px] text-violet-600/70 font-medium mt-0.5">
                      Tạo token truy cập + khoá IP người click đầu tiên. Chống bypass hiệu quả.
                    </p>
                  </div>
                </div>

                {/* Telegram Notification Toggle */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200/40">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, notify_clicks: !f.notify_clicks }))}
                    className={cn(
                      "relative w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0",
                      form.notify_clicks ? "bg-amber-500" : "bg-slate-300"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform",
                      form.notify_clicks ? "translate-x-[22px]" : "translate-x-0.5"
                    )} />
                  </button>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-amber-700 flex items-center gap-1.5">
                      <Bell className="size-4" />
                      Thông báo Telegram khi có click
                    </p>
                    <p className="text-[11px] text-amber-600/70 font-medium mt-0.5">
                      Gửi thông báo chi tiết (IP, thiết bị, trình duyệt) qua Telegram mỗi khi có click.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleCreate}
                    disabled={createMut.isPending}
                    className="flex items-center gap-2 bg-[var(--accent)] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {createMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Tạo link
                  </button>
                  <button
                    onClick={() => { setShowCreate(false); setCreatedSlug(null); }}
                    className="px-4 py-2.5 text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg-base)] transition-colors cursor-pointer"
                  >
                    Huỷ
                  </button>
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {/* Links Table */}
        <SectionCard title="📋 Danh sách link" description={`Tổng: ${filteredLinks.length} link`}>
          {/* Search, Sort & Filter */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 mb-4">
            <button
              onClick={handleToggleSelectAll}
              className={cn(
                "flex items-center justify-center size-[42px] rounded-xl border flex-shrink-0 transition-colors cursor-pointer disabled:opacity-50",
                selectedIds.size > 0 && selectedIds.size === paginatedLinks.length ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "bg-white border-[var(--border-soft)] hover:border-[var(--accent)]/50 text-[var(--fg-muted)]"
              )}
              disabled={paginatedLinks.length === 0}
              title="Chọn tất cả trong trang này"
            >
              {selectedIds.size > 0 && selectedIds.size < paginatedLinks.length ? (
                <div className="size-3 rounded-sm bg-[var(--accent)]" />
              ) : (
                <CheckSquare className="size-5" />
              )}
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Tìm theo tên, slug hoặc URL..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-[var(--border-soft)] text-sm text-[var(--fg-base)] placeholder:text-[var(--fg-muted)]/50 focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--border-soft)]/50">
              <Filter className="size-3.5 text-[var(--fg-muted)] mx-1.5" />
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleFilterChange(opt.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    statusFilter === opt.value
                      ? "bg-[var(--bg-surface)] text-[var(--fg-base)] shadow-sm"
                      : "text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
                  )}
                >
                  {opt.label} ({opt.count})
                </button>
              ))}
            </div>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as "newest" | "clicks" | "expiry")}
              className="p-2.5 rounded-xl bg-white border border-[var(--border-soft)] text-xs font-bold text-[var(--fg-base)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none cursor-pointer"
            >
              <option value="newest">Sắp xếp: Mới nhất</option>
              <option value="clicks">Sắp xếp: Clicks cao nhất</option>
              <option value="expiry">Sắp xếp: Gần hết hạn</option>
            </select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 text-[var(--accent)] animate-spin" />
            </div>
          ) : paginatedLinks.length === 0 ? (
            <div className="text-center py-12">
              <Link2 className="size-12 text-[var(--fg-muted)]/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-[var(--fg-muted)]">
                {searchQuery || statusFilter !== "all" ? "Không tìm thấy link phù hợp" : "Chưa có link rút gọn nào"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedLinks.map(link => (
                <LinkCard
                  key={link.id}
                  link={link}
                  selected={selectedIds.has(link.id)}
                  onToggleSelect={() => handleToggleSelect(link.id)}
                  onQuickRenew={(days) => handleQuickRenew(link.id, days)}
                  isEditing={editingId === link.id}
                  showAnalytics={analyticsId === link.id}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  analytics={analyticsId === link.id ? analytics : null}
                  analyticsLoading={analyticsId === link.id && analyticsLoading}
                  onCopy={handleCopy}
                  onEdit={() => startEdit(link)}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={() => saveEdit(link.id)}
                  onDelete={() => handleDelete(link.id)}
                  onToggleAnalytics={() => setAnalyticsId(analyticsId === link.id ? null : link.id)}
                  onUnlockIP={() => handleUnlockIP(link.id)}
                  updatePending={updateMut.isPending}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-soft)]">
              <p className="text-xs text-[var(--fg-muted)] font-medium">
                Trang {currentPage + 1}/{totalPages} • {filteredLinks.length} link
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="p-1.5 rounded-lg text-[var(--fg-muted)] hover:bg-[var(--border-soft)] disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="size-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                      currentPage === i
                        ? "bg-[var(--accent)] text-white shadow-sm"
                        : "text-[var(--fg-muted)] hover:bg-[var(--border-soft)]"
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="p-1.5 rounded-lg text-[var(--fg-muted)] hover:bg-[var(--border-soft)] disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Floating Bulk Action Bar (Matches Inventory style) */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--fg-base)] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
            <span className="text-[13px] font-bold">{selectedIds.size} link đã chọn</span>
            <div className="w-px h-6 bg-white/20" />
            <button
              onClick={() => handleBulkRenew(1)}
              className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 rounded-lg transition-colors cursor-pointer"
            >
              <CalendarPlus className="size-3.5" /> +1 Ngày
            </button>
            <button
              onClick={() => handleBulkRenew(7)}
              className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 rounded-lg transition-colors cursor-pointer"
            >
              <CalendarPlus className="size-3.5" /> +7 Ngày
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="size-3.5" /> Xóa
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-1 p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="size-4 opacity-60" />
            </button>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

function CreatedSuccess({ slug, links, onCopy, onCreateAnother, onClose }: {
  slug: string;
  links: { slug: string; access_token?: string | null }[];
  onCopy: (slug: string, token?: string | null) => void;
  onCreateAnother: () => void;
  onClose: () => void;
}) {
  const link = links.find(l => l.slug === slug);
  const token = link?.access_token;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200/50">
        <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
          <Check className="size-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-emerald-700">Link đã tạo thành công!</p>
          <p className="text-xs text-emerald-600/80 font-mono truncate mt-0.5">
            {getBaseUrl()}/s/{slug}{token ? `?t=${token}` : ""}
          </p>
        </div>
        <button
          onClick={() => onCopy(slug, token)}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 active:scale-95 transition-all cursor-pointer shadow-md shadow-emerald-500/30"
        >
          <Copy className="size-3.5" />
          Copy
        </button>
      </div>

      {token && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 border border-violet-200/40">
          <ShieldCheck className="size-5 text-violet-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-violet-700">Token Anti-Fraud</p>
            <p className="text-xs font-mono text-violet-600 mt-0.5">{token}</p>
          </div>
          <button
            onClick={() => appToast.copy(token, "Đã copy token")}
            className="px-3 py-1.5 bg-violet-500 text-white text-[11px] font-bold rounded-lg cursor-pointer hover:bg-violet-600 transition-colors"
          >
            Copy Token
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={onCreateAnother} className="flex items-center gap-2 bg-[var(--accent)] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer">
          <Plus className="size-4" /> Tạo link khác
        </button>
        <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg-base)] transition-colors cursor-pointer">
          Đóng
        </button>
      </div>
    </div>
  );
}

// ── Link Card ────────────────────────────────────────────────────────────────

interface LinkCardProps {
  link: ShortLinkRow;
  selected: boolean;
  onToggleSelect: () => void;
  onQuickRenew: (days: number) => void;
  isEditing: boolean;
  showAnalytics: boolean;
  editForm: EditState;
  setEditForm: React.Dispatch<React.SetStateAction<EditState>>;
  analytics: ReturnType<typeof useShortLinkAnalytics>["data"] | null;
  analyticsLoading: boolean;
  onCopy: (slug: string, token?: string | null) => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onToggleAnalytics: () => void;
  onUnlockIP: () => void;
  updatePending: boolean;
}

function LinkCard({
  link, selected, onToggleSelect, onQuickRenew, isEditing, showAnalytics, editForm, setEditForm,
  analytics, analyticsLoading, onCopy, onEdit, onCancelEdit,
  onSaveEdit, onDelete, onToggleAnalytics, onUnlockIP, updatePending,
}: LinkCardProps) {
  const badge = getStatusBadge(link.status);
  const BadgeIcon = badge.icon;
  const progress = link.max_clicks > 0 ? (link.current_clicks / link.max_clicks) * 100 : 0;

  return (
    <div className={cn(
      "glass-card p-4 rounded-2xl transition-all group",
      isEditing ? "border-[var(--accent)]/40 ring-2 ring-[var(--accent)]/10" : "hover:border-[var(--accent)]/20"
    )}>
      <div className="flex flex-col gap-3">
        {/* Row 1: Info */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 self-start sm:self-auto mt-0.5">
            <button
              onClick={onToggleSelect}
              className={cn(
                "flex items-center justify-center size-5 rounded-md border flex-shrink-0 transition-colors",
                selected ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-soft)] hover:border-[var(--accent)]/50 text-transparent"
              )}
            >
              <Check className="size-3.5" />
            </button>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-[var(--fg-base)] truncate">
                {link.title || link.slug}
              </h3>
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", badge.color)}>
                <BadgeIcon className="size-3" /> {badge.label}
              </span>
              {link.require_token && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">
                  <ShieldCheck className="size-3" /> Token
                </span>
              )}
              {link.locked_ip && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                  <Lock className="size-3" /> IP Locked
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--fg-muted)] font-medium flex-wrap">
              <span className="flex items-center gap-1 font-mono bg-[var(--border-soft)] px-2 py-0.5 rounded-md">
                /s/{link.slug}
              </span>
              <span className="flex items-center gap-1">
                <ExternalLink className="size-3" /> {maskUrl(link.target_url)}
              </span>
              {link.access_token && (
                <span className="flex items-center gap-1 font-mono text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">
                  <ScanLine className="size-3" /> {link.access_token}
                </span>
              )}
              {link.notify_clicks && (
                <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md text-[10px] font-bold">
                  <Bell className="size-3" /> Telegram
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 h-1.5 bg-[var(--border-soft)] rounded-full overflow-hidden max-w-xs">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    progress >= 100 ? "bg-red-500" : progress >= 70 ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-[var(--fg-muted)]">
                {link.current_clicks}/{link.max_clicks} clicks
              </span>
              {link.expires_at && (
                <span className="text-[11px] text-[var(--fg-muted)] flex items-center gap-1">
                  <Clock className="size-3" /> {formatDate(link.expires_at)}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button onClick={() => onCopy(link.slug, link.access_token)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 rounded-lg transition-colors cursor-pointer" title="Copy link rút gọn">
                <Copy className="size-3.5" /> Copy
              </button>
              <button onClick={() => appToast.copy(link.target_url, "Đã copy URL gốc")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-orange-600 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg transition-colors cursor-pointer" title="Copy URL gốc">
                <ExternalLink className="size-3.5" /> URL gốc
              </button>
              <NextLink href={`/short-links/${link.id}`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors cursor-pointer" title="Xem chi tiết">
                <Eye className="size-3.5" /> Chi tiết
              </NextLink>
              <button onClick={() => onQuickRenew(1)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-600 bg-teal-500/10 hover:bg-teal-500/20 rounded-lg transition-colors cursor-pointer" title="Gia hạn nhanh 1 ngày">
                <CalendarPlus className="size-3.5" /> +1 Ngày
              </button>
              <button onClick={onToggleAnalytics} className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer", showAnalytics ? "text-purple-700 bg-purple-500/20" : "text-purple-600 bg-purple-500/10 hover:bg-purple-500/20")} title="Analytics">
                <BarChart3 className="size-3.5" />
              </button>
              <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors cursor-pointer" title="Chỉnh sửa">
                <Pencil className="size-3.5" />
              </button>
              <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer" title="Xoá">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Edit Panel */}
        {isEditing && (
          <div className="border-t border-[var(--border-soft)] pt-3 mt-1">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1 block">Max clicks</label>
                <input type="number" min={1} max={100} value={editForm.max_clicks}
                  onChange={e => setEditForm((f: EditState) => ({ ...f, max_clicks: Number(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[var(--border-soft)] text-sm text-[var(--fg-base)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1 block">Gia hạn</label>
                <select value={editForm.expiry} onChange={e => setEditForm((f: EditState) => ({ ...f, expiry: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[var(--border-soft)] text-sm text-[var(--fg-base)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none cursor-pointer"
                >
                  <option value="">Giữ nguyên</option>
                  {EXPIRY_OPTIONS.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1 block">Trạng thái</label>
                <select value={editForm.status} onChange={e => setEditForm((f: EditState) => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[var(--border-soft)] text-sm text-[var(--fg-base)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none cursor-pointer"
                >
                  <option value="active">🟢 Hoạt động</option>
                  <option value="expired">🟡 Hết hạn</option>
                  <option value="disabled">🔴 Đã tắt</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1 block">Anti-Fraud</label>
                <button
                  type="button"
                  onClick={() => setEditForm((f: EditState) => ({ ...f, require_token: !f.require_token }))}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer border",
                    editForm.require_token
                      ? "bg-violet-50 text-violet-700 border-violet-200"
                      : "bg-white text-[var(--fg-muted)] border-[var(--border-soft)]"
                  )}
                >
                  {editForm.require_token ? <ShieldCheck className="size-4" /> : <Shield className="size-4" />}
                  {editForm.require_token ? "Token ON" : "Token OFF"}
                </button>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1 block">📱 Thông báo</label>
                <button
                  type="button"
                  onClick={() => setEditForm((f: EditState) => ({ ...f, notify_clicks: !f.notify_clicks }))}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer border",
                    editForm.notify_clicks
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-white text-[var(--fg-muted)] border-[var(--border-soft)]"
                  )}
                >
                  {editForm.notify_clicks ? <Bell className="size-4" /> : <BellOff className="size-4" />}
                  {editForm.notify_clicks ? "Telegram ON" : "Telegram OFF"}
                </button>
              </div>
            </div>

            {/* IP Lock management */}
            {link.locked_ip && (
              <div className="flex items-center gap-3 mt-3 p-2.5 rounded-lg bg-blue-50 border border-blue-200/40">
                <Lock className="size-4 text-blue-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-blue-700">IP đã khoá: <span className="font-mono">{link.locked_ip}</span></p>
                </div>
                <button onClick={onUnlockIP} className="px-3 py-1 bg-blue-500 text-white text-[11px] font-bold rounded-lg cursor-pointer hover:bg-blue-600 transition-colors flex items-center gap-1">
                  <Unlock className="size-3" /> Mở khoá
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button onClick={onSaveEdit} disabled={updatePending}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {updatePending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Lưu thay đổi
              </button>
              <button onClick={onCancelEdit} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[var(--fg-muted)] hover:text-[var(--fg-base)] transition-colors cursor-pointer">
                <X className="size-3.5" /> Huỷ
              </button>
            </div>
          </div>
        )}

        {/* Analytics Panel */}
        {showAnalytics && (
          <div className="border-t border-[var(--border-soft)] pt-3 mt-1">
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-5 text-purple-500 animate-spin" />
                <span className="ml-2 text-xs text-[var(--fg-muted)]">Đang tải analytics...</span>
              </div>
            ) : analytics?.stats ? (
              <div className="space-y-4">
                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <StatMini icon={BarChart3} label="Tổng clicks" value={analytics.stats.totalClicks} color="text-purple-500" />
                  <StatMini icon={Globe} label="Unique IPs" value={analytics.stats.uniqueIPs} color="text-blue-500" />
                  <StatMini icon={AlertTriangle} label="Nghi ngờ" value={analytics.stats.suspiciousCount} color="text-red-500" />
                  <StatMini
                    icon={Monitor} label="Devices"
                    value={Object.entries(analytics.stats.devices).map(([k, v]) => `${k}: ${v}`).join(", ") || "N/A"}
                    color="text-teal-500"
                  />
                </div>

                {/* Hourly Timeline Bar Chart */}
                {analytics.stats.hourlyTimeline && analytics.stats.hourlyTimeline.some(h => h.count > 0) && (
                  <div>
                    <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-2">📊 Hoạt động click 24 giờ qua</p>
                    <div className="flex items-end gap-px h-16 bg-[var(--border-soft)]/20 rounded-lg p-1.5">
                      {analytics.stats.hourlyTimeline.map((h, i) => {
                        const maxCount = Math.max(...analytics.stats!.hourlyTimeline.map(t => t.count), 1);
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
                            {/* Tooltip on hover */}
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover/bar:block z-10">
                              <div className="bg-[#1e293b] text-white text-[9px] font-bold px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
                                {h.hour}: {h.count} click{h.count !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[8px] text-[var(--fg-muted)] mt-0.5 px-1">
                      <span>{analytics.stats.hourlyTimeline[0]?.hour}</span>
                      <span>{analytics.stats.hourlyTimeline[analytics.stats.hourlyTimeline.length - 1]?.hour}</span>
                    </div>
                  </div>
                )}

                {/* Top IPs + Referers side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Top IPs */}
                  {analytics.stats.topIPs && analytics.stats.topIPs.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1.5">🌐 Top IP truy cập</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {analytics.stats.topIPs.map((entry, i) => (
                          <div key={entry.ip} className="flex items-center gap-2 text-xs">
                            <span className={cn(
                              "inline-flex items-center justify-center size-4 rounded text-[9px] font-black",
                              i === 0 ? "bg-amber-100 text-amber-700" : "bg-[var(--border-soft)] text-[var(--fg-muted)]"
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
                    </div>
                  )}

                  {/* Referer Domains */}
                  {analytics.stats.referers && Object.keys(analytics.stats.referers).length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1.5">🔗 Nguồn truy cập</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {Object.entries(analytics.stats.referers)
                          .sort((a, b) => b[1] - a[1])
                          .map(([domain, count]) => (
                            <div key={domain} className="flex items-center gap-2 text-xs">
                              <span className="text-[var(--fg-base)] flex-1 truncate font-medium">
                                {domain === 'direct' ? '🎯 Truy cập trực tiếp' : domain}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold">
                                {count}×
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Detailed Click Log Table */}
                {(analytics.clicks?.length ?? 0) > 0 && (
                  <ClickLogTable clicks={analytics.clicks} />
                )}
              </div>
            ) : (
              <p className="text-center text-xs text-[var(--fg-muted)] py-4">Chưa có dữ liệu analytics</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Click Log Table with Expandable Rows ─────────────────────────────────────

function ClickLogTable({ clicks }: {
  clicks: Array<{
    id: string;
    ip_address: string;
    user_agent: string | null;
    referer: string | null;
    country: string | null;
    device_type: string | null;
    is_suspicious: boolean;
    suspicious_reason: string | null;
    clicked_at: string;
  }>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);

  function abbreviateReferer(ref: string | null): string {
    if (!ref) return '—';
    try { return new URL(ref).hostname; } catch { return ref.length > 30 ? ref.slice(0, 30) + '...' : ref; }
  }

  function abbreviateUA(ua: string | null): string {
    if (!ua) return 'N/A';
    // Extract browser + OS hint
    const match = ua.match(/(Chrome|Firefox|Safari|Edge|Zalo|Telegram|Facebook|Bot|curl|wget|python)\/?([\d.]*)/i);
    if (match) return `${match[1]} ${match[2] || ''}`.trim();
    return ua.length > 40 ? ua.slice(0, 40) + '...' : ua;
  }

  return (
    <div>
      <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-2">
        📋 Lịch sử click chi tiết ({clicks.length} bản ghi)
      </p>
      <div className="max-h-[400px] overflow-y-auto rounded-lg border border-[var(--border-soft)]">
        <table className="w-full text-xs">
          <thead className="bg-[var(--border-soft)]/50 sticky top-0 z-[5]">
            <tr>
              <th className="px-2.5 py-2 text-left font-bold text-[var(--fg-muted)] w-[100px]">Thời gian</th>
              <th className="px-2.5 py-2 text-left font-bold text-[var(--fg-muted)]">IP Address</th>
              <th className="px-2.5 py-2 text-left font-bold text-[var(--fg-muted)] w-[70px]">Device</th>
              <th className="px-2.5 py-2 text-left font-bold text-[var(--fg-muted)] hidden sm:table-cell">Nguồn</th>
              <th className="px-2.5 py-2 text-left font-bold text-[var(--fg-muted)] hidden sm:table-cell w-[80px]">Trình duyệt</th>
              <th className="px-2.5 py-2 text-left font-bold text-[var(--fg-muted)] w-[90px]">Trạng thái</th>
              <th className="px-2.5 py-2 w-[30px]"></th>
            </tr>
          </thead>
          <tbody>
            {clicks.slice(0, visibleCount).map((click) => {
              const DevIcon = DEVICE_ICONS[click.device_type ?? ""] || Globe;
              const isExpanded = expandedId === click.id;

              return (
                <Fragment key={click.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : click.id)}
                    className={cn(
                      "border-t border-[var(--border-soft)] cursor-pointer transition-colors",
                      click.is_suspicious
                        ? "bg-red-50/50 hover:bg-red-50"
                        : "hover:bg-[var(--border-soft)]/30",
                      isExpanded && "bg-blue-50/50"
                    )}
                  >
                    <td className="px-2.5 py-2 text-[var(--fg-muted)] whitespace-nowrap">{formatRelative(click.clicked_at)}</td>
                    <td className="px-2.5 py-2 font-mono text-[var(--fg-base)] font-medium">{click.ip_address}</td>
                    <td className="px-2.5 py-2">
                      <span className="inline-flex items-center gap-1 text-[var(--fg-muted)]">
                        <DevIcon className="size-3" />
                        <span className="capitalize">{click.device_type || "?"}</span>
                      </span>
                    </td>
                    <td className="px-2.5 py-2 hidden sm:table-cell">
                      <span className="text-[var(--fg-muted)] truncate max-w-[120px] block text-[11px]">
                        {abbreviateReferer(click.referer)}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 hidden sm:table-cell">
                      <span className="text-[11px] text-[var(--fg-muted)] truncate block max-w-[100px]">
                        {abbreviateUA(click.user_agent)}
                      </span>
                    </td>
                    <td className="px-2.5 py-2">
                      {click.is_suspicious ? (
                        <span className="inline-flex items-center gap-1 text-red-500 font-bold text-[10px]">
                          <AlertTriangle className="size-3" />
                          <span className="truncate max-w-[60px]">{click.suspicious_reason || "Nghi ngờ"}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-500 font-bold text-[10px]">
                          <CheckCircle2 className="size-3" /> Hợp lệ
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-2">
                      <ChevronDown className={cn("size-3.5 text-[var(--fg-muted)] transition-transform", isExpanded && "rotate-180")} />
                    </td>
                  </tr>

                  {/* Expanded Detail Row */}
                  {isExpanded && (
                    <tr className="border-t border-dashed border-[var(--border-soft)]">
                      <td colSpan={7} className="px-4 py-3 bg-slate-50/80">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                          <div className="space-y-2">
                            <div>
                              <span className="font-bold text-[var(--fg-muted)] uppercase tracking-wider text-[9px] block mb-0.5">User-Agent đầy đủ</span>
                              <p className="font-mono text-[10px] text-[var(--fg-base)] bg-white px-2.5 py-1.5 rounded-lg border border-[var(--border-soft)] break-all leading-relaxed">
                                {click.user_agent || '—'}
                              </p>
                            </div>
                            <div>
                              <span className="font-bold text-[var(--fg-muted)] uppercase tracking-wider text-[9px] block mb-0.5">Referer URL</span>
                              <p className="font-mono text-[10px] text-[var(--fg-base)] bg-white px-2.5 py-1.5 rounded-lg border border-[var(--border-soft)] break-all">
                                {click.referer || 'Truy cập trực tiếp (direct)'}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="font-bold text-[var(--fg-muted)] uppercase tracking-wider text-[9px] block mb-0.5">IP Address</span>
                                <p className="font-mono text-sm font-bold text-[var(--fg-base)]">{click.ip_address}</p>
                              </div>
                              <div>
                                <span className="font-bold text-[var(--fg-muted)] uppercase tracking-wider text-[9px] block mb-0.5">Thiết bị</span>
                                <p className="text-sm font-bold text-[var(--fg-base)] capitalize flex items-center gap-1.5">
                                  <DevIcon className="size-4" />
                                  {click.device_type || 'Không rõ'}
                                </p>
                              </div>
                            </div>
                            <div>
                              <span className="font-bold text-[var(--fg-muted)] uppercase tracking-wider text-[9px] block mb-0.5">Thời gian chính xác</span>
                              <p className="text-[var(--fg-base)] font-medium">
                                {formatDateLabel(click.clicked_at)}
                              </p>
                            </div>
                            {click.is_suspicious && (
                              <div className="p-2 rounded-lg bg-red-50 border border-red-200/40">
                                <span className="font-bold text-red-600 text-[10px] flex items-center gap-1">
                                  <AlertTriangle className="size-3" />
                                  Phát hiện nghi ngờ: {click.suspicious_reason}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {clicks.length > visibleCount && (
        <button
          onClick={() => setVisibleCount(v => v + 20)}
          className="w-full mt-2 py-2 text-center text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent)]/5 rounded-lg transition-colors cursor-pointer"
        >
          Xem thêm {Math.min(20, clicks.length - visibleCount)} click nữa ({visibleCount}/{clicks.length})
        </button>
      )}
    </div>
  );
}

function StatMini({ icon: Icon, label, value, color }: {
  icon: typeof BarChart3; label: string; value: string | number; color: string;
}) {
  return (
    <div className="p-2.5 rounded-lg bg-[var(--border-soft)]/30">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className={cn("size-3", color)} />
        <span className="text-[10px] font-bold text-[var(--fg-muted)] uppercase">{label}</span>
      </div>
      <p className="text-sm font-black text-[var(--fg-base)] truncate">{value}</p>
    </div>
  );
}
