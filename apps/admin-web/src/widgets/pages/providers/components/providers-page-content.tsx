"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { ShieldCheck, Plus, Pencil, Trash2, Briefcase, Search, Eye, Phone, Mail, User, Package, X } from "lucide-react";
// import Link from "next/link";
import { appToast } from "@/shared/lib/toast";
import { useRouter } from "next/navigation";

import { AppLayout } from "@/widgets/layout/app-layout";
import { EmptyState, FiltersBar, PageContainer, PageHeader, SectionHeader, StatsGrid, SurfaceCard } from "@/shared/ui/page-layout";
import { StaggerContainer, StaggerItem, GlassHoverCard } from "@/shared/ui/animations";
import { useContextMenu } from "@/shared/ui/context-menu";
import { Modal } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
import { ActionMenu } from "@/shared/ui/action-menu";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { ChevronRight, ChevronLeft, Star } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import type { Provider } from "@/lib/domain/types";
import { useProviders, useDeleteProvider } from "@/widgets/pages/providers/hooks/use-providers";
import { vi } from "@/shared/messages/vi";
import { hasSearchTokens, matchesSearchQuery } from "@/shared/lib/filtering/search";
import { ProviderModel } from "@/entities/provider";
import { ProvidersGrid } from "./providers-grid";
import { SlimLoader } from "@/shared/ui/slim-loader";

const CustomerCreateModal = dynamic(
  () =>
    import("@/widgets/pages/customers/components/customer-create-modal").then((mod) => ({
      default: mod.CustomerCreateModal,
    })),
  { ssr: false }
);

const ProviderEditModal = dynamic(
  () =>
    import("@/widgets/pages/providers/components/provider-edit-modal").then((mod) => ({
      default: mod.ProviderEditModal,
    })),
  { ssr: false }
);

