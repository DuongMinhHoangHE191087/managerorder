"use client";

import React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Briefcase, Phone, Mail, User, Package, Star, Eye, Pencil, Trash2 } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { ActionMenu } from "@/shared/ui/action-menu";

export type ProviderGridRow = {
  id: string;
  name: string;
  code: string | null;
  status: string | null;
  contacts: any[];
  tier: "vip" | "regular";
  reliabilityScore: number;
  notes: string | null;
  debtAmountVnd: number;
  totalImportAmountVnd: number;
  purchaseOrderCount: number;

  // Computed properties from ProviderModel.toJSON()
  primaryContact: any | null;
  reliabilityState: {
    label: string;
    class: string;
  };
  formattedDebt: string;
  formattedTotalImport: string;
};

interface ProvidersGridProps {
  isLoading: boolean;
  mappedProviders: ProviderGridRow[];
  onRowClick: (row: any) => void;
  onEditClick: (row: any) => void;
  onDeleteClick: (row: any) => void;
}

const ProviderCard = React.memo(function ProviderCard({
  provider,
  onRowClick,
  onEditClick,
  onDeleteClick,
}: {
  provider: ProviderGridRow;
  onRowClick: (row: any) => void;
  onEditClick: (row: any) => void;
  onDeleteClick: (row: any) => void;
}) {
  const contact = provider.primaryContact;

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditClick(provider);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteClick(provider);
  };

  const handleCardClick = () => {
    onRowClick(provider);
  };

  const reliabilityColor = provider.reliabilityScore < 50 ? "bg-rose-500" : provider.reliabilityScore < 80 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <motion.div
      data-testid="provider-card"
      onClick={handleCardClick}
      whileHover={{ y: -3, boxShadow: "0 10px 20px rgba(15, 23, 42, 0.05)" }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all duration-200 flex flex-col justify-between select-none relative hover:border-amber-300"
    >
      {/* Top Accent Line based on Reliability */}
      <div className={cn("h-1.5 w-full", reliabilityColor)} />

      <div className="p-4 flex-1">
        {/* Header: Icon + Name */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl font-bold border",
              provider.tier === "vip"
                ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white border-amber-500/20 shadow-inner"
                : "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 border-gray-200"
            )}>
              {provider.tier === "vip" ? <ShieldCheck className="size-5" /> : <Briefcase className="size-5 opacity-70" />}
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-gray-800 text-[13.5px] leading-tight" title={provider.name}>
                {provider.name}
              </h3>
              <span className={cn(
                "inline-block text-[8px] font-black uppercase tracking-wider px-1.5 py-0.2 mt-1 rounded border",
                provider.tier === "vip"
                  ? "bg-amber-100 text-amber-700 border-amber-300/30"
                  : "bg-gray-100 text-gray-500 border-gray-200"
              )}>
                {provider.tier === "vip" ? "VIP" : "Thường"}
              </span>
            </div>
          </div>

          {/* Reliability Score */}
          <div className="flex flex-col items-end whitespace-nowrap">
            <span className="text-[8.5px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-0.5">
              <Star className="size-2.5 fill-amber-500 text-amber-500 shrink-0" />
              Độ tin cậy
            </span>
            <div className="flex items-baseline mt-0.5">
              <span className={cn(
                "text-[13.5px] font-black font-mono",
                provider.reliabilityScore < 50 ? "text-rose-500" : provider.reliabilityScore < 80 ? "text-amber-500" : "text-emerald-500"
              )}>
                {provider.reliabilityScore}
              </span>
              <span className="text-[9px] text-gray-400 font-bold">/100</span>
            </div>
          </div>
        </div>

        {/* Contact info & Registry */}
        <div className="space-y-2 mt-4 text-[12px] text-gray-600">
          {contact ? (
            <div className="flex items-center gap-2 min-w-0">
              {contact.type === "phone" ? (
                <Phone className="size-3.5 text-gray-400 shrink-0" />
              ) : contact.type === "email" ? (
                <Mail className="size-3.5 text-gray-400 shrink-0" />
              ) : (
                <User className="size-3.5 text-gray-400 shrink-0" />
              )}
              <span className="truncate text-gray-700 font-medium">{contact.value}</span>
            </div>
          ) : (
            <div className="text-gray-400 italic text-[11px]">Không có liên hệ chính</div>
          )}
          
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Package className="size-3.5 text-gray-400" />
            <span>Đơn nhập hàng: <strong className="text-gray-700 font-mono">{provider.purchaseOrderCount || 0}</strong> đơn</span>
          </div>
        </div>

        {/* Financial info */}
        <div className="grid grid-cols-2 gap-2.5 mt-5">
          <div className="rounded-xl border border-gray-150 bg-gray-50/50 p-2.5">
            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wide">Đã nhập</span>
            <div className="font-mono font-bold text-[12px] text-blue-600 mt-0.5 truncate">
              {provider.formattedTotalImport}
            </div>
          </div>
          <div className={cn(
            "rounded-xl border p-2.5",
            provider.debtAmountVnd > 0
              ? "border-red-100 bg-red-50/30"
              : "border-emerald-100 bg-emerald-50/20"
          )}>
            <span className={cn("text-[9px] uppercase font-bold tracking-wide", provider.debtAmountVnd > 0 ? "text-red-500" : "text-emerald-500")}>Công nợ</span>
            <div className={cn("font-mono font-black text-[12.5px] mt-0.5 truncate", provider.debtAmountVnd > 0 ? "text-red-600" : "text-emerald-600")}>
              {provider.debtAmountVnd > 0 ? provider.formattedDebt : "0 đ"}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2 flex items-center justify-end" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <button
            title="Xem chi tiết"
            onClick={handleCardClick}
            className="flex size-7 items-center justify-center rounded-lg border border-gray-250 bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-all"
          >
            <Eye className="size-3.5" />
          </button>
          <button
            title="Sửa nhà cung cấp"
            onClick={handleEdit}
            className="flex size-7 items-center justify-center rounded-lg border border-gray-250 bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-all"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            title="Xóa nhà cung cấp"
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

export const ProvidersGrid = React.memo(function ProvidersGrid({
  isLoading,
  mappedProviders,
  onRowClick,
  onEditClick,
  onDeleteClick,
}: ProvidersGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="providers-grid-loading">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-2xl border border-gray-200 bg-white flex flex-col justify-between min-h-[190px]">
            <div className="p-4 flex-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="size-9 rounded-xl shimmer" />
                  <div>
                    <div className="h-3.5 w-24 rounded shimmer mb-1.5" />
                    <div className="h-2.5 w-16 rounded shimmer" />
                  </div>
                </div>
                <div className="h-5 w-16 rounded-full shimmer" />
              </div>
              <div className="h-3.5 w-36 rounded shimmer my-4" />
            </div>
            <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2 flex justify-end gap-1">
              <div className="size-7 rounded-lg shimmer" />
              <div className="size-7 rounded-lg shimmer" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (mappedProviders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full border border-amber-100 bg-amber-50/50">
          <Briefcase className="size-5 text-amber-600 opacity-60" />
        </div>
        <p className="text-[13.5px] font-semibold text-gray-800">Không tìm thấy nhà cung cấp</p>
        <p className="mt-0.5 text-[11.5px] text-gray-500">Thử thay đổi bộ lọc hoặc tạo nhà cung cấp mới.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="providers-grid">
      {mappedProviders.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          onRowClick={onRowClick}
          onEditClick={onEditClick}
          onDeleteClick={onDeleteClick}
        />
      ))}
    </div>
  );
});
