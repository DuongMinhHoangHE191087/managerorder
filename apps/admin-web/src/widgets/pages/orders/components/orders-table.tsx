"use client";



import React from "react";

import { Box, CheckCircle2, ChevronLeft, ChevronRight, Clock, Search, Store, Wallet } from "lucide-react";



import { cn, formatDateShort, formatMoney } from "@/lib/utils";



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

};



export const getStatusStyle = (status: string) => {

  switch (status) {

    case "paid":

      return "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20";

    case "active":

      return "bg-emerald-100 text-emerald-600 border-emerald-500/20";

    case "pending_payment":

      return "bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20";

    case "provisioning":

      return "bg-blue-100 text-blue-600 border-blue-500/20";

    case "draft":

      return "bg-[var(--fg-muted)]/10 text-[var(--fg-muted)] border-[var(--border-soft)]";

    case "expired":

      return "bg-red-100 text-red-500 border-red-500/20";

    case "refunded":

      return "bg-purple-100 text-purple-600 border-purple-500/20";

    default:

      return "bg-[var(--fg-muted)]/10 text-[var(--fg-muted)] border-[var(--border-soft)]";

  }

};



export const getDotStyle = (status: string) => {

  switch (status) {

    case "paid":

      return "bg-[var(--accent)]";

    case "active":

      return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";

    case "pending_payment":

      return "bg-[var(--warning)] shadow-[0_0_8px_rgba(245,158,11,0.5)]";

    case "provisioning":

      return "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]";

    case "expired":

      return "bg-red-500";

    case "refunded":

      return "bg-purple-500";

    case "draft":

      return "bg-[var(--fg-muted)]";

    default:

      return "bg-[var(--fg-muted)]";

  }

};



export const getStatusLabel = (status: string) => {

  switch (status) {

    case "draft":

      return "Nháp";

    case "pending_payment":

      return "Chờ thanh toán";

    case "paid":

      return "Đã thanh toán";

    case "provisioning":

      return "Đang cấp phát";

    case "active":

      return "Hoạt động";

    case "expired":

      return "Hết hạn";

    case "refunded":

      return "Hoàn tiền";

    default:

      return status.toUpperCase();

  }

};



const TIMELINE_STEPS = ["draft", "pending_payment", "provisioning", "active"];



export const getExpiryBadge = (expiresAt: string) => {

  if (!expiresAt) return null;

  const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86400000);

  if (diff < 0) return { label: "Đã hết hạn", class: "bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/20" };

  if (diff <= 7) return { label: `Còn ${diff} ngày`, class: "bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20" };

  return { label: formatDateShort(expiresAt), class: "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20" };

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



