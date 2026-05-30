"use client";

import React from "react";
import { X } from "lucide-react";
import type { ProductService, Provider } from "@/lib/domain/types";
import { Select } from "@/shared/ui/select";
import { FiltersBar } from "@/shared/ui/page-layout";
import { Button } from "@/shared/ui/button";
import { INVENTORY_COPY as copy } from "../copy";

interface InventoryFiltersProps {
  products: ProductService[];
  providers: Provider[];
  productIdFilter: string;
  providerFilter: string;
  statusFilter: string;
  onProductFilterChange: (v: string) => void;
  onProviderFilterChange: (v: string) => void;
  onStatusFilterChange: (v: string) => void;
  viewMode?: "card" | "list";
  onViewModeChange?: (mode: "card" | "list") => void;
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
  viewMode = "list",
  onViewModeChange,
}: InventoryFiltersProps) {
  const hasFilters = productIdFilter || providerFilter || statusFilter;

  const handleClearAll = () => {
    onProductFilterChange("");
    onProviderFilterChange("");
    onStatusFilterChange("");
  };

  return (
    <div className="page-stack mb-3">
      <FiltersBar sticky className="px-4 py-2">
        <div className="flex flex-wrap items-center gap-3 w-full lg:flex-nowrap">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 flex-1">
            <Select 
              value={productIdFilter} 
              onChange={(e) => onProductFilterChange(e.target.value)} 
              className="h-9 text-xs font-bold rounded-xl"
            >
              <option value="">{copy.filters.allProducts}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>

            <Select 
              value={providerFilter} 
              onChange={(e) => onProviderFilterChange(e.target.value)} 
              className="h-9 text-xs font-bold rounded-xl"
            >
              <option value="">{copy.filters.allProviders}</option>
              {providers.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </Select>

            <Select 
              value={statusFilter} 
              onChange={(e) => onStatusFilterChange(e.target.value)} 
              className="h-9 text-xs font-bold rounded-xl"
            >
              <option value="">{copy.filters.allStatus}</option>
              <option value="active">{copy.filters.active}</option>
              <option value="full">{copy.filters.full}</option>
              <option value="expiring_7d">{copy.filters.expiring7d}</option>
              <option value="expired">{copy.filters.expired}</option>
            </Select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onViewModeChange && (
              <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-250/80">
                <button
                  type="button"
                  onClick={() => onViewModeChange("card")}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all duration-150 ${viewMode === "card" ? "bg-white text-[var(--accent)] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Thẻ
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange("list")}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all duration-150 ${viewMode === "list" ? "bg-white text-[var(--accent)] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Danh sách
                </button>
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              className="h-9 text-sm px-3"
              disabled={!hasFilters}
              onClick={handleClearAll}
            >
              <X className="size-4 mr-1" />
              Xóa lọc
            </Button>
          </div>
        </div>
      </FiltersBar>
    </div>
  );
});
