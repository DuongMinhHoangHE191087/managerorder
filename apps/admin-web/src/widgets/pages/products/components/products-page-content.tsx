"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, CheckCircle, PackageSearch, CircleDollarSign, Pencil, Trash2, Eye, Power, ChevronLeft, ChevronRight, X } from "lucide-react";
import { appToast } from "@/shared/lib/toast";

import { AppLayout } from "@/widgets/layout/app-layout";
import { FiltersBar, PageContainer, PageHeader, SectionHeader, StatsGrid, SurfaceCard } from "@/shared/ui/page-layout";
import { StaggerContainer, StaggerItem, GlassHoverCard } from "@/shared/ui/animations";
import { cn, formatMoney } from "@/lib/utils";
import { ProductModel } from "@/entities/product";
import { ProductsGrid } from "./products-grid";
import { Button } from "@/shared/ui/button";
import { SlimLoader } from "@/shared/ui/slim-loader";
import { Select } from "@/shared/ui/select";
import { ActionMenu } from "@/shared/ui/action-menu";
import { CreateActionFooter, CreateFlowDialog } from "@/shared/ui/create-flow-shell";
import { SoftDeletedBadge } from "@/shared/ui/soft-deleted-badge";
import { vi } from "@/shared/messages/vi";
import type { ProductService } from "@/lib/domain/types";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import {
  useDeleteProduct,
  useProductDetail,
  useProducts,
  useUpdateProduct,
} from "@/widgets/pages/products/hooks/use-products";
import { usePurgeItems, useRestoreItems } from "@/widgets/pages/trash/hooks/use-trash";
import { hasSearchTokens, matchesSearchQuery } from "@/shared/lib/filtering/search";

// ── Lazy-loaded modals ─────────────────────────────────────────────────────
const ProductCreateModal = dynamic(() => import("@/widgets/pages/products/components/product-create-modal").then(m => ({ default: m.ProductCreateModal })), { ssr: false });
const ProductEditModal = dynamic(() => import("@/widgets/pages/products/components/product-edit-modal").then(m => ({ default: m.ProductEditModal })), { ssr: false });