const PAGE_SIZE_OPTIONS = [20, 50, 100];



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

  const paid = order.total_paid || 0;

  const total = order.total_amount_vnd || 0;

  const paymentPct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;

  const isFullyPaid = paymentPct >= 100;

  const profit = total - (order.total_cost_vnd || 0);



  let currentStepIdx = TIMELINE_STEPS.indexOf(order.status);

  if (currentStepIdx === -1) {

    if (order.status === "paid") currentStepIdx = 2;

    else if (order.status === "refunded" || order.status === "expired") currentStepIdx = TIMELINE_STEPS.length;

    else currentStepIdx = 0;

  }



  const expiryBadge = getExpiryBadge(order.expires_at);



  return (

    <article

      data-testid="order-row"

      data-order-id={order.id}

      data-order-code={order.order_code || order.id}

      onClick={() => onRowClick(order)}

      onContextMenu={(e) => onRowContextMenu(e, order)}

      className={cn(

        "group relative flex cursor-pointer flex-col gap-5 rounded-[1.5rem] border bg-[rgba(255,255,255,0.96)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)] md:flex-row md:p-5",

        isSelected

          ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-[0_4px_20px_rgba(var(--accent-rgb),0.08)]"

          : "border-[var(--border-soft)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface-light)]/40",

      )}

    >

      <div className="flex items-start gap-4">

        <button

          type="button"

          onClick={(e) => {

            e.stopPropagation();

            onToggleSelect(order.id);

          }}

          className={cn(

            "flex h-5 w-5 items-center justify-center rounded-md border-2 transition-[background-color,border-color,color]",

            isSelected ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border-soft)] bg-white group-hover:border-[var(--accent)]/50",

          )}

        >

          <CheckCircle2 className={cn("size-3.5 text-white transition-opacity", isSelected ? "opacity-100" : "opacity-0")} />

        </button>



        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-white text-[var(--fg-muted)] shadow-sm transition-transform group-hover:scale-105">

          <Box className="size-5 transition-colors group-hover:text-[var(--accent)]" />

        </div>

      </div>



      <div className="min-w-0 flex-1">

        <div className="mb-1.5 flex flex-wrap items-center gap-2">

          <span data-testid="order-code" className="rounded border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-2 py-0.5 font-mono text-[13px] font-bold text-[var(--accent)]">

            #{order.order_code || order.id.slice(0, 8)}

          </span>

          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", getStatusStyle(order.status))}>

            <span className={cn("size-1.5 rounded-full", getDotStyle(order.status))} />

            {getStatusLabel(order.status)}

          </span>

          {expiryBadge ? (

            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", expiryBadge.class)}>

              <Clock className="size-3" />

              {expiryBadge.label}

            </span>

          ) : null}

        </div>



        <h3 className="mt-1 text-[15px] font-black text-[var(--fg-base)] transition-colors group-hover:text-[var(--accent)]">

          {order.customerName}

        </h3>



        <div className="mt-1 flex items-center gap-2 text-[13px] text-[var(--fg-muted)]">

          <span className="truncate">{order.customerEmail || order.customer_id}</span>

          <span className="h-1 w-1 rounded-full bg-gray-300" />

          <span className="max-w-[240px] truncate rounded-md border border-[var(--border-soft)] bg-[var(--surface-light)] px-2 py-0.5 font-medium text-[var(--fg-base)]">

            {order.productName}

          </span>

        </div>



        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-[var(--fg-muted)]">

          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-white/80 px-2 py-0.5">

            <Store className="size-3 text-[var(--accent)]" />

            {order.salesChannelName || "Chưa gán kênh bán"}

          </span>

          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-white/80 px-2 py-0.5">

            <Wallet className="size-3 text-emerald-500" />

            {order.paymentSourceName || "Chưa gán nguồn tiền"}

          </span>

        </div>

      </div>



      <div className="w-full rounded-[1.15rem] border border-[var(--border-soft)] bg-[rgba(246,250,244,0.72)] p-3.5 transition-colors group-hover:border-[var(--accent)]/20 group-hover:bg-white md:w-[240px]">

        <div className="space-y-1.5">

          <div className="mb-1 flex items-end justify-between">

            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Tiến trình</span>

            <span className={cn("text-[11px] font-bold", currentStepIdx >= TIMELINE_STEPS.length - 1 ? "text-emerald-500" : "text-[var(--accent)]")}>

              {Math.round(((currentStepIdx + 1) / TIMELINE_STEPS.length) * 100)}%

            </span>

          </div>

          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">

            <div

              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-emerald-500 transition-[width] duration-700 ease-out"

              style={{ width: `${Math.max(5, ((currentStepIdx + 1) / TIMELINE_STEPS.length) * 100)}%` }}

            />

          </div>

        </div>



        <div className="mt-3 space-y-1.5 border-t border-[var(--border-soft)] pt-3">

          <div className="flex items-end justify-between">

            <div className="flex flex-col">

              <span className="text-[13px] font-bold text-[var(--fg-base)]">{formatMoney(total)}</span>

            </div>

            <div className="text-right">

              <span className="block text-[10px] font-medium text-[var(--fg-muted)]">Lãi/Lỗ</span>

              <span className={cn("text-[13px] font-bold", profit >= 0 ? "text-emerald-600" : "text-red-600")}>

                {profit > 0 ? "+" : ""}

                {formatMoney(profit)}

              </span>

            </div>

          </div>



          {total > 0 ? (

            <div className="mt-0.5 flex items-center gap-2">

              <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-[var(--border-soft)]">

                <div

                  className={cn("absolute left-0 top-0 h-full rounded-full transition-[background-color,width] duration-500", isFullyPaid ? "bg-emerald-500" : "bg-[var(--warning)]")}

                  style={{ width: `${paymentPct}%` }}

                />

              </div>

              {total > paid ? (

                <span className="whitespace-nowrap text-[10px] font-bold text-[var(--danger)]">

                  Còng nợ {formatMoney(order.balance_due_vnd ?? total - paid)}

                </span>

              ) : (

                <span className="whitespace-nowrap text-[10px] font-bold text-emerald-500">Đủ TT</span>

              )}

            </div>

          ) : null}

        </div>

      </div>



      <div className="absolute right-3 top-1/2 hidden size-8 -translate-y-1/2 translate-x-2 items-center justify-center rounded-full border border-[var(--border-soft)] bg-white text-[var(--accent)] opacity-0 shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition-[background-color,border-color,box-shadow,color,opacity,transform] group-hover:translate-x-0 group-hover:opacity-100 hover:bg-[var(--accent)] hover:text-white md:flex">

        <ChevronRight className="size-4" />

      </div>

    </article>

  );

});



