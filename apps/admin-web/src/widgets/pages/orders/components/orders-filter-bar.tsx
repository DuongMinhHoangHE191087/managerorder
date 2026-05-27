"use client";

import React from "react";
import { Calendar, Search, X } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { FiltersBar } from "@/shared/ui/page-layout";

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "paid", label: "Đã thanh toán" },
  { value: "pending_payment", label: "Chờ thanh toán" },
  { value: "draft", label: "Bản nháp" },
  { value: "provisioning", label: "Đang cấp phát" },
  { value: "active", label: "Đang hoạt động" },
  { value: "expired", label: "Đã hết hạn" },
  { value: "refunded", label: "Hoàn tiền" },
] as const;

const STATUS_CHIPS = [
  { value: "", label: "Tất cả", color: "bg-gray-100 text-[var(--fg-base)]" },
  { value: "pending_payment", label: "Chờ TT", color: "bg-amber-50 text-amber-700" },
  { value: "paid", label: "Đã TT", color: "bg-emerald-50 text-emerald-700" },
  { value: "provisioning", label: "Cấp phát", color: "bg-sky-50 text-sky-700" },
  { value: "active", label: "Active", color: "bg-blue-50 text-blue-700" },
  { value: "expired", label: "Hết hạn", color: "bg-red-50 text-red-700" },
  { value: "refunded", label: "Hoàn tiền", color: "bg-fuchsia-50 text-fuchsia-700" },
  { value: "draft", label: "Nháp", color: "bg-slate-50 text-slate-600" },
] as const;

interface OrdersFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
}

export const OrdersFilterBar = React.memo(function OrdersFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: OrdersFilterBarProps) {
  const hasFilters = Boolean(searchQuery || statusFilter || dateFrom || dateTo);

  return (
    <div className="page-stack">
      <FiltersBar sticky className="px-4 py-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)_auto]">
          <div className="relative min-w-0">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
            <Input
              aria-label="Tìm đơn hàng"
              className="h-11 pl-9"
              placeholder="Tìm theo mã đơn, khách hàng, sản phẩm hoặc ghi chú…"
              autoComplete="off"
              name="search-orders"
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(180px,0.7fr)_minmax(0,1fr)]">
            <Select
              aria-label="Lọc theo trạng thái đơn hàng"
              name="order-status-filter"
              value={statusFilter}
              onChange={(event) => onStatusChange(event.target.value)}
              className="h-11 min-w-[180px]"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
              <div className="relative">
                <Calendar aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
                <Input
                  aria-label="Từ ngày tạo đơn"
                  name="orders-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => onDateFromChange(event.target.value)}
                  className="h-11 pl-9"
                  title="Từ ngày"
                />
              </div>
              <div className="hidden items-center justify-center text-[12px] font-medium text-[var(--fg-muted)] sm:flex">
                đến
              </div>
              <div className="relative">
                <Calendar aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
                <Input
                  aria-label="Đến ngày tạo đơn"
                  name="orders-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(event) => onDateToChange(event.target.value)}
                  className="h-11 pl-9"
                  title="Đến ngày"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              disabled={!hasFilters}
              onClick={() => {
                onSearchChange("");
                onStatusChange("");
                onDateFromChange("");
                onDateToChange("");
              }}
            >
              <X className="size-4" />
              Xóa lọc
            </Button>
          </div>
        </div>
      </FiltersBar>

      <div className="flex flex-wrap gap-2 px-1">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            aria-pressed={statusFilter === chip.value}
            onClick={() => onStatusChange(chip.value)}
            className={`rounded-full border px-3.5 py-1.5 text-[12px] font-bold tracking-wide transition-[background-color,border-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 ${
              statusFilter === chip.value
                ? `${chip.color} border-current shadow-sm`
                : "border-transparent bg-[rgba(255,255,255,0.82)] text-[var(--fg-muted)] hover:bg-white"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
});
