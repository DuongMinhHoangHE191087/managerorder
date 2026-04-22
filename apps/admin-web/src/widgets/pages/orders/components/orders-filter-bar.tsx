"use client";

import React from "react";
import { Search, Calendar } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
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
  return (
    <div className="page-stack">
      <FiltersBar sticky className="px-4 py-4">
        <div className="flex w-full flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
            <Input
              className="pl-9"
              placeholder="Tìm theo mã đơn, khách hàng, sản phẩm..."
              autoComplete="off"
              name="search-orders"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          <Select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="min-w-[180px]"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>

          <div className="flex items-center gap-2">
            <Calendar className="size-4 shrink-0 text-[var(--fg-muted)]" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="w-auto min-w-[150px]"
              title="Từ ngày"
            />
            <span className="text-[12px] font-medium text-[var(--fg-muted)]">-</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="w-auto min-w-[150px]"
              title="Đến ngày"
            />
            {(dateFrom || dateTo) ? (
              <button
                type="button"
                onClick={() => { onDateFromChange(""); onDateToChange(""); }}
                className="rounded-[0.9rem] px-2.5 py-1.5 text-[12px] font-bold text-[var(--fg-muted)] transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
              >
                x
              </button>
            ) : null}
          </div>
        </div>
      </FiltersBar>

      <div className="flex flex-wrap gap-2 px-1">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => onStatusChange(chip.value)}
            className={`rounded-full border px-3.5 py-1.5 text-[12px] font-bold tracking-wide transition-all duration-200 ${
              statusFilter === chip.value
                ? `${chip.color} border-current shadow-sm scale-105`
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
