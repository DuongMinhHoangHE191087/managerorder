"use client";

import Link from "next/link";
import { Plus, Upload } from "lucide-react";

export function OrdersPageHeader() {
  return (
    <div className="app-card mb-2 flex flex-col gap-4 border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-[var(--fg-base)]">Quản lý Đơn hàng</h1>
        <p className="mt-1 text-[15px] tracking-wide text-[var(--fg-muted)]">
          Nhấn chuột phải vào dòng để mở menu thao tác. Cập nhật dữ liệu nhanh hơn.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 md:justify-end">
        <Link
          href="/orders/import"
          className="inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.84)] px-4 py-2.5 font-bold text-[var(--fg-base)] shadow-sm transition-all hover:border-[var(--accent)]/25 hover:bg-white"
        >
          <Upload className="size-4" />
          Import Đơn
        </Link>
        <Link
          href="/orders/new"
          className="inline-flex items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-6 py-2.5 font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-all hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
        >
          <Plus className="size-5" />
          Tạo đơn mới
        </Link>
      </div>
    </div>
  );
}
