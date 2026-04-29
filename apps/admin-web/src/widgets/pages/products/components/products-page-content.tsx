"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, CheckCircle, PackageSearch, CircleDollarSign, Pencil, Trash2, Eye, Power } from "lucide-react";
import { appToast } from "@/shared/lib/toast";

import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer, PageHeader, StatsGrid, SurfaceCard } from "@/shared/ui/page-layout";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";
import { ActionMenu } from "@/shared/ui/action-menu";
import { CreateActionFooter, CreateFlowDialog } from "@/shared/ui/create-flow-shell";
import { vi } from "@/shared/messages/vi";
import type { ProductService } from "@/lib/domain/types";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const trashMode = searchParams.get("trash") === "1";
  const viewingProductId = searchParams.get("view");
  const { data: products = [], isLoading, isError } = useProducts();
  const { mutateAsync: deleteProduct } = useDeleteProduct();
  const { mutateAsync: updateProduct } = useUpdateProduct();
  const { data: routedProduct } = useProductDetail(viewingProductId, trashMode);
  const restoreItems = useRestoreItems();
  const purgeItems = usePurgeItems();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductService | null>(null);
  const [viewingProduct, setViewingProduct] = useState<ProductService | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductService | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("");

  const activeViewingProduct = viewingProductId ? routedProduct ?? null : viewingProduct;

  useEffect(() => {
    if (viewingProductId && routedProduct) {
      setViewingProduct(routedProduct);
    }
  }, [routedProduct, viewingProductId]);

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
    setViewingProduct(null);
    router.replace("/products");
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
          description={productText.description}
          actions={
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.98] hover:shadow-md"
              type="button"
            >
              <Plus className="size-5" />
              {productText.createButton}
            </button>
          }
        />

        {/* Stat Cards */}
        <StatsGrid className="mb-8 md:grid-cols-3">
          <SurfaceCard className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">{productText.stats.total}</p>
              <span className="material-symbols-outlined text-[var(--accent)]">inventory_2</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-[var(--fg-base)]">{totalProducts}</span>
            </div>
          </SurfaceCard>
          <SurfaceCard className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">{productText.stats.active}</p>
              <CheckCircle className="size-5 text-[var(--accent)]" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-[var(--fg-base)]">{activeProducts}</span>
            </div>
          </SurfaceCard>
          <SurfaceCard className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">{productText.stats.avgMargin}</p>
              <CircleDollarSign className="size-5 text-[var(--accent)]" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-[var(--fg-base)]">{avgMargin}%</span>
            </div>
          </SurfaceCard>
        </StatsGrid>

        {/* Products Table */}
        <div className="glass-card overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white border border-[var(--border-soft)]">
          <div className="flex justify-between items-center bg-transparent px-6 py-4 border-b border-[var(--border-soft)]">
            <div className="flex gap-3 w-full max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] size-4" />
                <input
                  className="w-full bg-[var(--bg-surface)] backdrop-blur-md border border-[var(--border-soft)] rounded-xl pl-9 pr-4 py-2 text-[13px] font-medium focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--accent)] text-[var(--fg-base)] placeholder:text-[var(--fg-muted)] outline-none transition-all"
                  placeholder={productText.searchPlaceholder}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  data-testid="products-search"
                />
              </div>
              <Select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                data-testid="products-mode-filter"
                className="h-11 !w-auto min-w-[11rem] rounded-xl text-[13px] font-bold"
              >
                <option value="">{productText.allTypes}</option>
                <option value="slot">{productText.types.slot}</option>
                <option value="key">{productText.types.key}</option>
                <option value="hybrid">{productText.types.hybrid}</option>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="size-10 bg-gray-200 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/4" />
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-20" />
                    <div className="h-4 bg-gray-200 rounded w-20" />
                  </div>
                ))}
              </div>
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
              {filteredProducts.map((product) => {
                const margin = product.sellPriceVnd - product.buyPriceVnd;
                const marginPercent = product.sellPriceVnd > 0 ? Math.round((margin / product.sellPriceVnd) * 100) : 0;
                
                return (
                  <div 
                    key={product.id} 
                    onClick={() => setViewingProduct(product)}
                    data-testid="product-row"
                    data-product-id={product.id}
                    className="group flex flex-col lg:grid lg:grid-cols-[minmax(0,3.5fr)_minmax(0,2fr)_minmax(0,3fr)_140px_100px] gap-4 items-center p-5 bg-[var(--surface-light)] border border-[var(--border-soft)] rounded-2xl hover:border-[var(--accent)]/50 hover:shadow-md transition-all cursor-pointer relative"
                  >
                    {/* name & Icon */}
                    <div className="flex items-center gap-4 w-full min-w-0">
                      <div className="size-12 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] shadow-inner group-hover:scale-110 transition-transform shrink-0">
                        <span className="material-symbols-outlined text-[24px]">diamond</span>
                      </div>
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
                        <span className="text-[16px] font-black tracking-tight text-[var(--accent)]">{formatMoney(product.sellPriceVnd)}</span>
                        <span className="text-[11px] font-bold text-[var(--fg-muted)] line-through opacity-70">{formatMoney(product.buyPriceVnd)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-black text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                          {productText.marginLabel} {formatMoney(margin)}
                        </span>
                        <span className="text-[11px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded border border-[var(--accent)]/20">
                          {marginPercent}% {productText.marginSuffix}
                        </span>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex justify-start lg:justify-center w-full lg:w-auto mt-2 lg:mt-0 pt-3 border-t border-[var(--border-soft)] lg:pt-0 lg:border-none">
                      <span className="lg:hidden text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] mr-3">{productText.tableHeaders.status}:</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleToggleActive(product); }} 
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 ${product.isActive ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]" : "bg-red-500/10 text-red-500 border border-red-500/20"}`}
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
        </div>
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
        title={productText.detailModal.title}
        description="Giữ detail ngắn gọn nhưng đủ để kiểm tra mode vận hành, giá bán, giá vốn và biên lợi nhuận."
        size="lg"
        footer={
          trashMode && activeViewingProduct ? (
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
            {trashMode ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[13px] font-medium text-amber-700">
                Sản phẩm này đang nằm trong thùng rác. Bạn có thể khôi phục hoặc xóa vĩnh viễn từ chính màn này.
              </div>
            ) : null}
            <div className="flex items-center gap-4 rounded-xl border border-[var(--accent)]/20 bg-gradient-to-r from-[var(--accent)]/5 to-transparent p-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                <span className="material-symbols-outlined text-[28px]">diamond</span>
              </div>
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
                <p className="text-lg font-black text-[var(--fg-base)]">{formatMoney(activeViewingProduct.buyPriceVnd)}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                  {productText.detailModal.sellPrice}
                </p>
                <p className="text-lg font-black text-[var(--accent)]">{formatMoney(activeViewingProduct.sellPriceVnd)}</p>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                {productText.detailModal.profit}
              </p>
              <p className="text-2xl font-black text-[var(--accent)]">
                {formatMoney(activeViewingProduct.sellPriceVnd - activeViewingProduct.buyPriceVnd)}
                <span className="ml-2 text-sm font-bold opacity-70">
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
