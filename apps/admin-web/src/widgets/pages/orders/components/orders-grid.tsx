"use client";

import React from "react";
import { motion } from "framer-motion";
import { User, Phone, Link2, Copy, RefreshCw, Eye, MoreHorizontal, Search } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";

export type OrderGridContact = {
  id?: string;
  channel: string;
  value: string;
  is_verified?: boolean;
};

export type OrderGridRow = {
  id: string;
  orderCode: string | null;
  customer_id: string;
  product_id?: string;
  quantity: number;
  totalAmountVnd: number;
  totalPaid: number;
  totalCostVnd: number;
  paymentMethod: string | null;
  paymentTerms?: string | null;
  paymentState?: string | null;
  balanceDueVnd: number;
  isFullyPaid: boolean;
  status: string;
  expiresAt: string | null;
  
  customerName: string;
  productName: string;
  customerEmail: string | null;
  customerContacts: OrderGridContact[];
  salesChannelName?: string | null;
  paymentSourceName?: string | null;
  unitPriceVnd?: number | null;
  costPriceVnd?: number | null;
  salesNote?: string | null;
  contactSnapshot?: string | null;
  proofImageUrls?: string[] | null;

  // Computed fields from OrderModel.toJSON()
  profit: number;
  daysLeft: number | null;
  urgency: "expired" | "soon" | "ok" | "none";
  primaryContact: OrderGridContact | null;
  statusMeta: {
    label: string;
    tone: string;
    class: string;
    dotClass: string;
  };
  formattedAmount: string;
  formattedProfit: string;
  formattedExpiryDate: string;
  formattedCreatedDate: string;
};

interface OrdersGridProps {
  isLoading: boolean;
  mappedOrders: OrderGridRow[];
  selectedOrderIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onRowClick: (row: any) => void;
  onRowContextMenu: (e: React.MouseEvent, row: any) => void;
}

function getProductMono(productName: string): string {
  const name = productName.toLowerCase();
  if (name.includes("duolingo")) return "Du";
  if (name.includes("canva")) return "Ca";
  if (name.includes("youtube")) return "Yt";
  if (name.includes("netflix")) return "Nf";
  if (name.includes("spotify")) return "Sp";
  if (name.includes("chatgpt")) return "Gpt";
  if (name.includes("capcut")) return "Cc";
  if (name.includes("grammarly")) return "Gr";
  return productName.slice(0, 2).toUpperCase();
}

function getUrgencyAccentColor(urgency: string): string {
  if (urgency === "expired") return "border-t-[3px] border-t-red-500";
  if (urgency === "soon") return "border-t-[3px] border-t-amber-500";
  return "";
}

function getUrgencyBgColor(urgency: string): string {
  if (urgency === "expired") return "bg-red-50/50";
  if (urgency === "soon") return "bg-amber-50/50";
  return "bg-gray-50/50";
}

