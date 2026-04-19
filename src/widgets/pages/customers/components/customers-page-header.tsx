"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Plus, Zap } from "lucide-react";
import type { Customer } from "@/lib/domain/types";

const CustomerExport = dynamic(() => import("@/widgets/pages/customers/components/customer-export").then((m) => ({ default: m.CustomerExport })), { ssr: false });
const CustomerImport = dynamic(() => import("@/widgets/pages/customers/components/customer-import").then((m) => ({ default: m.CustomerImport })), { ssr: false });

type CustomersPageHeaderProps = {
  customers: Customer[];
  isRecalculating: boolean;
  onCreateClick: () => void;
  onRecalculateRfm: () => void;
};

export const CustomersPageHeader = React.memo(function CustomersPageHeader({
  customers,
  isRecalculating,
  onCreateClick,
  onRecalculateRfm,
}: CustomersPageHeaderProps) {
  return (
    <div className="mb-2 mt-2 flex flex-col gap-4 rounded-[1.2rem] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-[var(--fg-base)]">Khách hàng</h1>
        <p className="text-[15px] font-medium tracking-wide text-[var(--fg-muted)]">
          Quản lý cơ sở khách hàng, tài khoản và hồ sơ công nợ.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onRecalculateRfm}
          disabled={isRecalculating}
          className="flex items-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.84)] px-4 py-2.5 text-[13px] font-bold text-[var(--fg-base)] shadow-sm transition-colors hover:border-[var(--accent)]/25 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRecalculating ? (
            <div className="size-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          ) : (
            <Zap className="size-4" />
          )}
          {isRecalculating ? "Đang tính..." : "Tính RFM"}
        </button>
        <CustomerImport />
        <CustomerExport customers={customers} />
        <button
          onClick={onCreateClick}
          className="flex items-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-6 py-2.5 text-sm font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-all hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
        >
          <Plus className="size-5" />
          Thêm Khách Hàng
        </button>
      </div>
    </div>
  );
});