export const OrdersTable = React.memo(function OrdersTable({

  isLoading,

  pageCount,

  pageIndex,

  pageSize,

  totalElements,

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



  const renderPageButtons = () => {

    const buttons: React.ReactNode[] = [];

    const maxVisible = 5;

    let start = Math.max(0, pageIndex - Math.floor(maxVisible / 2));

    const end = Math.min(pageCount - 1, start + maxVisible - 1);

    if (end - start < maxVisible - 1) start = Math.max(0, end - maxVisible + 1);



    for (let i = start; i <= end; i++) {

      buttons.push(

        <button

          key={i}

          type="button"

          onClick={() => onPaginationChange(i, pageSize)}

          className={cn(

            "h-8 w-8 rounded-lg border text-[13px] font-bold transition-[background-color,border-color,box-shadow,color]",

            i === pageIndex

              ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-sm"

              : "border-[var(--border-soft)] bg-white text-[var(--fg-base)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5",

          )}

        >

          {i + 1}

        </button>,

      );

    }



    return buttons;

  };



  return (

    <section data-testid="orders-list" className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-[box-shadow] hover:shadow-[0_22px_52px_rgba(15,23,42,0.08)]">

      <div className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-4">

        <label className="flex items-center gap-3 rounded-[0.9rem] border border-[var(--border-soft)] bg-white/80 px-3 py-2 shadow-sm">

          <input

            data-testid="orders-select-all"

            type="checkbox"

            className="size-4 rounded border-[var(--border-soft)] text-[var(--accent)] accent-[var(--accent)]"

            checked={allSelected}

            onChange={toggleAll}

          />

          <span className="text-[13px] font-bold text-[var(--fg-base)]">Chọn tất cả</span>

        </label>



        <div className="min-w-0">

          <h3 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">Đơn hàng</h3>

          <p className="text-[12px] text-[var(--fg-muted)]">Quản lý đơn, thanh toán, cấp phát và trạng thái trong một dòng.</p>

        </div>



        <span className="whitespace-nowrap text-[12px] font-medium text-[var(--fg-muted)]">

          Tổng cộng <strong className="text-[var(--accent)]">{totalElements}</strong> đơn

        </span>

      </div>



      <div className="p-4 sm:p-5">

        {isLoading ? (

          <div className="space-y-3">

            {Array.from({ length: 5 }).map((_, index) => (

              <div

                key={index}

                className="animate-pulse rounded-[1.5rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.82)] p-5"

              >

                <div className="flex flex-col gap-4 md:flex-row">

                  <div className="h-12 w-12 rounded-xl bg-[var(--border-soft)]" />

                  <div className="flex-1 space-y-3">

                    <div className="h-4 w-1/3 rounded bg-[var(--border-soft)]" />

                    <div className="h-3 w-1/2 rounded bg-[var(--border-soft)]" />

                    <div className="h-3 w-1/4 rounded bg-[var(--border-soft)]" />

                  </div>

                  <div className="h-24 w-full rounded-[1rem] bg-[var(--border-soft)] md:w-56" />

                </div>

              </div>

            ))}

          </div>

        ) : mappedOrders.length === 0 ? (

          <div data-testid="orders-empty-state" className="flex flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--border-soft)] bg-[rgba(255,255,255,0.84)] py-20 text-center shadow-sm">

            <div className="mb-4 flex size-20 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)]">

              <Search className="size-8 text-[var(--fg-muted)] opacity-50" />

            </div>

            <h3 className="text-lg font-bold text-[var(--fg-base)]">Không tìm thấy đơn hàng</h3>

            <p className="mt-1 text-[14px] text-[var(--fg-muted)]">Thử thay đổi bộ lọc hoặc tạo đơn hàng mới.</p>

          </div>

        ) : (

          <div className="space-y-3">

            {mappedOrders.map((order) => {

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



            })}

          </div>

        )}

      </div>



      {totalElements > 0 || isLoading ? (

        <div data-testid="orders-pagination" className="flex items-center justify-between gap-4 border-t border-[var(--border-soft)] bg-[rgba(255,255,255,0.88)] px-6 py-3.5">

          <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:pb-0">

            <span className="whitespace-nowrap text-[12px] font-bold uppercase tracking-wide text-[var(--fg-muted)]">Mỗi trang:</span>

            <div className="flex rounded-lg border border-[var(--border-soft)] bg-[var(--surface-light)] p-1">

              {PAGE_SIZE_OPTIONS.map((size) => (

                <button

                  key={size}

                  type="button"

                  onClick={() => {

                    onPaginationChange(0, size);

                  }}

                  className={cn(

                    "rounded-md px-3 py-1.5 text-[12px] font-bold transition-[background-color,box-shadow,color]",

                    pageSize === size ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--fg-muted)] hover:bg-black/5 hover:text-[var(--fg-base)]",

                  )}

                >

                  {size}

                </button>

              ))}

            </div>

            <span data-testid="orders-pagination-info" className="hidden whitespace-nowrap border-l border-[var(--border-soft)] pl-3 text-[12px] font-medium text-[var(--fg-muted)] lg:inline">

              Kết quả: <strong className="text-[var(--fg-base)]">{(pageIndex * pageSize) + 1}-{Math.min((pageIndex + 1) * pageSize, totalElements)}</strong> / {totalElements}

            </span>

          </div>



          {pageCount > 1 ? (

            <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[rgba(246,250,244,0.8)] p-1">

              <button

                type="button"

                data-testid="orders-prev-page"

                onClick={() => onPaginationChange(Math.max(0, pageIndex - 1), pageSize)}

                disabled={pageIndex === 0 || isLoading}

                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-[background-color,color,opacity] hover:bg-white hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30"

              >

                <ChevronLeft className="size-4" />

              </button>

              {renderPageButtons()}

              <button

                type="button"

                data-testid="orders-next-page"

                onClick={() => onPaginationChange(Math.min(pageCount - 1, pageIndex + 1), pageSize)}

                disabled={pageIndex >= pageCount - 1 || isLoading}

                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-[background-color,color,opacity] hover:bg-white hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30"

              >

                <ChevronRight className="size-4" />

              </button>

            </div>

          ) : null}

        </div>

      ) : null}

    </section>

  );

});
