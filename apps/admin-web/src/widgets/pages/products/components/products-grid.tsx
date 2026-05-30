"use client";

import React from "react";
import { motion } from "framer-motion";
import { Eye, Pencil, Trash2, Power, Layers, Clock, TrendingUp, DollarSign } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { ActionMenu } from "@/shared/ui/action-menu";

export type ProductGridRow = {
  id: string;
  name: string;
  mode: string;
  buyPriceVnd: number;
  sellPriceVnd: number;
  durationType: 'days' | 'months' | 'years';
  durationValue: number;
  isActive: boolean;

  // Computed properties from ProductModel.toJSON()
  profit: number;
  marginPercent: number;
  modeLabel: string;
  formattedDuration: string;
  formattedSellPrice: string;
  formattedBuyPrice: string;
  formattedProfit: string;
};

interface ProductsGridProps {
  isLoading: boolean;
  mappedProducts: ProductGridRow[];
  onRowClick: (row: any) => void;
  onEditClick: (row: any) => void;
  onDeleteClick: (row: any) => void;
  onToggleActive: (row: any) => void;
}

const ProductCard = React.memo(function ProductCard({
  product,
  onRowClick,
  onEditClick,
  onDeleteClick,
  onToggleActive,
}: {
  product: ProductGridRow;
  onRowClick: (row: any) => void;
  onEditClick: (row: any) => void;
  onDeleteClick: (row: any) => void;
  onToggleActive: (row: any) => void;
}) {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditClick(product);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteClick(product);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleActive(product);
  };

  return (
    <motion.div
      data-testid="product-card"
      onClick={() => onRowClick(product)}
      whileHover={{ y: -3, boxShadow: "0 10px 20px rgba(15, 23, 42, 0.05)" }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={cn(
        "group cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all duration-200 flex flex-col justify-between select-none relative hover:border-blue-300",
        !product.isActive && "bg-gray-50/50 border-gray-200 opacity-80"
      )}
    >
      <div className="p-4 flex-1">
        {/* Header: Icon + Name + Active Switch */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50/50 text-blue-600 font-bold group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[18px]">diamond</span>
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-gray-800 text-[13.5px] leading-tight" title={product.name}>
                {product.name}
              </h3>
              <p className="text-[10px] text-gray-400 mt-1 font-mono uppercase tracking-wider">
                ID: {product.id.substring(0, 8)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggle}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider transition-all",
              product.isActive
                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                : "bg-red-500/10 text-red-500 border border-red-500/20"
            )}
          >
            <span className={cn("size-1.5 rounded-full shrink-0", product.isActive ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
            {product.isActive ? "Đang bán" : "Tạm ngưng"}
          </button>
        </div>

        {/* Tags info */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 uppercase tracking-widest px-2 py-0.5 rounded-md border border-[var(--accent)]/20">
            {product.modeLabel}
          </span>
          <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md flex items-center gap-1 border border-gray-200">
            <Clock className="size-3" />
            {product.formattedDuration}
          </span>
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-2 gap-2.5 mt-5">
          <div className="rounded-xl border border-gray-150 bg-gray-50/50 p-2.5">
            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wide">Giá vốn</span>
            <div className="font-mono font-bold text-[12.5px] text-gray-600 line-through mt-0.5">
              {product.formattedBuyPrice}
            </div>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/20 p-2.5">
            <span className="text-[9px] text-blue-500 uppercase font-bold tracking-wide">Giá bán</span>
            <div className="font-mono font-black text-[13.5px] text-blue-600 mt-0.5">
              {product.formattedSellPrice}
            </div>
          </div>
        </div>

        {/* Margin Alert Box */}
        <div className="mt-4 rounded-xl px-3 py-2 flex items-center justify-between border border-emerald-100 bg-emerald-50/30">
          <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
            <TrendingUp className="size-3.5 text-emerald-500 shrink-0" />
            Lợi nhuận
          </span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-bold text-emerald-600">
              {product.formattedProfit}
            </span>
            <span className="text-[9.5px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-1 py-0.2 rounded border border-[var(--accent)]/20 font-mono">
              {product.marginPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2 flex items-center justify-end" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <button
            title="Xem chi tiết"
            onClick={() => onRowClick(product)}
            className="flex size-7 items-center justify-center rounded-lg border border-gray-250 bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-all"
          >
            <Eye className="size-3.5" />
          </button>
          <button
            title="Sửa sản phẩm"
            onClick={handleEdit}
            className="flex size-7 items-center justify-center rounded-lg border border-gray-250 bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-all"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            title="Xóa sản phẩm"
            onClick={handleDelete}
            className="flex size-7 items-center justify-center rounded-lg border border-red-200 bg-white hover:bg-red-50 hover:border-red-300 text-red-500 hover:text-red-700 transition-all"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
});

export const ProductsGrid = React.memo(function ProductsGrid({
  isLoading,
  mappedProducts,
  onRowClick,
  onEditClick,
  onDeleteClick,
  onToggleActive,
}: ProductsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="products-grid-loading">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-2xl border border-gray-200 bg-white flex flex-col justify-between min-h-[190px]">
            <div className="p-4 flex-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="size-9 shimmer rounded-xl" />
                  <div>
                    <div className="h-3.5 w-24 shimmer rounded mb-1.5" />
                    <div className="h-2.5 w-16 shimmer rounded" />
                  </div>
                </div>
                <div className="h-5 w-16 shimmer rounded-full" />
              </div>
              <div className="h-3.5 w-36 shimmer rounded my-4" />
            </div>
            <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2 flex justify-end gap-1">
              <div className="size-7 shimmer rounded-lg" />
              <div className="size-7 shimmer rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (mappedProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full border border-blue-100 bg-blue-50/50">
          <Layers className="size-5 text-blue-600 opacity-60" />
        </div>
        <p className="text-[13.5px] font-semibold text-gray-800">Không tìm thấy sản phẩm</p>
        <p className="mt-0.5 text-[11.5px] text-gray-500">Thử thay đổi bộ lọc hoặc tạo sản phẩm mới.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="products-grid">
      {mappedProducts.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onRowClick={onRowClick}
          onEditClick={onEditClick}
          onDeleteClick={onDeleteClick}
          onToggleActive={onToggleActive}
        />
      ))}
    </div>
  );
});
