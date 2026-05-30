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
    <div className="page-stack space-y-3">
      <FiltersBar sticky className="px-4 py-2">
        <div className="grid gap-3 md:grid-cols-[1fr_200px_auto] items-center">
          <div className="relative min-w-0">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--fg-muted)]" />
            <Input
              aria-label="Tìm đơn hàng"
              className="h-9 pl-9 text-sm"
              placeholder="Tìm theo mã đơn, khách hàng, sản phẩm hoặc ghi chú…"
              autoComplete="off"
              name="search-orders"
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>

          <DatePickerPopover
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={onDateFromChange}
            onDateToChange={onDateToChange}
          />

          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="ghost"
              className="h-9 text-sm px-3"
              disabled={!hasFilters}
              onClick={() => {
                onSearchChange("");
                onStatusChange("");
                onDateFromChange("");
                onDateToChange("");
              }}
            >
              <X className="size-4 mr-1" />
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
            className={`rounded-full px-4 py-1.5 text-[12px] font-bold transition-all duration-150 border ${
              statusFilter === chip.value
                ? "border-slate-800 bg-white text-slate-800 ring-1 ring-slate-800 shadow-sm"
                : "border-transparent bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
});

interface DatePickerPopoverProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}

function formatDateCompact(dateStr: string) {
  try {
    const [y, m, d] = dateStr.split("-");
    if (!y || !m || !d) return dateStr;
    return `${d}/${m}`;
  } catch {
    return dateStr;
  }
}

const DatePickerPopover = React.memo(function DatePickerPopover({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: DatePickerPopoverProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={popoverRef}>
      <Button
        type="button"
        variant="secondary"
        className="h-9 w-full justify-start text-left font-normal text-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Calendar className="mr-2 h-4 w-4 text-[var(--fg-muted)] shrink-0" />
        {dateFrom || dateTo ? (
          <span className="truncate font-bold text-[var(--fg-base)]">
            {dateFrom ? formatDateCompact(dateFrom) : "..."} - {dateTo ? formatDateCompact(dateTo) : "..."}
          </span>
        ) : (
          <span className="text-[var(--fg-muted)] font-medium">Thời gian</span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-2xl border border-[var(--border-soft)] bg-white p-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">Từ ngày</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">Đến ngày</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2.5 border-t border-[var(--border-soft)]">
              <Button
                type="button"
                variant="ghost"
                className="h-8 text-xs font-bold"
                onClick={() => {
                  onDateFromChange("");
                  onDateToChange("");
                  setIsOpen(false);
                }}
              >
                Xóa
              </Button>
              <Button
                type="button"
                variant="primary"
                className="h-8 text-xs font-bold bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
                onClick={() => setIsOpen(false)}
              >
                Xong
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
