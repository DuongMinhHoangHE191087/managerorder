"use client";

import React from "react";
import { Search } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { OrderModel } from "@/entities/order";

export type OrderContact = {
  id?: string;
  channel: string;
  value: string;
  is_verified: boolean;
};

export type OrderRow = {
  id: string;
  order_code?: string | null;
  customer_id: string;
  product_id: string;
  quantity: number;
  total_amount_vnd: number;
  total_paid?: number;
  total_cost_vnd?: number;
  payment_method: string | null;
  payment_terms?: string | null;
  payment_state?: string | null;
  balance_due_vnd?: number;
  is_fully_paid?: boolean;
  payment_source_id: string | null;
  sales_channel_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  customerName: string;
  productName: string;
  customerEmail: string;
  customerContacts: OrderContact[];
  salesChannelName?: string | null;
  paymentSourceName?: string | null;
  unit_price_vnd?: number | null;
  cost_price_vnd?: number | null;
  sales_note?: string | null;
  contact_snapshot?: string | null;
  proof_image_urls?: string[] | null;
  customerAvatarUrl?: string | null;
  productIconUrl?: string | null;
};

interface OrdersTableProps {
  isLoading: boolean;
  pageCount: number;
  pageIndex: number;
  pageSize: number;
  totalElements: number;
  onPaginationChange: (pageIndex: number, pageSize: number) => void;
  mappedOrders: OrderRow[];
  selectedOrderIds: Set<string>;
  onToggleSelect: (id: string) => void;
  setSelectedOrderIds: (val: Set<string>) => void;
  onRowClick: (row: OrderRow) => void;
  onRowContextMenu: (e: React.MouseEvent, row: OrderRow) => void;
}

type OrderTableRowProps = {
  order: OrderRow;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onRowClick: (row: OrderRow) => void;
  onRowContextMenu: (e: React.MouseEvent, row: OrderRow) => void;
};