export default function ProductsPage() {
  const productText = vi.products.page;
  const PRODUCT_MODE_CHIPS = useMemo(() => [
    { value: "", label: productText.allTypes },
    { value: "slot", label: productText.types.slot },
    { value: "key", label: productText.types.key },
    { value: "hybrid", label: productText.types.hybrid },
  ], [productText]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const trashMode = searchParams.get("trash") === "1";
  const viewingProductId = searchParams.get("view");
  const { data: products = [], isLoading, isError, isFetching } = useProducts();
  const { mutateAsync: deleteProduct } = useDeleteProduct();
  const { mutateAsync: updateProduct } = useUpdateProduct();
  const { data: routedProductResult } = useProductDetail(viewingProductId, trashMode);
  const routedProduct = routedProductResult?.data ?? null;
  const isTrashView = trashMode || Boolean(routedProductResult?.softDeleted);
  const restoreItems = useRestoreItems();
  const purgeItems = usePurgeItems();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductService | null>(null);
  const [viewingProduct, setViewingProduct] = useState<ProductService | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductService | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("");

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("products_view_mode") as "card" | "list";
      if (saved) {
        setViewMode(saved);
      }
    }
  }, []);

  const handleSetViewMode = useCallback((mode: "card" | "list") => {
    setViewMode(mode);
    localStorage.setItem("products_view_mode", mode);
  }, []);

  const activeViewingProduct = viewingProductId ? routedProduct ?? null : viewingProduct;

  useEffect(() => {
    if (viewingProductId && routedProduct) {
      setViewingProduct(routedProduct);
    }
  }, [routedProduct, viewingProductId]);

  // Reset pageIndex khi filter/search thay đổi
  useEffect(() => {
    setPageIndex(0);
  }, [searchQuery, modeFilter]);

  const filteredProducts = useMemo(() => products.filter(p => {
    if (modeFilter && p.mode !== modeFilter) return false;
    if (!hasSearchTokens(searchQuery)) return true;
    return matchesSearchQuery(
      searchQuery,
      p.name,
      p.mode,
      p.durationType,
      p.sellPriceVnd,
      p.buyPriceVnd,
      p.durationValue,
    );
  }), [products, modeFilter, searchQuery]);

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  }, [filteredProducts, pageIndex, pageSize]);

  const mappedProducts = useMemo(() => {
    return paginatedProducts.map((p) => {
      const model = new ProductModel(p as any);
      return model.toJSON() as any;
    });
  }, [paginatedProducts]);

  const pageCount = Math.ceil(filteredProducts.length / pageSize);
  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.isActive).length;
  // Only include products with sell price > 0 for accurate avg margin
  const productsWithPrice = products.filter(p => p.sellPriceVnd > 0);
  const avgMargin = productsWithPrice.length > 0
    ? Math.round(productsWithPrice.reduce((acc, p) => acc + ((p.sellPriceVnd - p.buyPriceVnd) / p.sellPriceVnd) * 100, 0) / productsWithPrice.length)
    : 0;

  async function handleDelete() {
    if (!deletingProduct) return;
    try {
      await deleteProduct(deletingProduct.id);
      setDeletingProduct(null);
      appToast.success(productText.deleteSuccess);
    } catch {
      appToast.error(productText.deleteError);
    }
  }

  async function handleToggleActive(product: ProductService) {
    try {
      const data = await updateProduct({ id: product.id, isActive: !product.isActive });
      appToast.success(productText.toggleActiveSuccess(Boolean(data?.isActive)));
    } catch {
      appToast.error(productText.toggleActiveError);
    }
  }

  function handleCloseViewingProduct() {
    if (viewingProductId) {
      router.replace("/products");
    }
    setViewingProduct(null);
  }

  async function handleRestoreViewingProduct() {
    if (!activeViewingProduct) {
      return;
    }

    await restoreItems.mutateAsync({ type: "products", ids: [activeViewingProduct.id] });
    router.replace("/products");
    setViewingProduct(null);
    void queryClient.invalidateQueries({
      queryKey: queryKeys.products,
      refetchType: "active",
    });
  }

  async function handlePurgeViewingProduct() {
    if (!activeViewingProduct) {
      return;
    }

    await purgeItems.mutateAsync({ type: "products", ids: [activeViewingProduct.id] });
    setViewingProduct(null);
    router.push("/trash?type=products");
  }

  return (
    <AppLayout>
      <PageContainer className="relative">
        <PageHeader
          title={productText.title}
          actions={
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-[box-shadow,transform] active:scale-[0.98] hover:shadow-md"
              type="button"
            >
              <Plus className="size-5" />
              {productText.createButton}
            </button>
          }
        />

        {/* Stat Cards */}
        <StaggerContainer delayChildren={0.2} staggerDelay={0.08} className="grid grid-cols-2 gap-2 xl:grid-cols-3 mb-4">
          <StaggerItem>
            <GlassHoverCard className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
              <div className="min-w-0">
                <p className="text-[var(--fg-muted)] text-[9px] font-bold uppercase tracking-widest mb-1">{productText.stats.total}</p>
                <p className="text-[var(--fg-base)] text-lg font-black tracking-tight font-mono leading-none mb-1.5">{totalProducts}</p>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="rounded bg-slate-50 text-[var(--fg-muted)] px-1.5 py-px text-[9px] font-bold font-mono border border-slate-100">
                    {products.filter(p => p.mode === 'slot').length} Slot
                  </span>
                  <span className="rounded bg-blue-50 text-blue-600 px-1.5 py-px text-[9px] font-bold font-mono border border-blue-100">
                    {products.filter(p => p.mode === 'key').length} Key
                  </span>
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-[var(--accent)]/10 p-1.5 text-[var(--accent)] self-start">
                <span className="material-symbols-outlined text-[14px]">inventory_2</span>
              </span>
            </GlassHoverCard>
          </StaggerItem>

          <StaggerItem>
            <GlassHoverCard className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
              <div className="min-w-0">
                <p className="text-[var(--fg-muted)] text-[9px] font-bold uppercase tracking-widest mb-1">{productText.stats.active}</p>
                <p className="text-[var(--fg-base)] text-lg font-black tracking-tight font-mono leading-none mb-1.5">{activeProducts}</p>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="rounded bg-emerald-50 text-emerald-600 px-1.5 py-px text-[9px] font-bold font-mono border border-emerald-100">
                    {activeProducts} Active
                  </span>
                  {products.length - activeProducts > 0 ? (
                    <span className="rounded bg-red-50 text-red-600 px-1.5 py-px text-[9px] font-bold font-mono border border-red-100">
                      {products.length - activeProducts} Paused
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-emerald-500/10 p-1.5 text-emerald-500 self-start">
                <CheckCircle className="size-3.5" />
              </span>
            </GlassHoverCard>
          </StaggerItem>

          <StaggerItem>
            <GlassHoverCard className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
              <div className="min-w-0">
                <p className="text-[var(--fg-muted)] text-[9px] font-bold uppercase tracking-widest mb-1">{productText.stats.avgMargin}</p>
                <p className="text-[var(--accent)] text-lg font-black tracking-tight font-mono leading-none mb-1.5">{avgMargin}%</p>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="rounded bg-[var(--accent)]/5 text-[var(--accent)] px-1.5 py-px text-[9px] font-bold font-mono border border-[var(--accent)]/15">
                    Biên lợi nhuận TB
                  </span>
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-[var(--accent)]/10 p-1.5 text-[var(--accent)] self-start">
                <CircleDollarSign className="size-3.5" />
              </span>
            </GlassHoverCard>
          </StaggerItem>
        </StaggerContainer>

        {/* Filters Bar */}
        <FiltersBar sticky className="px-4 py-2 mt-2.5">
          <div className="grid gap-3 md:grid-cols-[1fr_160px_auto] items-center">
            <div className="relative min-w-0">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--fg-muted)]" />
              <input
                className="w-full bg-[var(--bg-surface)] backdrop-blur-md border border-[var(--border-soft)] rounded-xl pl-9 pr-4 py-2 h-9 text-[13px] font-medium focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--accent)] text-[var(--fg-base)] placeholder:text-[var(--fg-muted)] outline-none transition-[border-color,box-shadow]"
                placeholder={productText.searchPlaceholder}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                data-testid="products-search"
              />
            </div>

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
                disabled={!searchQuery && !modeFilter}
                onClick={() => {
                  setSearchQuery("");
                  setModeFilter("");
                }}
              >
                <X className="size-4 mr-1" />
                Xóa lọc
              </Button>
            </div>
          </div>
        </FiltersBar>

        <div className="flex flex-wrap gap-2 px-1 mt-2.5 mb-4">
          {PRODUCT_MODE_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setModeFilter(chip.value)}
              className={`rounded-full px-4 py-1.5 text-[12px] font-bold transition-all duration-150 border ${
                modeFilter === chip.value
                  ? "border-slate-800 bg-white text-slate-800 ring-1 ring-slate-800 shadow-sm"
                  : "border-transparent bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <SurfaceCard className="mt-3.5 overflow-hidden">
          <SectionHeader
            title="Danh sách sản phẩm"
            description=""
            action={filteredProducts.length > 0 ? <span className="text-[12px] font-bold text-[var(--fg-muted)]">{pageCount} trang</span> : null}
          />
          <div className={cn("relative min-h-[200px]", viewMode === "list" && "overflow-x-auto", viewMode === "card" && "p-6")}>
            <SlimLoader isVisible={isFetching && !isLoading} />
            <div className={cn("transition-opacity duration-200", isFetching && !isLoading && "opacity-85")}>
              {isLoading ? (
              viewMode === "card" ? (
                <ProductsGrid
                  isLoading={true}
                  mappedProducts={[]}
                  onRowClick={() => {}}
                  onEditClick={() => {}}
                  onDeleteClick={() => {}}
                  onToggleActive={() => {}}
                />
              ) : (
                <div className="p-8 space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="size-10 shimmer rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 shimmer rounded w-1/3" />
                        <div className="h-3 shimmer rounded w-1/4" />
                      </div>
                      <div className="h-4 shimmer rounded w-20" />
                      <div className="h-4 shimmer rounded w-20" />
                    </div>
                  ))}
                </div>
              )
            ) : isError ? (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <PackageSearch className="size-12 text-[var(--danger)] opacity-50 mb-3" />
                <h3 className="text-[15px] font-bold text-[var(--fg-base)]">{productText.errorTitle}</h3>
                <p className="text-[13px] text-[var(--fg-muted)] mt-1">{productText.errorDescription}</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <PackageSearch className="size-12 text-[var(--fg-muted)] opacity-50 mb-3" />
                <h3 className="text-[15px] font-bold text-[var(--fg-base)]">{productText.emptyTitle}</h3>
                <p className="text-[13px] text-[var(--fg-muted)] mt-1">
                  {hasSearchTokens(searchQuery) || modeFilter ? productText.emptyDescriptionWithFilter : productText.emptyDescriptionDefault}
                </p>
              </div>
            ) : viewMode === "card" ? (
              <ProductsGrid
                isLoading={false}
                mappedProducts={mappedProducts}
                onRowClick={(row) => setViewingProduct(row)}
                onEditClick={setEditingProduct}
                onDeleteClick={setDeletingProduct}
                onToggleActive={handleToggleActive}
              />
            ) : (
              <div className="flex flex-col pb-4">
                <div className="hidden lg:grid grid-cols-[minmax(0,3.5fr)_minmax(0,2fr)_minmax(0,3fr)_140px_100px] gap-4 px-10 py-4 border-b border-[var(--border-soft)] mb-4">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{productText.tableHeaders.product}</div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{productText.tableHeaders.infoType}</div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{productText.tableHeaders.priceMargin}</div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] justify-self-center">{productText.tableHeaders.status}</div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] justify-self-end">{productText.tableHeaders.actions}</div>
                </div>

                <div className="flex flex-col gap-3 px-4">
                  {paginatedProducts.map((product) => {
                    const margin = product.sellPriceVnd - product.buyPriceVnd;
                    const marginPercent = product.sellPriceVnd > 0 ? Math.round((margin / product.sellPriceVnd) * 100) : 0;
                    
                    return (
                      <div 
                        key={product.id} 
                        onClick={() => setViewingProduct(product)}
                        data-testid="product-row"
                        data-product-id={product.id}
                        className="group flex flex-col lg:grid lg:grid-cols-[minmax(0,3.5fr)_minmax(0,2fr)_minmax(0,3fr)_140px_100px] gap-4 items-center p-5 bg-[var(--surface-light)] border border-[var(--border-soft)] rounded-2xl hover:border-[var(--accent)]/50 hover:shadow-md transition-[border-color,box-shadow,transform] duration-200 active:scale-[0.99] cursor-pointer relative"
                      >
                        {/* name & Icon */}
                        <div className="flex items-center gap-4 w-full min-w-0">
                          {product.iconUrl ? (
                            <img
                              src={product.iconUrl}
                              alt={product.name}
                              className="size-12 rounded-xl object-cover border border-gray-250 shadow-sm group-hover:scale-110 transition-transform shrink-0"
                            />
                          ) : (
                            <div className="size-12 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] shadow-inner group-hover:scale-110 transition-transform shrink-0">
                              <span className="material-symbols-outlined text-[24px]">diamond</span>
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="text-[16px] font-black text-[var(--fg-base)] tracking-tight group-hover:text-[var(--accent)] transition-colors truncate">
                              {product.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-soft)]">
                                {product.id.substring(0, 8)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* mode / Duration */}
                        <div className="flex flex-col gap-1.5 w-full min-w-0 mt-2 lg:mt-0 pt-3 border-t border-[var(--border-soft)] lg:pt-0 lg:border-none">
                          <span className="lg:hidden text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] block mb-1">{productText.tableHeaders.infoType}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 uppercase tracking-widest px-2.5 py-1 rounded-md border border-[var(--accent)]/20">
                              {product.mode}
                            </span>
                            <div className="text-[13px] font-semibold text-[var(--fg-muted)] flex items-center gap-1.5">
                              <PackageSearch className="size-3.5" />
                              {product.durationValue} {product.durationType === "months" ? productText.durationUnits.months : product.durationType === "years" ? productText.durationUnits.years : productText.durationUnits.days}
                            </div>
                          </div>
                        </div>

                        {/* pricing / Margin */}
                        <div className="flex flex-col gap-1.5 w-full min-w-0 mt-2 lg:mt-0 pt-3 border-t border-[var(--border-soft)] lg:pt-0 lg:border-none">
                          <span className="lg:hidden text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] block mb-1">{productText.tableHeaders.priceMargin}</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-[16px] font-black tracking-tight text-[var(--accent)] font-mono">{formatMoney(product.sellPriceVnd)}</span>
                            <span className="text-[11px] font-bold text-[var(--fg-muted)] line-through opacity-70 font-mono">{formatMoney(product.buyPriceVnd)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-black text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20 font-mono">
                              {productText.marginLabel} {formatMoney(margin)}
                            </span>
                            <span className="text-[11px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded border border-[var(--accent)]/20 font-mono">
                              {marginPercent}% {productText.marginSuffix}
                            </span>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="flex justify-start lg:justify-center w-full lg:w-auto mt-2 lg:mt-0 pt-3 border-t border-[var(--border-soft)] lg:pt-0 lg:border-none">
                          <span className="lg:hidden text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] mr-3">{productText.tableHeaders.status}:</span>
                          <button 
                            type="button"
                            aria-pressed={product.isActive}
                            onClick={(e) => { e.stopPropagation(); handleToggleActive(product); }} 
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-[background-color,border-color,box-shadow,color,transform] hover:scale-105 active:scale-95 ${product.isActive ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]" : "bg-red-500/10 text-red-500 border border-red-500/20"}`}
                          >
                            <div className={`size-1.5 rounded-full animate-pulse ${product.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                            {product.isActive ? productText.statusLabels.selling : productText.statusLabels.paused}
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end shrink-0 w-full lg:w-auto mt-2 lg:mt-0 pt-3 border-t border-[var(--border-soft)] lg:pt-0 lg:border-none" onClick={e => e.stopPropagation()}>
                          <ActionMenu items={[
                            { label: productText.actions.view, icon: <Eye className="size-4" />, onClick: () => setViewingProduct(product) },
                            { label: productText.actions.edit, icon: <Pencil className="size-4" />, onClick: () => setEditingProduct(product) },
                            { label: product.isActive ? productText.actions.disable : productText.actions.enable, icon: <Power className="size-4" />, onClick: () => handleToggleActive(product), variant: product.isActive ? "danger" : "default" },
                            { label: productText.actions.delete, icon: <Trash2 className="size-4" />, onClick: () => setDeletingProduct(product), variant: "danger", dividerBefore: true },
                          ]} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
            
            {/* Pagination Footer */}
            {filteredProducts.length > 0 && (
              <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-[var(--border-soft)] pt-6 sm:flex-row px-6 pb-4">
                <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
                  <span className="text-[12px] text-[var(--fg-muted)] font-bold tracking-wide uppercase whitespace-nowrap">Số hàng:</span>
                  <div className="flex bg-gray-100 rounded-lg p-1 border border-[var(--border-soft)]">
                    {[20, 50, 100].map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={pageSize === s}
                        onClick={() => {
                          setPageSize(s);
                          setPageIndex(0);
                        }}
                        className={cn(
                          "px-3 py-1.5 text-[12px] font-bold rounded-md transition-[background-color,color,box-shadow]",
                          pageSize === s ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg-base)] hover:bg-black/5"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <span className="text-[12px] text-[var(--fg-muted)] font-medium whitespace-nowrap hidden lg:inline border-l border-[var(--border-soft)] pl-3 font-mono">
                    {(pageIndex * pageSize) + 1}–{Math.min((pageIndex + 1) * pageSize, filteredProducts.length)} / {filteredProducts.length} sản phẩm
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
        </SurfaceCard>
      </PageContainer>

      {/* ===== CREATE PRODUCT – Shared Modal ===== */}
      <ProductCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          setIsCreateOpen(false);
        }}
      />

      {/* ===== EDIT MODAL ===== */}
      {editingProduct && (
        <ProductEditModal
          isOpen={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          product={editingProduct}
          onSuccess={() => {
            // Optional: Handle specifics here. The invalidation handles fetching the updated product list automatically
          }}
        />
      )}

      {/* ===== VIEW DETAIL MODAL ===== */}
      <CreateFlowDialog
        isOpen={!!activeViewingProduct}
        onClose={handleCloseViewingProduct}
        title={
          isTrashView && activeViewingProduct ? (
            <>
              {productText.detailModal.title}
              <SoftDeletedBadge className="ml-3" />
            </>
          ) : (
            productText.detailModal.title
          )
        }
        description=""
        size="lg"
          footer={
            isTrashView && activeViewingProduct ? (
              <div className="grid w-full gap-3 sm:grid-cols-3">
                <Button variant="secondary" onClick={handleCloseViewingProduct}>
                Đóng
              </Button>
              <Button
                variant="primary"
                isLoading={restoreItems.isPending}
                onClick={() => void handleRestoreViewingProduct()}
              >
                Khôi phục
              </Button>
              <Button
                variant="danger"
                isLoading={purgeItems.isPending}
                onClick={() => void handlePurgeViewingProduct()}
              >
                Xóa vĩnh viễn
              </Button>
            </div>
          ) : (
            <CreateActionFooter
              primaryLabel="Đóng chi tiết"
              onPrimary={handleCloseViewingProduct}
            />
          )
        }
      >
        {activeViewingProduct && (
          <div className="space-y-5">
            {isTrashView ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[13px] font-medium text-amber-700">
                Sản phẩm này đang nằm trong thùng rác. Bạn có thể khôi phục hoặc xóa vĩnh viễn từ chính màn này.
              </div>
            ) : null}
            <div className="flex items-center gap-4 rounded-xl border border-[var(--accent)]/20 bg-gradient-to-r from-[var(--accent)]/5 to-transparent p-4">
              {activeViewingProduct.iconUrl ? (
                <img
                  src={activeViewingProduct.iconUrl}
                  alt={activeViewingProduct.name}
                  className="size-14 rounded-2xl object-cover border border-gray-250 shadow-sm shrink-0"
                />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] shrink-0">
                  <span className="material-symbols-outlined text-[28px]">diamond</span>
                </div>
              )}
              <div>
                <h3 className="text-[18px] font-black tracking-tight text-[var(--fg-base)]">{activeViewingProduct.name}</h3>
                <p className="text-[13px] font-medium capitalize text-[var(--fg-muted)]">
                  {productText.detailModal.typeLabel} {activeViewingProduct.mode} • {activeViewingProduct.durationValue}{" "}
                  {activeViewingProduct.durationType === "months"
                    ? productText.durationUnits.months.toLowerCase()
                    : activeViewingProduct.durationType === "years"
                      ? productText.durationUnits.years.toLowerCase()
                      : productText.durationUnits.days.toLowerCase()}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                  {productText.detailModal.buyPrice}
                </p>
                <p className="text-lg font-black text-[var(--fg-base)] font-mono">{formatMoney(activeViewingProduct.buyPriceVnd)}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                  {productText.detailModal.sellPrice}
                </p>
                <p className="text-lg font-black text-[var(--accent)] font-mono">{formatMoney(activeViewingProduct.sellPriceVnd)}</p>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                {productText.detailModal.profit}
              </p>
              <p className="text-2xl font-black text-[var(--accent)] font-mono">
                {formatMoney(activeViewingProduct.sellPriceVnd - activeViewingProduct.buyPriceVnd)}
                <span className="ml-2 text-sm font-bold opacity-70 font-mono">
                  (
                  {activeViewingProduct.sellPriceVnd > 0
                    ? Math.round(
                        ((activeViewingProduct.sellPriceVnd - activeViewingProduct.buyPriceVnd) / activeViewingProduct.sellPriceVnd) * 100,
                      )
                    : 0}
                  %)
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${
                  activeViewingProduct.isActive
                    ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "bg-[var(--danger)]/10 text-[var(--danger)]"
                }`}
              >
                <span className={`size-2 rounded-full ${activeViewingProduct.isActive ? "bg-[var(--accent)]" : "bg-[var(--danger)]"}`} />
                {activeViewingProduct.isActive ? productText.detailModal.active : productText.detailModal.inactive}
              </span>
              <span className="text-[11px] font-medium text-[var(--fg-muted)]">
                {productText.detailModal.idLabel} {activeViewingProduct.id}
              </span>
            </div>
          </div>
        )}
      </CreateFlowDialog>

      {/* ===== DELETE CONFIRMATION ===== */}
      <CreateFlowDialog
        isOpen={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        title={productText.deleteModal.title}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeletingProduct(null)}>{productText.deleteModal.cancel}</Button>
            <Button variant="primary" onClick={handleDelete} className="!bg-[var(--danger)] hover:!bg-[var(--danger)] !shadow-none">{productText.deleteModal.confirm}</Button>
          </div>
        }
      >
        <div className="text-center py-4">
          <div className="size-16 bg-[var(--danger)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="size-8 text-[var(--danger)]" />
          </div>
          <p className="text-[15px] font-bold text-[var(--fg-base)] mb-2">{productText.deleteModal.question}</p>
          <p className="text-[13px] text-[var(--fg-muted)]">
            {productText.deleteModal.warning(deletingProduct?.name ?? "")}
          </p>
        </div>
      </CreateFlowDialog>


    </AppLayout>
  );
}
