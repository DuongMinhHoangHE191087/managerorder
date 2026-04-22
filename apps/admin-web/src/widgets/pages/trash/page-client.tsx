"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Trash2, RotateCcw, XCircle, AlertTriangle, Users, ShoppingCart, Package,
  Truck, Mail, Key, Search, CheckSquare, Square, Clock, ArrowDownUp,
  Eye, Info, Link as LinkIcon, Home, FileJson
} from "lucide-react";
import NextLink from "next/link";
import { useTrashItems, useTrashCounts, useRestoreItems, usePurgeItems } from "@/widgets/pages/trash/hooks/use-trash";
import { vi } from "@/shared/messages/vi";
import { cn, formatDateLabel, formatMoney } from "@/lib/utils";

type EntityType = "customers" | "orders" | "products" | "providers" | "source_accounts" | "license_keys" | "short_links";

interface TabConfig {
  key: EntityType;
  label: string;
  icon: React.ElementType;
  gradient: string;
}

const TABS: TabConfig[] = [
  { key: "customers", label: vi.trash.tabs.customers, icon: Users, gradient: "from-blue-500/20 to-blue-600/10" },
  { key: "orders", label: vi.trash.tabs.orders, icon: ShoppingCart, gradient: "from-green-500/20 to-green-600/10" },
  { key: "products", label: vi.trash.tabs.products, icon: Package, gradient: "from-purple-500/20 to-purple-600/10" },
  { key: "providers", label: vi.trash.tabs.providers, icon: Truck, gradient: "from-orange-500/20 to-orange-600/10" },
  { key: "source_accounts", label: vi.trash.tabs.sourceAccounts, icon: Mail, gradient: "from-cyan-500/20 to-cyan-600/10" },
  { key: "license_keys", label: vi.trash.tabs.licenseKeys, icon: Key, gradient: "from-amber-500/20 to-amber-600/10" },
  { key: "short_links", label: vi.trash.tabs.shortLinks, icon: LinkIcon, gradient: "from-pink-500/20 to-pink-600/10" },
];

const ICON_COLORS: Record<EntityType, string> = {
  customers: "text-blue-500",
  orders: "text-green-500",
  products: "text-purple-500",
  providers: "text-orange-500",
  source_accounts: "text-cyan-500",
  license_keys: "text-amber-500",
  short_links: "text-pink-500",
};

// Display field config per entity type (table columns)
const DISPLAY_FIELDS: Record<EntityType, { key: string; label: string }[]> = {
  customers: [
    { key: "full_name", label: vi.trash.fields.customers.fullName },
    { key: "type", label: vi.trash.fields.customers.type },
  ],
  orders: [
    { key: "order_code", label: vi.trash.fields.orders.orderCode },
    { key: "status", label: vi.trash.fields.orders.status },
    { key: "total_amount_vnd", label: vi.trash.fields.orders.totalAmount },
  ],
  products: [
    { key: "name", label: vi.trash.fields.products.name },
    { key: "mode", label: vi.trash.fields.products.mode },
  ],
  providers: [
    { key: "name", label: vi.trash.fields.providers.name },
    { key: "tier", label: vi.trash.fields.providers.tier },
  ],
  source_accounts: [
    { key: "email", label: vi.trash.fields.sourceAccounts.email },
    { key: "provider", label: vi.trash.fields.sourceAccounts.provider },
  ],
  license_keys: [
    { key: "key_code", label: vi.trash.fields.licenseKeys.keyCode },
    { key: "status", label: vi.trash.fields.licenseKeys.status },
  ],
  short_links: [
    { key: "slug", label: vi.trash.fields.shortLinks.slug },
    { key: "target_url", label: vi.trash.fields.shortLinks.targetUrl },
    { key: "current_clicks", label: vi.trash.fields.shortLinks.currentClicks },
  ],
};

