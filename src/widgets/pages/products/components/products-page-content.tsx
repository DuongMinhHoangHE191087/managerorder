"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Plus, Search, CheckCircle, PackageSearch, CircleDollarSign, Pencil, Trash2, Eye, Power } from "lucide-react";
import { appToast } from "@/shared/lib/toast";

import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer, PageHeader, StatsGrid, SurfaceCard } from "@/shared/ui/page-layout";
import { formatMoney } from "@/lib/utils";
import { Modal } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";
import { ActionMenu } from "@/shared/ui/action-menu";
import type { ProductService } from "@/lib/domain/types";
import { useProducts, useDeleteProduct, useUpdateProduct } from "@/widgets/pages/products/hooks/use-products";

// ── Lazy-loaded modals ─────────────────────────────────────────────────────
const ProductCreateModal = dynamic(() => import("@/widgets/pages/products/components/product-create-modal").then(m => ({ default: m.ProductCreateModal })), { ssr: false });
const ProductEditModal = dynamic(() => import("@/widgets/pages/products/components/product-edit-modal").then(m => ({ default: m.ProductEditModal })), { ssr: false });

export default function ProductsPage() {
  const { data: products = [], isLoading, isError } = useProducts();
  const { mutateAsync: deleteProduct } = useDeleteProduct();
  const { mutateAsync: updateProduct } = useUpdateProduct();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductService | null>(null);
  const [viewingProduct, setViewingProduct] = useState<ProductService | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductService | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("");

  const filteredProducts = useMemo(() => products.filter(p => {
    if (modeFilter && p.mode !== modeFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    // Search across multiple fields: name, mode, durationType, prices
    return (
      p.name.toLowerCase().includes(q) ||
      p.mode.toLowerCase().includes(q) ||
      (p.durationType && p.durationType.toLowerCase().includes(q)) ||
      String(p.sellPriceVnd).includes(q) ||
      String(p.buyPriceVnd).includes(q)
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
      appToast.success("Đã xóa sản phẩm!");
    } catch {
      appToast.error("Lỗi xóa sản phẩm");
    }
  }

  async function handleToggleActive(product: ProductService) {
    try {
      const data = await updateProduct({ id: product.id, isActive: !product.isActive });
      appToast.success(`Đã ${data?.isActive ? 'bật' : 'tắt'} sản phẩm!`);
    } catch {
      appToast.error("Lỗi cập nhật trạng thái");
    }
  }

  return (
    <AppLayout>
      <PageContainer className="relative">
        <PageHeader
          title="Quản lý Sản phẩm"
          description="Theo dõi kho tài khoản cao cấp và biên lợi nhuận của bạn."
          actions={
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.98] hover:shadow-md"
              type="button"
            >
              <Plus className="size-5" />
              Thêm Sản Phẩm Mới
            </button>
          }
        />

        {/* Stat Cards */}
        <StatsGrid className="mb-8 md:grid-cols-3">
          <SurfaceCard className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">Tổng sản phẩm</p>
              <span className="material-symbols-outlined text-[var(--accent)]">inventory_2</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-[var(--fg-base)]">{totalProducts}</span>
            </div>
          </SurfaceCard>
          <SurfaceCard className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">Đang hoạt động</p>
              <CheckCircle className="size-5 text-[var(--accent)]" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-[var(--fg-base)]">{activeProducts}</span>
            </div>
          </SurfaceCard>
          <SurfaceCard className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">Tỷ lệ lợi nhuận TB</p>
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
                  placeholder="Tìm kiếm sản phẩm..."
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <Select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                className="h-11 !w-auto min-w-[11rem] rounded-xl text-[13px] font-bold"
              >
                <option value="">Tất cả loại</option>
                <option value="slot">Slot</option>
                <option value="key">Key</option>
                <option value="hybrid">Hybrid</option>
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
                <h3 className="text-[15px] font-bold text-[var(--fg-base)]">Lỗi tải dữ liệu</h3>
                <p className="text-[13px] text-[var(--fg-muted)] mt-1">Không thể tải danh sách sản phẩm. Vui lòng thử lại.</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <PackageSearch className="size-12 text-[var(--fg-muted)] opacity-50 mb-3" />
                <h3 className="text-[15px] font-bold text-[var(--fg-base)]">Không có sản phẩm nào</h3>
                <p className="text-[13px] text-[var(--fg-muted)] mt-1">{searchQuery || modeFilter ? "Thử thay đổi bộ lọc tìm kiếm" : "Nhấn \"Thêm Sản Phẩm Mới\" để bắt đầu"}</p>
              </div>
            ) : (
          <div className="flex flex-col pb-4">
            <div className="hidden lg:grid grid-cols-[minmax(0,3.5fr)_minmax(0,2fr)_minmax(0,3fr)_140px_100px] gap-4 px-10 py-4 border-b border-[var(--border-soft)] mb-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Sản Phẩm</div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Thông tin / Loại</div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Giá Nhập / Giá Bán / Lợi Nhuận</div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] justify-self-center">Trạng thái</div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] justify-self-end">Thao tác</div>
            </div>

            <div className="flex flex-col gap-3 px-4">
              {filteredProducts.map((product) => {
                const margin = product.sellPriceVnd - product.buyPriceVnd;
                const marginPercent = product.sellPriceVnd > 0 ? Math.round((margin / product.sellPriceVnd) * 100) : 0;
                
                return (
                  <div 
                    key={product.id} 
                    onClick={() => setViewingProduct(product)}
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
                      <span className="lg:hidden text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] block mb-1">Thông tin / Loại</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 uppercase tracking-widest px-2.5 py-1 rounded-md border border-[var(--accent)]/20">
                          {product.mode}
                        </span>
                        <div className="text-[13px] font-semibold text-[var(--fg-muted)] flex items-center gap-1.5">
                          <PackageSearch className="size-3.5" />
                          {product.durationValue} {product.durationType === 'months' ? 'Tháng' : product.durationType === 'years' ? 'Năm' : 'Ngày'}
                        </div>
                      </div>
                    </div>

                    {/* pricing / Margin */}
                    <div className="flex flex-col gap-1.5 w-full min-w-0 mt-2 lg:mt-0 pt-3 border-t border-[var(--border-soft)] lg:pt-0 lg:border-none">
                      <span className="lg:hidden text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] block mb-1">Giá Nhập / Giá Bán / Lợi Nhuận</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[16px] font-black tracking-tight text-[var(--accent)]">{formatMoney(product.sellPriceVnd)}</span>
                        <span className="text-[11px] font-bold text-[var(--fg-muted)] line-through opacity-70">{formatMoney(product.buyPriceVnd)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-black text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                          Lãi: {formatMoney(margin)}
                        </span>
                        <span className="text-[11px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded border border-[var(--accent)]/20">
                          {marginPercent}% Biên
                        </span>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex justify-start lg:justify-center w-full lg:w-auto mt-2 lg:mt-0 pt-3 border-t border-[var(--border-soft)] lg:pt-0 lg:border-none">
                      <span className="lg:hidden text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] mr-3">Trạng thái:</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleToggleActive(product); }} 
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 ${product.isActive ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]" : "bg-red-500/10 text-red-500 border border-red-500/20"}`}
                      >
                        <div className={`size-1.5 rounded-full animate-pulse ${product.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                        {product.isActive ? "Đang Bán" : "Tạm Ngưng"}
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end shrink-0 w-full lg:w-auto mt-2 lg:mt-0 pt-3 border-t border-[var(--border-soft)] lg:pt-0 lg:border-none" onClick={e => e.stopPropagation()}>
                      <ActionMenu items={[
                        { label: "Xem chi tiết", icon: <Eye className="size-4" />, onClick: () => setViewingProduct(product) },
                        { label: "Chỉnh sửa", icon: <Pencil className="size-4" />, onClick: () => setEditingProduct(product) },
                        { label: product.isActive ? "Ngừng bán" : "Mở bán lại", icon: <Power className="size-4" />, onClick: () => handleToggleActive(product), variant: product.isActive ? "danger" : "default" },
                        { label: "Xóa sản phẩm", icon: <Trash2 className="size-4" />, onClick: () => setDeletingProduct(product), variant: "danger", dividerBefore: true },
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
      <Modal isOpen={!!viewingProduct} onClose={() => setViewingProduct(null)} title="Chi tiết Sản Phẩm" size="md">
        {viewingProduct && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-[var(--accent)]/5 to-transparent rounded-xl border border-[var(--accent)]/20">
              <div className="size-14 bg-[var(--accent)]/10 rounded-2xl flex items-center justify-center text-[var(--accent)]">
                <span className="material-symbols-outlined text-[28px]">diamond</span>
              </div>
              <div>
                <h3 className="text-[18px] font-black text-[var(--fg-base)] tracking-tight">{viewingProduct.name}</h3>
                <p className="text-[13px] text-[var(--fg-muted)] font-medium capitalize">Loại: {viewingProduct.mode} • {viewingProduct.durationValue} {viewingProduct.durationType === 'months' ? 'tháng' : viewingProduct.durationType === 'years' ? 'năm' : 'ngày'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[var(--surface-light)] border border-[var(--border-soft)]">
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1">Giá nhập</p>
                <p className="text-lg font-black text-[var(--fg-base)]">{formatMoney(viewingProduct.buyPriceVnd)}</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--surface-light)] border border-[var(--border-soft)]">
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1">Giá bán</p>
                <p className="text-lg font-black text-[var(--accent)]">{formatMoney(viewingProduct.sellPriceVnd)}</p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/20">
              <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1">Lợi nhuận</p>
              <p className="text-2xl font-black text-[var(--accent)]">
                {formatMoney(viewingProduct.sellPriceVnd - viewingProduct.buyPriceVnd)}
                <span className="text-sm ml-2 font-bold opacity-70">
                  ({viewingProduct.sellPriceVnd > 0 ? Math.round(((viewingProduct.sellPriceVnd - viewingProduct.buyPriceVnd) / viewingProduct.sellPriceVnd) * 100) : 0}%)
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${viewingProduct.isActive ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "bg-[var(--danger)]/10 text-[var(--danger)]"}`}>
                <span className={`size-2 rounded-full ${viewingProduct.isActive ? "bg-[var(--accent)]" : "bg-[var(--danger)]"}`}></span>
                {viewingProduct.isActive ? "Đang hoạt động" : "Đã tắt"}
              </span>
              <span className="text-[11px] text-[var(--fg-muted)] font-medium">ID: {viewingProduct.id}</span>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== DELETE CONFIRMATION ===== */}
      <Modal isOpen={!!deletingProduct} onClose={() => setDeletingProduct(null)} title="Xác nhận xóa" size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeletingProduct(null)}>Hủy</Button>
            <Button variant="primary" onClick={handleDelete} className="!bg-[var(--danger)] hover:!bg-[var(--danger)] !shadow-none">Xóa vĩnh viễn</Button>
          </div>
        }
      >
        <div className="text-center py-4">
          <div className="size-16 bg-[var(--danger)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="size-8 text-[var(--danger)]" />
          </div>
          <p className="text-[15px] font-bold text-[var(--fg-base)] mb-2">Bạn chắc chắn muốn xóa?</p>
          <p className="text-[13px] text-[var(--fg-muted)]">
            Sản phẩm <span className="font-bold text-[var(--fg-base)]">&ldquo;{deletingProduct?.name}&rdquo;</span> sẽ bị xóa vĩnh viễn và không thể khôi phục.
          </p>
        </div>
      </Modal>


    </AppLayout>
  );
}
