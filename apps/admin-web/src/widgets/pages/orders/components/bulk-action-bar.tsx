"use client";

import { Trash2 } from "lucide-react";

interface BulkActionBarProps {
  selectedCount: number;
  bulkSelectValue: string;
  onBulkSelectChange: (value: string) => void;
  onApplyStatus: () => void;
  onBatchDelete: () => void;
  onClear: () => void;
}

export function BulkActionBar({
  selectedCount,
  bulkSelectValue,
  onBulkSelectChange,
  onApplyStatus,
  onBatchDelete,
  onClear,
}: BulkActionBarProps) {
  return (
    <div
      role="region"
      aria-label="Thao tác hàng loạt đơn hàng"
      aria-live="polite"
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transform transition-[opacity,transform] duration-300 ${
        selectedCount > 0
          ? "translate-y-0 opacity-100"
          : "translate-y-20 opacity-0 pointer-events-none"
      }`}
    >
      <div className="bg-white/90 backdrop-blur-xl border border-[var(--border-soft)] shadow-2xl rounded-2xl flex items-center px-6 py-4 gap-6">
        <div className="flex items-center gap-3">
          <span className="bg-[var(--accent)] text-white px-3 py-1 font-black text-[13px] rounded-lg shadow-sm">
            {selectedCount}
          </span>
          <span className="text-[14px] font-bold text-[var(--fg-base)] tracking-tight">
            Đơn hàng được chọn
          </span>
        </div>
        <div className="w-px h-8 bg-[var(--border-soft)]" />
        <div className="flex items-center gap-3">
          <select
            aria-label="Chọn trạng thái mới cho các đơn đã chọn"
            name="bulk-order-status"
            value={bulkSelectValue}
            onChange={(e) => onBulkSelectChange(e.target.value)}
            className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-lg text-sm px-4 py-2 focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] font-bold text-[var(--fg-base)] transition-colors hover:border-[var(--accent)]/50"
          >
            <option value="">-- Đổi trạng thái --</option>
            <option value="paid">Đã thanh toán (Paid)</option>
            <option value="pending_payment">Chờ xử lý (Pending)</option>
            <option value="provisioning">Đang cấp phát</option>
            <option value="active">Đang hoạt động (Active)</option>
            <option value="expired">Đã hết hạn (Expired)</option>
            <option value="refunded">Hoàn tiền</option>
          </select>
          <button
            type="button"
            onClick={onApplyStatus}
            disabled={!bulkSelectValue}
            className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] text-white font-bold text-sm px-6 py-2 rounded-lg shadow-sm hover:shadow-md transition-[box-shadow,opacity,transform] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
          >
            Áp dụng
          </button>
          <button
            type="button"
            onClick={onBatchDelete}
            className="bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20 font-bold text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            Xóa
          </button>
          <button
            type="button"
            onClick={onClear}
            className="text-[var(--fg-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 font-bold text-sm px-4 py-2 rounded-lg transition-colors ml-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}