// Detail fields for expandable panel (extra info not in table)
const DETAIL_FIELDS: Record<EntityType, { key: string; label: string }[]> = {
  customers: [
    { key: "phone", label: vi.trash.fields.customers.phone },
    { key: "email", label: vi.trash.fields.customers.email },
    { key: "notes", label: vi.trash.fields.customers.notes },
    { key: "created_at", label: vi.trash.fields.customers.createdAt },
  ],
  orders: [
    { key: "payment_method", label: vi.trash.fields.orders.paymentMethod },
    { key: "notes", label: vi.trash.fields.orders.notes },
    { key: "created_at", label: vi.trash.fields.orders.createdAt },
  ],
  products: [
    { key: "price_vnd", label: vi.trash.fields.products.price },
    { key: "cost_vnd", label: vi.trash.fields.products.cost },
    { key: "description", label: vi.trash.fields.products.description },
    { key: "created_at", label: vi.trash.fields.products.createdAt },
  ],
  providers: [
    { key: "contact_email", label: vi.trash.fields.providers.contactEmail },
    { key: "notes", label: vi.trash.fields.providers.notes },
    { key: "created_at", label: vi.trash.fields.providers.createdAt },
  ],
  source_accounts: [
    { key: "status", label: vi.trash.fields.sourceAccounts.status },
    { key: "notes", label: vi.trash.fields.sourceAccounts.notes },
    { key: "created_at", label: vi.trash.fields.sourceAccounts.createdAt },
  ],
  license_keys: [
    { key: "product_id", label: vi.trash.fields.licenseKeys.productId },
    { key: "notes", label: vi.trash.fields.licenseKeys.notes },
    { key: "created_at", label: vi.trash.fields.licenseKeys.createdAt },
  ],
  short_links: [
    { key: "title", label: vi.trash.fields.shortLinks.title },
    { key: "expires_at", label: vi.trash.fields.shortLinks.expiresAt },
    { key: "created_at", label: vi.trash.fields.shortLinks.createdAt },
  ],
};

// Status badge colors
function getStatusColor(value: string): string {
  const v = String(value).toLowerCase();
  if (["active", "completed", "paid", "vip", "agency"].includes(v)) return "bg-green-500/15 text-green-600";
  if (["pending", "processing", "wholesale"].includes(v)) return "bg-amber-500/15 text-amber-600";
  if (["cancelled", "expired", "revoked"].includes(v)) return "bg-red-500/15 text-red-600";
  return "bg-[var(--border-soft)] text-[var(--fg-muted)]";
}

function isStatusField(key: string): boolean {
  return ["type", "status", "mode", "tier", "provider"].includes(key);
}