const OrderCard = React.memo(function OrderCard({
  order,
  isSelected,
  onToggleSelect,
  onRowClick,
  onRowContextMenu,
}: {
  order: OrderGridRow;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onRowClick: (row: any) => void;
  onRowContextMenu: (e: React.MouseEvent, row: any) => void;
}) {
  const mono = getProductMono(order.productName);
  const contact = order.primaryContact;
  const daysLeft = order.daysLeft;

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (order.orderCode) {
      navigator.clipboard.writeText(order.orderCode);
      // We will assume appToast is imported or managed by consumer
    }
  };

  const getExpiryDisplay = () => {
    if (!order.expiresAt) return { label: "Không hạn", cls: "text-gray-400" };
    if (daysLeft === null) return { label: "—", cls: "text-gray-400" };
    if (order.urgency === "expired" || daysLeft < 0) {
      return { label: "Đã hết hạn", cls: "text-red-600 font-bold" };
    }
    if (order.urgency === "soon" || daysLeft <= 7) {
      return { label: `Còn ${daysLeft} ngày`, cls: "text-amber-600 font-bold" };
    }
    return { label: `${daysLeft} ngày`, cls: "text-emerald-700 font-semibold" };
  };

  const expiry = getExpiryDisplay();

  return (
    <motion.div
      data-testid="order-card"
      data-order-id={order.id}
      data-order-code={order.orderCode || order.id}
      onClick={() => onRowClick(order)}
      onContextMenu={(e) => onRowContextMenu(e, order)}
      whileHover={{ y: -3, boxShadow: "0 10px 20px rgba(22, 60, 30, 0.08)" }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={cn(
        "group cursor-pointer overflow-hidden rounded-xl border border-gray-200/80 bg-white transition-all duration-200 flex flex-col justify-between select-none relative",
        getUrgencyAccentColor(order.urgency),
        isSelected ? "ring-2 ring-[var(--accent)] border-transparent" : "hover:border-gray-300"
      )}
    >
      <div className="p-4 flex-1">
        {/* Header: Product + Status */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Monogram squircle tile */}
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50/50 font-bold text-emerald-800 text-[13px]">
              {mono}
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-gray-800 text-[13.5px] leading-tight" title={order.productName}>
                {order.productName}
              </h3>
              <div className="flex items-center gap-1 mt-1">
                <span className="font-mono text-[10.5px] text-[var(--accent)]/90 font-medium">
                  #{order.orderCode || order.id.slice(0, 8).toUpperCase()}
                </span>
                {order.orderCode && (
                  <button
                    onClick={handleCopyCode}
                    className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Sao chép mã đơn"
                  >
                    <Copy className="size-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wider whitespace-nowrap",
            order.statusMeta.class
          )}>
            <span className={cn("size-1 rounded-full shrink-0", order.statusMeta.dotClass)} />
            {order.statusMeta.label}
          </span>
        </div>

        {/* Customer Information */}
        <div className="space-y-2 mt-4 text-[12px] text-gray-600">
          <div className="flex items-center gap-2">
            <User className="size-3.5 text-gray-400 shrink-0" />
            <span className="font-semibold text-gray-800 truncate" style={{ maxWidth: 140 }}>
              {order.customerName}
            </span>
            {contact && (
              <>
                <span className="text-gray-300">·</span>
                <span className="flex items-center gap-1 text-[11px] text-gray-500 truncate min-w-0">
                  {contact.channel === "phone" || contact.channel === "zalo" ? (
                    <Phone className="size-3 text-gray-400" />
                  ) : (
                    <Link2 className="size-3 text-gray-400" />
                  )}
                  <span className="truncate">{contact.value}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Expiry Alert Box */}
        <div className={cn(
          "mt-4 rounded-lg px-3 py-2 flex items-center justify-between border border-gray-100",
          getUrgencyBgColor(order.urgency)
        )}>
          <span className={cn("text-[12.5px] font-bold", expiry.cls)}>
            {expiry.label}
          </span>
          <span className="font-mono text-[11px] text-gray-400">
            {order.formattedExpiryDate}
          </span>
        </div>
      </div>

      {/* Footer: Price + Actions */}
      <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2.5 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-mono font-bold text-[14px] text-gray-800">
            {order.formattedAmount}
          </span>
          <span className={cn(
            "font-mono text-[11px] font-semibold mt-0.5",
            order.profit >= 0 ? "text-emerald-600" : "text-red-500"
          )}>
            Lãi: {order.formattedProfit}
          </span>
        </div>

        {/* Inline Actions */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            title="Sao chép liên hệ"
            onClick={handleCopyCode}
            className="flex size-7 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-500 hover:text-gray-700 transition-all"
          >
            <Copy className="size-3.5" />
          </button>
          <button
            title="Xem chi tiết"
            onClick={() => onRowClick(order)}
            className="flex size-7 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-500 hover:text-gray-700 transition-all"
          >
            <Eye className="size-3.5" />
          </button>
          <button
            title="Tùy chọn khác"
            onClick={(e) => onRowContextMenu(e, order)}
            className="flex size-7 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-500 hover:text-gray-700 transition-all"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
});

export const OrdersGrid = React.memo(function OrdersGrid({
  isLoading,
  mappedOrders,
  selectedOrderIds,
  onToggleSelect,
  onRowClick,
  onRowContextMenu,
}: OrdersGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm flex flex-col justify-between min-h-[180px]">
            <div className="p-4 flex-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="size-9 animate-pulse rounded-lg bg-gray-200" />
                  <div>
                    <div className="h-3.5 w-28 animate-pulse rounded bg-gray-200 mb-1.5" />
                    <div className="h-2.5 w-16 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
              </div>
              <div className="h-3.5 w-24 animate-pulse rounded bg-gray-200 my-4" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-gray-100" />
            </div>
            <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2.5 flex items-center justify-between">
              <div>
                <div className="h-3.5 w-20 animate-pulse rounded bg-gray-200 mb-1" />
                <div className="h-2.5 w-16 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="flex gap-1">
                <div className="size-7 animate-pulse rounded-lg bg-gray-200" />
                <div className="size-7 animate-pulse rounded-lg bg-gray-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (mappedOrders.length === 0) {
    return (
      <div data-testid="orders-empty-state" className="flex flex-col items-center justify-center py-16 text-center bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50/50">
          <Search className="size-5 text-[var(--accent)] opacity-60" />
        </div>
        <p className="text-[13.5px] font-semibold text-gray-800">Không tìm thấy đơn hàng</p>
        <p className="mt-0.5 text-[11.5px] text-gray-500">Thử thay đổi bộ lọc hoặc tạo đơn hàng mới.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="orders-grid">
      {mappedOrders.map((order) => {
        const isSelected = selectedOrderIds.has(order.id);
        return (
          <OrderCard
            key={order.id}
            order={order}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect}
            onRowClick={onRowClick}
            onRowContextMenu={onRowContextMenu}
          />
        );
      })}
    </div>
  );
});