const OrderTableRow = React.memo(function OrderTableRow({
  order,
  isSelected,
  onToggleSelect,
  onRowClick,
  onRowContextMenu,
}: OrderTableRowProps) {
  // Sử dụng OOP Model
  const model = new OrderModel({
    id: order.id,
    order_code: order.order_code,
    customer_id: order.customer_id,
    product_id: order.product_id,
    quantity: order.quantity,
    total_amount_vnd: order.total_amount_vnd,
    total_paid: order.total_paid,
    total_cost_vnd: order.total_cost_vnd,
    payment_method: order.payment_method,
    payment_terms: order.payment_terms,
    payment_state: order.payment_state,
    balance_due_vnd: order.balance_due_vnd,
    is_fully_paid: order.is_fully_paid,
    payment_source_id: order.payment_source_id,
    sales_channel_id: order.sales_channel_id,
    status: order.status,
    created_at: order.created_at,
    updated_at: order.updated_at,
    expires_at: order.expires_at,
    customerName: order.customerName,
    productName: order.productName,
    customerEmail: order.customerEmail,
    customerContacts: order.customerContacts,
    salesChannelName: order.salesChannelName,
    paymentSourceName: order.paymentSourceName,
    unit_price_vnd: order.unit_price_vnd,
    cost_price_vnd: order.cost_price_vnd,
    sales_note: order.sales_note,
    contact_snapshot: order.contact_snapshot,
    proof_image_urls: order.proof_image_urls,
    customerAvatarUrl: order.customerAvatarUrl,
    productIconUrl: order.productIconUrl,
  });

  const profit = model.getProfit();
  const daysLeft = model.getDaysLeft();
  const primaryContact = model.getPrimaryContact();
  const statusMeta = model.getStatusMeta();
  const urgency = model.getUrgencyState();

  const getExpiryDisplay = () => {
    if (!model.expiresAt) return { label: "Không hạn", cls: "text-gray-400", sub: "" };
    if (daysLeft === null) return { label: "—", cls: "text-gray-400", sub: "" };
    if (urgency === "expired" || daysLeft < 0) {
      return {
        label: "Hết hạn",
        cls: "text-red-500 font-bold",
        sub: model.getFormattedExpiryDate()
      };
    }
    if (urgency === "soon" || daysLeft <= 7) {
      return {
        label: `${daysLeft} ngày`,
        cls: "text-amber-600 font-bold",
        sub: model.getFormattedExpiryDate()
      };
    }
    return {
      label: `${daysLeft} ngày`,
      cls: "text-gray-700 font-medium",
      sub: model.getFormattedExpiryDate(),
    };
  };

  const expiry = getExpiryDisplay();

  const getUrgencyLeftBorder = () => {
    if (urgency === "expired") return "border-l-3 border-l-red-500";
    if (urgency === "soon") return "border-l-3 border-l-amber-500";
    return "";
  };

  return (
    <tr
      data-testid="order-row"
      data-order-id={order.id}
      data-order-code={order.order_code || order.id}
      onClick={() => onRowClick(order)}
      onContextMenu={(e) => onRowContextMenu(e, order)}
      className={cn(
        "group cursor-pointer border-b border-gray-150 text-[12px] transition-colors duration-150",
        isSelected ? "bg-emerald-500/[0.04]" : "hover:bg-[#f3f7f2]/50",
        getUrgencyLeftBorder()
      )}
    >
      {/* Checkbox */}
      <td className="w-10 pl-4 pr-2 py-2.5" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label="Chọn đơn hàng"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(order.id); }}
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded border transition-colors duration-150",
            isSelected
              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
              : "border-gray-300 bg-white hover:border-[var(--accent)]/50",
          )}
        >
          {isSelected && (
            <svg className="size-2.5" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </td>

      {/* Product + Order code */}
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-2.5">
          {model.productIconUrl ? (
            <img
              src={model.productIconUrl}
              alt={model.productName}
              className="size-7 shrink-0 rounded-lg object-cover border border-gray-250 shadow-sm"
            />
          ) : (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50/50">
              <svg className="size-3.5 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-800 leading-tight" style={{ maxWidth: 160 }}>{model.productName}</p>
            <p className="font-mono text-[10px] text-[var(--accent)] opacity-75">#{model.orderCode || model.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
      </td>

      {/* Customer */}
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-2">
          {model.customerAvatarUrl ? (
            <img
              src={model.customerAvatarUrl}
              alt={model.customerName}
              className="size-6 shrink-0 rounded-full object-cover border border-gray-250 shadow-sm"
            />
          ) : (
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-purple-50 text-[10px] font-bold text-purple-700 border border-purple-100 uppercase">
              {model.customerName.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 leading-tight truncate" style={{ maxWidth: 120 }} title={model.customerName}>{model.customerName}</p>
            <p className="text-[10px] text-gray-400 truncate" style={{ maxWidth: 120 }}>
              {primaryContact?.value || model.customerEmail || "—"}
            </p>
          </div>
        </div>
      </td>

      {/* Nguồn & Kênh */}
      <td className="py-2.5 pr-3">
        <p className="font-semibold text-gray-800 leading-tight truncate" style={{ maxWidth: 130 }} title={order.paymentSourceName || "—"}>
          {order.paymentSourceName || "—"}
        </p>
        <p className="text-[10px] text-gray-400 truncate" style={{ maxWidth: 130 }} title={order.salesChannelName || "—"}>
          {order.salesChannelName || "—"}
        </p>
      </td>

      {/* Status */}
      <td className="py-2.5 pr-3">
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide whitespace-nowrap",
          statusMeta.class
        )}>
          <span className={cn("size-1 rounded-full shrink-0", statusMeta.dotClass)} />
          {statusMeta.label}
        </span>
      </td>

      {/* Expiry */}
      <td className="py-2.5 pr-3">
        <p className={cn("text-[11px] leading-tight", expiry.cls)}>{expiry.label}</p>
        {expiry.sub && <p className="text-[9.5px] text-gray-400 mt-px">{expiry.sub}</p>}
      </td>

      {/* Amount */}
      <td className="py-2.5 pr-3 text-right">
        <p className="font-bold text-gray-800 font-mono">{model.getFormattedAmount()}</p>
        {model.totalPaid > 0 && model.totalPaid < model.totalAmountVnd && (
          <p className="text-[9px] text-amber-600 font-mono">còn {formatMoney(model.totalAmountVnd - model.totalPaid)}</p>
        )}
        {model.isFullyPaid && (
          <p className="text-[9px] text-emerald-600 font-semibold">Đủ TT ✓</p>
        )}
      </td>

      {/* Profit */}
      <td className="py-2.5 pr-4 text-right">
        <p className={cn("font-bold font-mono", profit >= 0 ? "text-emerald-600" : "text-red-500")}>
          {model.getFormattedProfit()}
        </p>
      </td>

      {/* Liên hệ & Ghi chú */}
      <td className="py-2.5 pr-4">
        <p className="font-medium text-gray-800 truncate" style={{ maxWidth: 140 }} title={primaryContact?.value || order.customerEmail || "—"}>
          {primaryContact?.value || order.customerEmail || "—"}
        </p>
        {order.sales_note && (
          <p className="text-[10px] text-amber-600 truncate font-semibold" style={{ maxWidth: 140 }} title={order.sales_note}>
            📝 {order.sales_note}
          </p>
        )}
      </td>
    </tr>
  );
});

export const OrdersTable = React.memo(function OrdersTable({
  isLoading,
  pageCount,
  pageIndex,
  pageSize,
  totalElements: _totalElements,
  onPaginationChange,
  mappedOrders,
  selectedOrderIds,
  onToggleSelect,
  setSelectedOrderIds,
  onRowClick,
  onRowContextMenu,
}: OrdersTableProps) {
  const allSelected = mappedOrders.length > 0 && selectedOrderIds.size === mappedOrders.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(mappedOrders.map((order) => order.id)));
    }
  };

  return (
    <section data-testid="orders-list" className="overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-[0_2px_8px_rgba(22,60,30,0.06)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse">
          <colgroup>
            <col style={{ width: 40 }} />
            <col />
            <col style={{ width: 130 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 160 }} />
          </colgroup>

          {/* Column headers */}
          <thead>
            <tr className="border-b border-gray-200 bg-[#f3f7f2]/80">
              <th className="pl-4 pr-2 py-2.5">
                <button
                  type="button"
                  data-testid="orders-select-all"
                  aria-label="Chọn tất cả"
                  onClick={toggleAll}
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border transition-colors duration-150",
                    allSelected
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-gray-300 bg-white hover:border-[var(--accent)]/50"
                  )}
                >
                  {allSelected && (
                    <svg className="size-2.5" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </th>
              <th className="py-2.5 pr-3 text-left text-[9px] font-bold uppercase tracking-widest text-gray-500">Sản phẩm / Mã đơn</th>
              <th className="py-2.5 pr-3 text-left text-[9px] font-bold uppercase tracking-widest text-gray-500">Khách hàng</th>
              <th className="py-2.5 pr-3 text-left text-[9px] font-bold uppercase tracking-widest text-gray-500">Nguồn & Kênh</th>
              <th className="py-2.5 pr-3 text-left text-[9px] font-bold uppercase tracking-widest text-gray-500">Trạng thái</th>
              <th className="py-2.5 pr-3 text-left text-[9px] font-bold uppercase tracking-widest text-gray-500">Hạn dùng</th>
              <th className="py-2.5 pr-3 text-right text-[9px] font-bold uppercase tracking-widest text-gray-500">Giá trị</th>
              <th className="py-2.5 pr-4 text-right text-[9px] font-bold uppercase tracking-widest text-gray-500">Lãi/Lỗ</th>
              <th className="py-2.5 pr-4 text-left text-[9px] font-bold uppercase tracking-widest text-gray-500">Liên hệ & Ghi chú</th>
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <tr key={index} className="border-b border-gray-150">
                  <td className="pl-4 pr-2 py-3"><div className="h-4 w-4 animate-pulse rounded bg-gray-200" /></td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-200" />
                      <div>
                        <div className="h-3 w-28 animate-pulse rounded bg-gray-200 mb-1.5" />
                        <div className="h-2.5 w-16 animate-pulse rounded bg-gray-200" />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <div className="h-3 w-20 animate-pulse rounded bg-gray-200 mb-1.5" />
                    <div className="h-2.5 w-16 animate-pulse rounded bg-gray-200" />
                  </td>
                  <td className="py-3 pr-3">
                    <div className="h-3 w-24 animate-pulse rounded bg-gray-200 mb-1.5" />
                    <div className="h-2.5 w-16 animate-pulse rounded bg-gray-200" />
                  </td>
                  <td className="py-3 pr-3"><div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" /></td>
                  <td className="py-3 pr-3"><div className="h-3 w-12 animate-pulse rounded bg-gray-200" /></td>
                  <td className="py-3 pr-3 text-right"><div className="ml-auto h-3 w-16 animate-pulse rounded bg-gray-200 font-mono" /></td>
                  <td className="py-3 pr-4 text-right"><div className="ml-auto h-3 w-12 animate-pulse rounded bg-gray-200 font-mono" /></td>
                  <td className="py-3 pr-4">
                    <div className="h-3 w-28 animate-pulse rounded bg-gray-200 mb-1.5" />
                    <div className="h-2.5 w-20 animate-pulse rounded bg-gray-200" />
                  </td>
                </tr>
              ))
            ) : mappedOrders.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div data-testid="orders-empty-state" className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-3 flex size-12 items-center justify-center rounded-full border border-gray-255 bg-[#f3f7f2]">
                      <Search className="size-5 text-gray-400 opacity-60" />
                    </div>
                    <p className="text-[13px] font-semibold text-gray-800">Không tìm thấy đơn hàng</p>
                    <p className="mt-0.5 text-[11px] text-gray-500">Thử thay đổi bộ lọc hoặc tạo đơn hàng mới.</p>
                  </div>
                </td>
              </tr>
            ) : (
              mappedOrders.map((order) => {
                const isSelected = selectedOrderIds.has(order.id);
                return (
                  <OrderTableRow
                    key={order.id}
                    order={order}
                    isSelected={isSelected}
                    onToggleSelect={onToggleSelect}
                    onRowClick={onRowClick}
                    onRowContextMenu={onRowContextMenu}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </section>
  );
});
