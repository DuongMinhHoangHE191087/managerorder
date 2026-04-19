"use client";

import React from "react";
import type { ProductService, Provider } from "@/lib/domain/types";
import { Select } from "@/shared/ui/select";
import { FiltersBar } from "@/shared/ui/page-layout";

interface InventoryFiltersProps {
  products: ProductService[];
  providers: Provider[];
  productIdFilter: string;
  providerFilter: string;
  statusFilter: string;
  onProductFilterChange: (v: string) => void;
  onProviderFilterChange: (v: string) => void;
  onStatusFilterChange: (v: string) => void;
}

export const InventoryFilters = React.memo(function InventoryFilters({
  products,
  providers,
  productIdFilter,
  providerFilter,
  statusFilter,
  onProductFilterChange,
  onProviderFilterChange,
  onStatusFilterChange,
}: InventoryFiltersProps) {
  const hasFilters = productIdFilter || providerFilter || statusFilter;

  const handleClearAll = () => {
    onProductFilterChange("");
    onProviderFilterChange("");
    onStatusFilterChange("");
  };

  return (
    <div className="page-stack">
      <FiltersBar sticky className="px-4 py-4">
        <div className="flex w-full flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.84)] px-3 py-1.5 text-[13px] shadow-sm">
            <span className="font-medium text-[var(--fg-muted)]">Sản phẩm:</span>
            <Select value={productIdFilter} onChange={(e) => onProductFilterChange(e.target.value)} className="min-w-[11rem]">
              <option value="">Tất cả sản phẩm</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div className="flex items-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.84)] px-3 py-1.5 text-[13px] shadow-sm">
            <span className="font-medium text-[var(--fg-muted)]">Nhà cung cấp:</span>
            <Select value={providerFilter} onChange={(e) => onProviderFilterChange(e.target.value)} className="min-w-[11rem]">
              <option value="">Tất cả</option>
              {providers.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </Select>
          </div>
          <div className="flex items-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.84)] px-3 py-1.5 text-[13px] shadow-sm">
            <span className="font-medium text-[var(--fg-muted)]">Trạng thái:</span>
            <Select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)} className="min-w-[12rem]">
              <option value="">Tất cả trạng thái</option>
              <option value="active">Hoạt động (còn chỗ)</option>
              <option value="full">Đã đầy (hết chỗ)</option>
              <option value="expiring_7d">Sắp hết hạn (&lt; 7 ngày)</option>
              <option value="expired">Đã hết hạn</option>
            </Select>
          </div>
          {hasFilters ? (
            <button
              type="button"
              onClick={handleClearAll}
              className="ml-auto inline-flex items-center justify-center rounded-[0.9rem] px-3 py-1.5 text-[13px] font-bold text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10"
            >
              Xóa bộ lọc
            </button>
          ) : null}
        </div>
      </FiltersBar>
    </div>
  );
});