export default function ProvidersPage() {
  const router = useRouter();
  const { data: providers = [], isLoading, isFetching } = useProviders();
  const { mutateAsync: deleteProvider } = useDeleteProvider();
  const text = vi.providers.page;
  const detailText = vi.providers.detail;
  const contactTypeLabels = vi.customers.dynamicContactList.types;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<Provider | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("");

  const PROVIDER_TIER_CHIPS = useMemo(() => [
    { value: "", label: text.allTiers },
    { value: "vip", label: text.tiers.vip },
    { value: "regular", label: text.tiers.regular },
  ], [text]);

  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("providers_view_mode") as "card" | "list";
      if (saved) {
        setViewMode(saved);
      }
    }
  }, []);

  const handleSetViewMode = useCallback((mode: "card" | "list") => {
    setViewMode(mode);
    localStorage.setItem("providers_view_mode", mode);
  }, []);

  const filteredProviders = useMemo(() => providers.filter((provider) => {
    if (tierFilter && provider.tier !== tierFilter) return false;
    if (!hasSearchTokens(searchQuery)) return true;

    return matchesSearchQuery(
      searchQuery,
      provider.name,
      provider.contacts,
    );
  }), [providers, searchQuery, tierFilter]);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    setPageIndex(0);
  }, [searchQuery, tierFilter]);

  const totalProviders = filteredProviders.length;
  const pageCount = Math.ceil(totalProviders / pageSize);
  const paginatedProviders = filteredProviders.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const mappedProviders = useMemo(() => {
    return paginatedProviders.map((p) => {
      const model = new ProviderModel(p as any);
      return model.toJSON() as any;
    });
  }, [paginatedProviders]);

  useEffect(() => {
    setPageIndex((current) => Math.min(current, Math.max(0, pageCount - 1)));
  }, [pageCount]);
  
  const allVipProviders = providers.filter(c => c.tier === 'vip').length;

  async function handleDelete() {
    if (!deletingProvider) return;
    try {
      await deleteProvider(deletingProvider.id);
      setDeletingProvider(null);
      appToast.success(text.toast.deleted);
    } catch {
      appToast.error(text.toast.deleteError);
    }
  }

  const { openContextMenu, ContextMenuRender } = useContextMenu();

  return (
    <AppLayout>
      <ContextMenuRender />
      <PageContainer className="relative">
        <PageHeader
          title={text.title}
          actions={
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-6 py-3 text-sm font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-shadow hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
              type="button"
            >
              <Plus className="size-5" />
              {text.create}
            </button>
          }
        />

        <FiltersBar sticky className="px-4 py-2 mt-2.5">
          <div className="grid gap-3 md:grid-cols-[1fr_200px_160px_auto] items-center">
            <div className="relative min-w-0">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--fg-muted)]" />
              <Input
                aria-label="Tìm nhà cung cấp"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={text.searchPlaceholder}
                className="h-9 pl-9 text-sm"
              />
            </div>

            <Select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="h-9 text-xs font-bold rounded-xl"
            >
              {PROVIDER_TIER_CHIPS.map((chip) => (
                <option key={chip.value} value={chip.value}>
                  {chip.label}
                </option>
              ))}
            </Select>

            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200/80 shrink-0 h-9">
              <button
                type="button"
                onClick={() => handleSetViewMode("card")}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold rounded-md transition-all duration-150 h-full",
                  viewMode === "card"
                    ? "bg-white text-[var(--accent)] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                Thẻ
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode("list")}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold rounded-md transition-all duration-150 h-full",
                  viewMode === "list"
                    ? "bg-white text-[var(--accent)] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                Danh sách
              </button>
            </div>

            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="ghost"
                className="h-9 text-sm px-3"
                disabled={!(searchQuery || tierFilter)}
                onClick={() => {
                  setSearchQuery("");
                  setTierFilter("");
                }}
              >
                <X className="size-4 mr-1" />
                Xóa lọc
              </Button>
            </div>
          </div>
        </FiltersBar>

        <StaggerContainer delayChildren={0.2} staggerDelay={0.08} className="grid grid-cols-2 gap-2 mt-2.5 mb-4">
          <StaggerItem>
            <GlassHoverCard className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
              <div className="min-w-0">
                <p className="text-[var(--fg-muted)] text-[9px] font-bold uppercase tracking-widest mb-1">{text.stats.totalProviders}</p>
                <p className="text-[var(--fg-base)] text-lg font-black tracking-tight font-mono leading-none mb-1.5">{providers.length}</p>
                <div className="flex items-center gap-1">
                  <span className="rounded bg-slate-50 text-[var(--fg-muted)] px-1.5 py-px text-[9px] font-bold font-mono border border-slate-100">{allVipProviders} VIP</span>
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-[var(--accent)]/10 p-1.5 text-[var(--accent)] self-start">
                <Briefcase className="size-4" />
              </span>
            </GlassHoverCard>
          </StaggerItem>

          <StaggerItem>
            <GlassHoverCard className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
              <div className="min-w-0">
                <p className="text-[var(--fg-muted)] text-[9px] font-bold uppercase tracking-widest mb-1">{text.stats.vipProviders}</p>
                <p className="text-[var(--fg-base)] text-lg font-black tracking-tight font-mono leading-none mb-1.5">{allVipProviders}</p>
                <div className="flex items-center gap-1">
                  <span className="rounded bg-[#ff9500]/5 text-[#ff9500] px-1.5 py-px text-[9px] font-bold font-mono border border-[#ff9500]/15">Ưu tiên nhập</span>
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-[#ff9500]/10 p-1.5 text-[#ff9500] self-start">
                <ShieldCheck className="size-4" />
              </span>
            </GlassHoverCard>
          </StaggerItem>
        </StaggerContainer>

        <SurfaceCard className="mt-3.5 overflow-hidden">
          <SectionHeader
            title="Danh sách nhà cung cấp"
            description=""
            action={totalProviders > 0 ? <span className="text-[12px] font-bold text-[var(--fg-muted)]">{pageCount} trang</span> : null}
          />

          <div className={cn("w-full flex flex-col relative min-h-[200px] items-stretch", viewMode === "list" ? "space-y-3 p-4 sm:p-5" : "p-6")}>
            <SlimLoader isVisible={isFetching && !isLoading} />
            <div className={cn("transition-opacity duration-200 w-full flex flex-col items-stretch", isFetching && !isLoading && "opacity-85")}>
              {isLoading ? (
                viewMode === "card" ? (
                  <ProvidersGrid
                    isLoading={true}
                    mappedProviders={[]}
                    onRowClick={() => {}}
                    onEditClick={() => {}}
                    onDeleteClick={() => {}}
                  />
                ) : (
                  <div className="p-8 space-y-4 w-full">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm w-full">
                        <div className="size-12 shimmer rounded-2xl shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 shimmer rounded w-1/3" />
                          <div className="h-3 shimmer rounded w-1/4" />
                        </div>
                        <div className="h-4 shimmer rounded w-20" />
                      </div>
                    ))}
                  </div>
                )
          ) : totalProviders === 0 ? (
            <EmptyState
              icon={<Briefcase className="size-12" />}
              title={hasSearchTokens(searchQuery) ? text.empty.noResults : text.empty.none}
              description={hasSearchTokens(searchQuery) ? undefined : "Thêm nhà cung cấp đầu tiên để bắt đầu quản lý danh mục."}
              action={
                !hasSearchTokens(searchQuery) ? (
                  <Button variant="primary" className="rounded-full" onClick={() => setIsCreateOpen(true)}>
                    {text.empty.createFirst}
                  </Button>
                ) : null
              }
            />
          ) : viewMode === "card" ? (
            <ProvidersGrid
              isLoading={false}
              mappedProviders={mappedProviders}
              onRowClick={(row) => router.push(`/providers/${row.id}`)}
              onEditClick={setEditingProvider}
              onDeleteClick={setDeletingProvider}
            />
          ) : (
            paginatedProviders.map((provider) => {
              const primaryContact = provider.contacts.find(c => c.isPrimary) || provider.contacts[0];
              const tierLabel = provider.tier === "vip" ? text.tiers.vip : text.tiers.regular;
              const contactTypeLabel = (type: string) =>
                contactTypeLabels[type as keyof typeof contactTypeLabels] ?? type;
              
              const actionMenuItems = [
                { label: text.actions.viewDetail, icon: <Eye className="size-4" />, onClick: () => router.push(`/providers/${provider.id}`) },
                { label: text.actions.quickEdit, icon: <Pencil className="size-4" />, onClick: () => setEditingProvider(provider) },
                { label: text.actions.updateTrust, icon: <Star className="size-4" />, onClick: () => setEditingProvider(provider) },
                { 
                  label: text.actions.delete, 
                  icon: <Trash2 className="size-4" />, 
                  onClick: () => setDeletingProvider(provider), 
                  variant: "danger" as const, 
                  dividerBefore: true 
                },
              ];

                return (
                  <div
                    key={provider.id}
                    onClick={() => router.push(`/providers/${provider.id}`)}
                    data-testid="provider-row"
                    data-provider-id={provider.id}
                    className="group relative flex flex-col overflow-hidden rounded-[1.5rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.96)] shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition-[background-color,border-color,box-shadow,transform] duration-300 cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface-light)]/40 active:scale-[0.99]"
                    onContextMenu={(e) => {
                    openContextMenu(e, actionMenuItems.map(item => ({
                      ...item,
                      danger: item.variant === "danger"
                    })));
                  }}
                >
                  {/* Top Accent Line based on Reliability */}
                  <div className={`h-1.5 w-full ${
                      provider.reliabilityScore < 50 ? 'bg-rose-500' : provider.reliabilityScore < 80 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />

                  <div className="p-4 md:p-5 flex flex-col md:flex-row gap-5">
                    {/* Left section: Icon & Core Info */}
                    <div className="flex-1 flex items-start gap-4">
                      {/* Icon */}
                      <div className="relative shrink-0 hidden sm:block">
                        <div className={`size-14 rounded-2xl flex items-center justify-center font-bold tracking-tighter text-xl uppercase shadow-inner border ${
                          provider.tier === "vip" 
                            ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white border-amber-500/20" 
                            : "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 border-[var(--border-soft)]"
                        } group-hover:scale-105 transition-transform duration-300`}>
                          {provider.tier === "vip" ? <ShieldCheck className="size-7" /> : <Briefcase className="size-7 opacity-70" />}
                        </div>
                        {/* Tier Badge */}
                        <div className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border shadow-sm ${
                          provider.tier === "vip" 
                            ? "bg-amber-500 text-white border-amber-600" 
                            : "bg-white text-[var(--fg-muted)] border-[var(--border-soft)]"
                        }`}>
                          {tierLabel}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex justify-between items-start gap-3">
                          <div className="w-full">
                            <h3 className="text-[16px] font-black text-[var(--fg-base)] truncate group-hover:text-[var(--accent)] transition-colors leading-tight mb-1.5 pr-8">
                              {provider.name}
                            </h3>
                            
                            {/* Contacts & General Info */}
                            <div className="flex flex-col gap-1.5 mt-2">
                              {primaryContact ? (
                                <div className="flex items-center gap-1.5 text-[13px] text-[var(--fg-base)]">
                                  <span className="flex items-center justify-center size-5 rounded bg-[var(--accent)]/10 text-[var(--accent)] shrink-0">
                                    {primaryContact.type === 'phone' ? <Phone className="size-3" /> : 
                                     primaryContact.type === 'email' ? <Mail className="size-3" /> : 
                                     <User className="size-3" />}
                                  </span>
                                  <span className="font-bold truncate">{primaryContact.value}</span>
                                  <span className="text-[10px] uppercase font-bold text-[var(--fg-muted)] shrink-0 px-1.5 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border-soft)]">
                                    {contactTypeLabel(primaryContact.type)}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-[13px] text-[var(--fg-muted)] italic">
                                  <span className="flex items-center justify-center size-5 rounded bg-gray-100 shrink-0"><User className="size-3 opacity-50" /></span>
                                  {text.contactEmpty}
                                </div>
                              )}
                              
                              <div className="flex items-center gap-2 mt-1 w-fit">
                                <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-2 py-1 rounded-md">
                                   <Package className="size-3.5" />
                                   <span><strong className="font-black font-mono">{provider.purchaseOrderCount || 0}</strong> {text.productCountSuffix}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right section: Financial & Rating Stats */}
                    <div className="w-full md:w-[260px] lg:w-[280px] shrink-0 flex flex-col justify-center gap-3 bg-[var(--surface-light)] p-3.5 md:p-4 rounded-xl border border-[var(--border-soft)] group-hover:bg-white group-hover:border-[var(--accent)]/30 group-hover:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)] transition-[background-color,border-color,box-shadow] duration-300">
                      
                      {/* Credibility */}
                      <div className="flex items-center justify-between">
                          <span className="text-[10px] md:text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider flex items-center gap-1.5">
                          <Star className="size-3.5 fill-amber-500 text-amber-500" /> {detailText.cards.trust}
                        </span>
                        <div className="flex items-center">
                           <span className={`text-[15px] md:text-[16px] font-black font-mono ${
                            provider.reliabilityScore < 50 ? 'text-rose-500' : provider.reliabilityScore < 80 ? 'text-amber-500' : 'text-emerald-500'
                           }`}>{provider.reliabilityScore}</span>
                          <span className="text-[10px] md:text-[11px] text-[var(--fg-muted)] font-bold ml-0.5">/100</span>
                        </div>
                      </div>

                      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[var(--border-soft)] to-transparent" />

                      {/* Financials */}
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] md:text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">{text.summary.totalInput}</span>
                          <span className="text-[13px] md:text-[14px] font-black text-blue-500 font-mono">
                             {formatMoney(provider.totalImportAmountVnd || 0)}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center rounded-lg p-2 md:p-2.5 -mx-2 bg-red-50/50 border border-red-100">
                          <span className="text-[10px] md:text-[11px] font-bold text-red-500 uppercase tracking-wider">{text.summary.debt}</span>
                          <span className={`text-[14px] md:text-[15px] font-black font-mono ${provider.debtAmountVnd && provider.debtAmountVnd > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {provider.debtAmountVnd && provider.debtAmountVnd > 0 ? formatMoney(provider.debtAmountVnd) : '0đ'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Menu button top right */}
                  <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                    <ActionMenu items={actionMenuItems} />
                  </div>
                </div>
              );
            })
          )}

          {/* Pagination Footer */}
          {totalProviders > 0 && (
            <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-[1.2rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.88)] p-4 sm:flex-row">
              <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
                <span className="text-[12px] text-[var(--fg-muted)] font-bold tracking-wide uppercase whitespace-nowrap">{text.pagination.perPage}</span>
                <div className="flex bg-gray-100 rounded-lg p-1 border border-[var(--border-soft)]">
                  {[20, 50, 100].map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={pageSize === s}
                      onClick={() => { setPageSize(s); setPageIndex(0); }}
                      className={cn(
                        "px-3 py-1.5 text-[12px] font-bold rounded-md transition-[background-color,color,box-shadow]",
                        pageSize === s ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg-base)] hover:bg-black/5"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <span className="text-[12px] text-[var(--fg-muted)] font-medium whitespace-nowrap hidden lg:inline border-l border-[var(--border-soft)] pl-3">
                  {text.pagination.results} <strong className="text-[var(--fg-base)]">{(pageIndex * pageSize) + 1}–{Math.min((pageIndex + 1) * pageSize, totalProviders)}</strong> / {totalProviders}
                </span>
              </div>

              {pageCount > 1 && (
                <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-[var(--border-soft)]">
                  <button
                    type="button"
                    aria-label="Trang trước"
                    onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
                    disabled={pageIndex === 0}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--accent)] hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-[background-color,color,opacity] font-bold"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  
                  {Array.from({ length: pageCount }).map((_, i) => {
                    const shouldShow = i === 0 || i === pageCount - 1 || Math.abs(i - pageIndex) <= 1;
                    if (!shouldShow) {
                      if (i === 1 || i === pageCount - 2) {
                        return <span key={i} className="text-gray-400 px-1 text-xs select-none">...</span>;
                      }
                      return null;
                    }
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPageIndex(i)}
                        className={cn(
                          "h-8 w-8 flex items-center justify-center rounded-lg text-[12px] font-bold transition-all duration-150",
                          i === pageIndex
                            ? "bg-white text-[var(--accent)] shadow-sm border border-[var(--border-soft)]"
                            : "text-[var(--fg-muted)] hover:text-[var(--fg-base)] hover:bg-black/5"
                        )}
                      >
                        {i + 1}
                      </button>
                    );
                  })}

                  <button
                     type="button"
                     aria-label="Trang sau"
                     onClick={() => setPageIndex(Math.min(pageCount - 1, pageIndex + 1))}
                     disabled={pageIndex >= pageCount - 1}
                     className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--accent)] hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-[background-color,color,opacity] font-bold"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}
            </div>
          )}
            </div>
          </div>
        </SurfaceCard>

      </PageContainer>

      {/* ===== CREATE MODAL ===== */}
      <CustomerCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        defaultEntityType="supplier"
        onSuccess={() => {
          // React Query sẽ invalidate sau khi create
        }}
      />

      {/* ===== EDIT MODAL ===== */}
      {editingProvider && (
        <ProviderEditModal
          isOpen={!!editingProvider}
          onClose={() => setEditingProvider(null)}
          provider={editingProvider}
          onSuccess={() => {
            // Invalidate được xử lý qua hook useUpdateProvider
          }}
        />
      )}

      {/* ===== DELETE CONFIRMATION ===== */}
      <Modal isOpen={!!deletingProvider} onClose={() => setDeletingProvider(null)} title={text.deleteModal.title} size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeletingProvider(null)}>{text.deleteModal.cancel}</Button>
            <Button variant="primary" onClick={handleDelete} className="!bg-[var(--danger)] hover:!bg-[var(--danger)] !shadow-none">{text.deleteModal.confirm}</Button>
          </div>
        }
      >
        <div className="text-center py-4">
          <div className="size-16 bg-[var(--danger)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="size-8 text-[var(--danger)]" />
          </div>
          <p className="text-[15px] font-bold text-[var(--fg-base)] mb-2">{text.deleteModal.question}</p>
          <p className="text-[13px] text-[var(--fg-muted)]">
            {text.deleteModal.body(deletingProvider?.name ?? "")}
          </p>
        </div>
      </Modal>

    </AppLayout>
  );
}
