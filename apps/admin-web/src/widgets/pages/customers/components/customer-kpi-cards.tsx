"use client";
 
import React from "react";
import { Users, ShieldCheck, AlertTriangle } from "lucide-react";
import { StaggerContainer, StaggerItem, GlassHoverCard } from "@/shared/ui/animations";
import { formatMoney } from "@/lib/utils";
import type { Customer } from "@/lib/domain/types";
import { vi } from "@/shared/messages/vi";
 
interface CustomerKpiCardsProps {
  customers: Customer[];
}
 
export const CustomerKpiCards = React.memo(function CustomerKpiCards({ customers }: CustomerKpiCardsProps) {
  const totalCustomers = customers.length;
  const wholesaleCustomers = customers.filter((c) => c.customerType === "wholesale").length;
  const agencyCustomers = customers.filter((c) => c.customerType === "agency").length;
  const retailCustomers = customers.filter((c) => c.customerType === "retail").length;
  const totalDebt = customers.reduce((sum, c) => sum + c.debtAmountVnd, 0);
  const debtCustomersCount = customers.filter((c) => c.debtAmountVnd > 0).length;
 
  return (
    <StaggerContainer delayChildren={0.2} staggerDelay={0.08} className="grid grid-cols-2 gap-2 xl:grid-cols-3 mb-4">
      {/* Tổng khách hàng */}
      <StaggerItem>
        <GlassHoverCard className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
          <div className="min-w-0">
            <p className="text-[var(--fg-muted)] text-[9px] font-bold uppercase tracking-widest mb-1">{vi.customers.kpis.totalCustomers}</p>
            <p className="text-[var(--fg-base)] text-lg font-black tracking-tight font-mono leading-none mb-1.5">{totalCustomers}</p>
            <div className="flex flex-wrap items-center gap-1">
              <span className="rounded bg-slate-50 text-[var(--fg-muted)] px-1.5 py-px text-[9px] font-bold font-mono border border-slate-100">{retailCustomers} Lẻ</span>
              <span className="rounded bg-blue-50 text-blue-600 px-1.5 py-px text-[9px] font-bold font-mono border border-blue-100">{wholesaleCustomers} Sỉ</span>
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-[var(--accent)]/10 p-1.5 text-[var(--accent)]">
            <Users className="size-4" />
          </span>
        </GlassHoverCard>
      </StaggerItem>
 
      {/* Phân loại VIP/Agency */}
      <StaggerItem>
        <GlassHoverCard className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
          <div className="min-w-0">
            <p className="text-[var(--fg-muted)] text-[9px] font-bold uppercase tracking-widest mb-1">{vi.customers.kpis.wholesaleAgency}</p>
            <p className="text-[var(--fg-base)] text-lg font-black tracking-tight font-mono leading-none mb-1.5">{wholesaleCustomers + agencyCustomers}</p>
            <div className="flex flex-wrap items-center gap-1">
              <span className="rounded bg-[#ff9500]/5 text-[#ff9500] px-1.5 py-px text-[9px] font-bold font-mono border border-[#ff9500]/15">{agencyCustomers} Đại lý</span>
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-[#ff9500]/10 p-1.5 text-[#ff9500]">
            <ShieldCheck className="size-4" />
          </span>
        </GlassHoverCard>
      </StaggerItem>
 
      {/* Tổng công nợ */}
      <StaggerItem>
        <GlassHoverCard className="flex items-center justify-between gap-2 rounded-xl border border-red-200/60 bg-red-50/30 p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
          <div className="min-w-0">
            <p className="text-red-600 text-[9px] font-bold uppercase tracking-widest mb-1">{vi.customers.kpis.totalDebt}</p>
            <p className="text-red-600 text-lg font-black tracking-tight font-mono leading-none mb-1.5">{formatMoney(totalDebt)}</p>
            <div className="flex flex-wrap items-center gap-1">
              <span className="rounded bg-red-100/50 text-red-700 px-1.5 py-px text-[9px] font-bold font-mono border border-red-200/40">{debtCustomersCount} Khách nợ</span>
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-[var(--danger)]/10 p-1.5 text-[var(--danger)]">
            <AlertTriangle className="size-4" />
          </span>
        </GlassHoverCard>
      </StaggerItem>
    </StaggerContainer>
  );
});