export default function TrashPage() {
  const [activeTab, setActiveTab] = useState<EntityType>("customers");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: counts } = useTrashCounts();
  const { data: trashData, isLoading } = useTrashItems(activeTab);
  const restoreMut = useRestoreItems();
  const purgeMut = usePurgeItems();

  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const items = useMemo(() => trashData?.data ?? [], [trashData?.data]);
  const fields = DISPLAY_FIELDS[activeTab];
  const detailFields = DETAIL_FIELDS[activeTab];

  // Reset pagination when changing tab or search
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  // Filter + sort items
  const filteredItems = useMemo(() => {
    let result = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) =>
        fields.some((f) => String(item[f.key] ?? "").toLowerCase().includes(q))
      );
    }
    if (sortAsc) {
      result = [...result].sort((a, b) => {
        const da = a.deleted_at as string;
        const db = b.deleted_at as string;
        return new Date(da).getTime() - new Date(db).getTime();
      });
    }
    return result;
  }, [items, searchQuery, sortAsc, fields]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function toggleAll() {
    if (filteredItems.length > 0 && filteredItems.every((i) => selectedIds.has(i.id as string))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id as string)));
    }
  }

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id);
  }

  function handleRestore() {
    if (selectedIds.size === 0) return;
    restoreMut.mutate(
      { type: activeTab, ids: Array.from(selectedIds) },
      { onSuccess: () => setSelectedIds(new Set()) }
    );
  }

  function handlePurge() {
    if (purgeConfirmText !== vi.trash.page.deleteForeverConfirmText) return;
    purgeMut.mutate(
      { type: activeTab, ids: Array.from(selectedIds) },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
          setShowPurgeConfirm(false);
          setPurgeConfirmText("");
        },
      }
    );
  }

  function formatDate(d: unknown) {
    if (!d || typeof d !== "string") return vi.common.notAvailable;
    return formatDateLabel(d);
  }

  function timeAgo(d: unknown, nowMs: number): string {
    if (!d || typeof d !== "string") return "";
    const diff = nowMs - new Date(d).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return vi.trash.page.timeAgo.minute(minutes);
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return vi.trash.page.timeAgo.hour(hours);
    const days = Math.floor(hours / 24);
    if (days < 30) return vi.trash.page.timeAgo.day(days);
    return vi.trash.page.timeAgo.month(Math.floor(days / 30));
  }

  function formatCurrency(val: unknown): string {
    if (val == null) return "—";
    const n = Number(val);
    if (isNaN(n)) return String(val);
    return formatMoney(n);
  }

  function renderCellValue(key: string, value: unknown): React.ReactNode {
    const str = String(value ?? "—");
    if (key === "total_amount_vnd" || key === "price_vnd" || key === "cost_vnd") return formatCurrency(value);
    if (key === "created_at") return formatDate(value);
    if (isStatusField(key)) {
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${getStatusColor(str)}`}>
          {str}
        </span>
      );
    }
    return str;
  }

  const allSelected = filteredItems.length > 0 && filteredItems.every((i) => selectedIds.has(i.id as string));
  const someSelected = filteredItems.some((i) => selectedIds.has(i.id as string)) && !allSelected;
  const totalTrash = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const activeTabConfig = TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-red-500/20 to-orange-500/10 p-3 rounded-2xl">
            <Trash2 className="size-7 text-[var(--danger)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--fg-base)]">{vi.trash.page.title}</h1>
            <p className="text-sm text-[var(--fg-muted)]">
              {totalTrash > 0 ? `${totalTrash} ${vi.trash.page.items}` : vi.trash.page.empty}
            </p>
          </div>
        </div>

        <NextLink href="/" className="group relative inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--bg-surface-strong)] to-[var(--bg-surface)] hover:from-[var(--accent)]/10 hover:to-[var(--accent)]/5 text-[var(--fg-base)] hover:text-[var(--accent)] font-semibold rounded-2xl border border-[var(--border-soft)] hover:border-[var(--accent)]/30 transition-all duration-300 active:scale-95 overflow-hidden shadow-sm hover:shadow-[0_8px_20px_rgba(85,202,2,0.15)]">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
          <Home className="size-4.5 transition-transform group-hover:-translate-y-0.5" />
          {vi.trash.page.backHome}
        </NextLink>
      </div>

      {/* ── Stats Overview Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {TABS.map((tab) => {
          const count = counts?.[tab.key] ?? 0;
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedIds(new Set());
                setExpandedId(null);
                setSearchQuery("");
              }}
              className={`glass-card !rounded-2xl p-4 text-left transition-all duration-200 cursor-pointer group ${
                isActive
                  ? "!border-[var(--accent)] ring-1 ring-[var(--accent)]/30 !shadow-[0_4px_20px_rgba(85,202,2,0.12)]"
                  : "hover:!border-[var(--border-soft)] hover:!shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
              }`}
              style={{ transform: isActive ? "translateY(-2px)" : undefined }}
            >
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br ${tab.gradient} mb-2`}>
                <Icon className={`size-4.5 ${ICON_COLORS[tab.key]}`} />
              </div>
              <p className={`text-2xl font-bold tabular-nums ${count > 0 ? "text-[var(--fg-base)]" : "text-[var(--fg-muted)]/50"}`}>
                {count}
              </p>
              <p className="text-[11px] font-medium text-[var(--fg-muted)] mt-0.5 truncate">{tab.label}</p>
            </button>
          );
        })}
      </div>

      {/* ── Search + Sort Bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-muted)]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={vi.trash.page.searchPlaceholder(activeTabConfig.label)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] text-sm text-[var(--fg-base)] outline-none focus:ring-1 focus:ring-[var(--accent)] transition placeholder:text-[var(--fg-muted)]/60"
            />
          </div>
        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[var(--border-soft)] text-sm text-[var(--fg-muted)] hover:bg-[var(--bg-surface)] transition cursor-pointer"
        >
          <ArrowDownUp className="size-4" />
          {sortAsc ? vi.trash.page.sortOldest : vi.trash.page.sortNewest}
        </button>
        <div className="text-sm text-[var(--fg-muted)]">
          {filteredItems.length} / {items.length} {vi.trash.page.items}
        </div>
      </div>

      {/* ── Data Table ── */}
      <div className="glass-card !rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--border-soft)] mb-4 animate-pulse">
              <Trash2 className="size-6 text-[var(--fg-muted)]/40" />
            </div>
            <p className="text-sm text-[var(--fg-muted)]">{vi.trash.page.loading}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-[var(--border-soft)] to-transparent mb-4">
              <Trash2 className="size-8 text-[var(--fg-muted)]/30" />
            </div>
            <p className="text-base font-semibold text-[var(--fg-base)] mb-1">
              {searchQuery ? vi.trash.page.noResults : vi.trash.page.empty}
            </p>
            <p className="text-sm text-[var(--fg-muted)] max-w-[260px] mx-auto">
              {searchQuery
                ? vi.trash.page.noResultsWithQuery(activeTabConfig.label, searchQuery)
                : vi.trash.page.noDeletedItems(activeTabConfig.label)}
            </p>
          </div>
        ) : (
          <div className="flex flex-col border-t border-[var(--border-soft)]">
            {/* Desktop Header */}
            <div className="hidden lg:grid grid-cols-12 items-center px-4 py-3 bg-[var(--surface-light)] border-b border-[var(--border-soft)] gap-4">
              <div className="col-span-1 flex items-center justify-center">
                <button onClick={toggleAll} className="cursor-pointer hover:opacity-80 transition">
                  {allSelected ? (
                    <CheckSquare className="size-4.5 text-[var(--accent)]" />
                  ) : someSelected ? (
                    <div className="relative">
                      <Square className="size-4.5 text-[var(--accent)]" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-0.5 bg-[var(--accent)] rounded-full" />
                      </div>
                    </div>
                  ) : (
                    <Square className="size-4.5 text-[var(--fg-muted)]/50" />
                  )}
                </button>
              </div>
              
              <div className="col-span-6 grid grid-cols-6 gap-2">
                {fields.map((f, _i) => {
                  const span = fields.length === 2 ? "col-span-3" : "col-span-2";
                  return (
                    <div key={f.key} className={cn("text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]", span)}>
                      {f.label}
                    </div>
                  );
                })}
              </div>

              <div className="col-span-2 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {vi.trash.page.deletedLabel}
                </span>
              </div>
              <div className="col-span-3 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] text-right pr-2">
                {vi.trash.page.actions}
              </div>
            </div>

            {/* List Body */}
            <div className="flex flex-col">
              {paginatedItems.map((item, idx) => {
                const id = item.id as string;
                const isSelected = selectedIds.has(id);
                const isExpanded = expandedId === id;

                return (
                  <div key={id} className="flex flex-col">
                    <div
                      className={cn(
                        "group grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 items-center transition-all duration-150 relative",
                        isSelected ? "bg-[var(--accent)]/5" : "bg-white hover:bg-[var(--bg-surface-strong)]",
                        isExpanded ? "border-b-0" : "border-b border-[var(--border-soft)]/50"
                      )}
                      style={{ animationDelay: `${Math.min(idx * 20, 400)}ms` }}
                    >
                      {/* Selection & Expand (Mobile view is combined) */}
                      <div className="col-span-1 lg:col-span-1 flex items-center justify-between lg:justify-center">
                        <div className="flex items-center gap-3">
                          <button onClick={() => toggleSelect(id)} className="cursor-pointer hover:opacity-80 transition">
                            {isSelected ? (
                              <CheckSquare className="size-4.5 text-[var(--accent)]" />
                            ) : (
                              <Square className="size-4.5 text-[var(--fg-muted)]/40" />
                            )}
                          </button>
                          <button
                            onClick={() => toggleExpand(id)}
                            className="flex lg:hidden cursor-pointer hover:bg-[var(--accent)]/10 rounded-lg p-1.5 transition-colors"
                            title={vi.trash.page.viewDetails}
                          >
                            <Info className={cn("size-4", isExpanded ? "text-[var(--accent)]" : "text-[var(--fg-muted)]")} />
                          </button>
                        </div>
                        
                        <div className="lg:hidden flex items-center gap-2">
                          <button
                            onClick={() => restoreMut.mutate({ type: activeTab, ids: [id] })}
                            disabled={restoreMut.isPending}
                            className="p-2 rounded-lg text-[var(--accent)] bg-[var(--accent)]/10"
                          >
                            <RotateCcw className="size-4" />
                          </button>
                        </div>
                      </div>

                      {/* Dynamic Fields Row */}
                      <div className="col-span-1 lg:col-span-6 grid grid-cols-1 lg:grid-cols-6 gap-3 lg:gap-2">
                        {fields.map((f, i) => {
                           const span = fields.length === 2 ? "lg:col-span-3" : "lg:col-span-2";
                           return (
                            <div key={f.key} className={cn("text-sm", span, i === 0 ? "font-bold text-[var(--fg-base)] group-hover:text-[var(--accent)] transition-colors break-words" : "text-[var(--fg-muted)] font-medium break-words")}>
                              <span className="lg:hidden text-[11px] uppercase tracking-widest text-[var(--fg-muted)] block mb-1 font-bold">{f.label}</span>
                              {renderCellValue(f.key, item[f.key])}
                            </div>
                           );
                        })}
                      </div>

                      {/* Time Info */}
                      <div className="col-span-1 lg:col-span-2 flex flex-col mt-2 lg:mt-0 pt-3 lg:pt-0 border-t border-[var(--border-soft)]/50 lg:border-none">
                        <span className="lg:hidden text-[11px] uppercase tracking-widest text-[var(--fg-muted)] block mb-1 font-bold">{vi.trash.page.deletedTime}</span>
                        <span className="text-xs font-bold text-[var(--fg-base)] opacity-80">{timeAgo(item.deleted_at, now)}</span>
                        <span className="text-[10px] text-[var(--fg-muted)] font-medium">{formatDate(item.deleted_at)}</span>
                      </div>

                      {/* Actions */}
                      <div className="col-span-1 lg:col-span-3 flex justify-end items-center gap-2 mt-2 lg:mt-0 pt-3 lg:pt-0 border-t border-[var(--border-soft)]/50 lg:border-none">
                         <button
                            onClick={() => toggleExpand(id)}
                            className="hidden lg:inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 transition cursor-pointer"
                          >
                            <Eye className="size-3.5" />
                            {vi.trash.page.viewDetails}
                          </button>
                          <button
                            onClick={() => restoreMut.mutate({ type: activeTab, ids: [id] })}
                            disabled={restoreMut.isPending}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 transition cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="size-3.5" />
                            {vi.trash.page.restore}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedIds(new Set([id]));
                              setShowPurgeConfirm(true);
                            }}
                            className="hidden lg:inline-flex items-center justify-center p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                          >
                            <Trash2 className="size-4" />
                          </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-b border-[var(--border-soft)]/50 bg-gradient-to-b from-[var(--accent)]/[0.03] to-transparent border-l-2 border-l-[var(--accent)]/50">
                        <div className="p-4 sm:px-6 pl-4 lg:pl-[104px]">
                          <div className="flex items-center gap-2 mb-3">
                            <Info className="size-4 text-[var(--accent)]" />
                            <h4 className="text-xs font-bold text-[var(--fg-base)] uppercase tracking-wider">
                              {vi.trash.page.restorePreviewTitle}
                            </h4>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {fields.map((f) => (
                              <div key={f.key} className="bg-white/50 rounded-xl p-3 border border-[var(--border-soft)]/50 shadow-sm">
                                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1">{f.label}</p>
                                <p className="text-sm font-medium text-[var(--fg-base)] break-words">{renderCellValue(f.key, item[f.key])}</p>
                              </div>
                            ))}
                            {detailFields.map((f) => {
                              const val = item[f.key];
                              if (val == null || val === "") return null;
                              return (
                                <div key={f.key} className="bg-white/50 rounded-xl p-3 border border-[var(--border-soft)]/50 shadow-sm">
                                  <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1">{f.label}</p>
                                  <p className="text-sm font-medium text-[var(--fg-base)] break-words">{renderCellValue(f.key, val)}</p>
                                </div>
                              );
                            })}
                            <div className="bg-red-500/5 rounded-xl p-3 border border-red-500/10 shadow-sm">
                              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">{vi.trash.page.deletedAt}</p>
                              <p className="text-sm font-medium text-[var(--fg-base)]">{formatDate(item.deleted_at)}</p>
                              <p className="text-[11px] text-[var(--fg-muted)] mt-0.5">{timeAgo(item.deleted_at, now)}</p>
                              {Boolean(item.deleted_by) && (
                                <div className="mt-2 pt-2 border-t border-red-500/10">
                                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-0.5">{vi.trash.page.deletedBy}</p>
                                  <p className="text-xs text-[var(--fg-base)]">{String(item.deleted_by)}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-[var(--border-soft)]/50">
                            <div className="flex items-center gap-2 mb-2">
                              <FileJson className="size-4 text-[var(--fg-muted)]" />
                              <h5 className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">
                                {vi.trash.page.rawData}
                              </h5>
                            </div>
                            <pre className="p-3 bg-black/5 rounded-xl text-[11px] text-[var(--fg-muted)] whitespace-pre-wrap break-all border border-[var(--border-soft)]/50 max-h-[160px] overflow-y-auto">
                              {JSON.stringify(item, null, 2)}
                            </pre>
                          </div>

                          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--border-soft)]/50 flex-wrap">
                            <button
                              onClick={() => restoreMut.mutate({ type: activeTab, ids: [id] })}
                              disabled={restoreMut.isPending}
                              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shadow-sm hover:shadow-[0_4px_12px_rgba(85,202,2,0.2)]"
                            >
                              <RotateCcw className="size-3.5" />
                              {vi.trash.page.restoreThis}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedIds(new Set([id]));
                                setShowPurgeConfirm(true);
                              }}
                              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-red-600 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all cursor-pointer"
                            >
                              <XCircle className="size-3.5" />
                              {vi.trash.page.deleteForever}
                            </button>
                            <button
                              onClick={() => setExpandedId(null)}
                              className="px-3 py-2 text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg-base)] transition cursor-pointer"
                            >
                              {vi.common.close}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Pagination Controls */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-soft)]">
            <span className="text-sm text-[var(--fg-muted)]">
              {vi.trash.page.showing} <span className="font-semibold text-[var(--fg-base)]">{(currentPage - 1) * itemsPerPage + 1}</span> {vi.trash.page.to} <span className="font-semibold text-[var(--fg-base)]">{Math.min(currentPage * itemsPerPage, filteredItems.length)}</span> {vi.trash.page.of} <span className="font-semibold text-[var(--fg-base)]">{filteredItems.length}</span> {vi.trash.page.items}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-soft)] text-sm font-medium text-[var(--fg-base)] hover:bg-[var(--bg-surface)] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {vi.trash.page.previous}
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Logic to show a window of pages around current
                  let pageNum = currentPage;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition cursor-pointer",
                        currentPage === pageNum
                          ? "bg-[var(--accent)] text-white"
                          : "text-[var(--fg-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--fg-base)]"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-soft)] text-sm font-medium text-[var(--fg-base)] hover:bg-[var(--bg-surface)] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {vi.trash.page.next}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky Batch Action Bar ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4">
          <div className="glass-card-strong !rounded-2xl px-5 py-3.5 flex items-center gap-3 !shadow-[0_8px_40px_rgba(0,0,0,0.15)]">
            <div className="flex items-center gap-2 mr-auto">
              <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/15 flex items-center justify-center">
                <span className="text-xs font-bold text-[var(--accent)] tabular-nums">
                  {selectedIds.size}
                </span>
              </div>
               <span className="text-sm font-medium text-[var(--fg-base)]">{vi.trash.page.selected}</span>
            </div>
            <button
              onClick={handleRestore}
              disabled={restoreMut.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" />
              {vi.trash.page.restore}
            </button>
            <button
              onClick={() => setShowPurgeConfirm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--danger)] text-white text-sm font-semibold hover:opacity-90 transition cursor-pointer"
            >
              <XCircle className="size-3.5" />
              {vi.trash.page.deleteForever}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg-base)] transition cursor-pointer px-2"
              title={vi.trash.page.clearSelection}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Purge Confirm Modal ── */}
      {showPurgeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            className="bg-[var(--bg-surface-strong)] rounded-3xl p-6 max-w-md w-full mx-4 border border-[var(--border-soft)]"
            style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,59,48,0.1)" }}
          >
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/10 flex items-center justify-center">
                <AlertTriangle className="size-7 text-[var(--danger)]" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-[var(--fg-base)] text-center mb-2">
              {vi.trash.page.deleteForeverTitle(selectedIds.size)}
            </h3>
            <p className="text-sm text-[var(--fg-muted)] text-center mb-5 leading-relaxed">
              {vi.trash.page.deleteForeverWarning}
              <br />
              {vi.trash.page.deleteForeverWarning2}
            </p>
            <label className="block text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider mb-2">
              {vi.trash.page.deleteForeverInputLabel}
            </label>
            <input
              value={purgeConfirmText}
              onChange={(e) => setPurgeConfirmText(e.target.value)}
              className={`w-full p-3 rounded-xl border bg-[var(--bg-surface)] text-sm text-[var(--fg-base)] mb-5 outline-none transition ${
                purgeConfirmText && purgeConfirmText !== vi.trash.page.deleteForeverConfirmText
                  ? "border-[var(--danger)]/50 focus:ring-1 focus:ring-[var(--danger)]"
                  : purgeConfirmText === vi.trash.page.deleteForeverConfirmText
                  ? "border-green-500/50 focus:ring-1 focus:ring-green-500"
                  : "border-[var(--border-soft)] focus:ring-1 focus:ring-[var(--danger)]"
              }`}
              placeholder={vi.trash.page.deleteForeverInputPlaceholder}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowPurgeConfirm(false); setPurgeConfirmText(""); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border-soft)] text-sm font-medium text-[var(--fg-muted)] hover:bg-[var(--border-soft)] transition cursor-pointer"
              >
                {vi.common.cancel}
              </button>
              <button
                onClick={handlePurge}
                disabled={purgeConfirmText !== vi.trash.page.deleteForeverConfirmText || purgeMut.isPending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--danger)] text-white text-sm font-bold hover:opacity-90 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {purgeMut.isPending ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {vi.trash.page.deleting}
                  </span>
                ) : (
                  vi.trash.page.deleteForeverCount(selectedIds.size)
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
