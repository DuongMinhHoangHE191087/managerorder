"use client";

import React from "react";
import { motion } from "framer-motion";
import { Phone, Link2, DollarSign, AlertCircle, Award, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type CustomerGridRow = {
  id: string;
  name: string;
  contacts: any[];
  tier: "vip" | "regular";
  customerType: string;
  debtAmountVnd: number;
  debtOverdueDays: number;
  totalSpentVnd: number;
  balanceVnd: number;
  reliabilityScore: number;
  notes: string | null;
  nicksRegistry: any[];
  segment: string | null;
  rfmScore: number | null;

  // Computed properties from CustomerModel.toJSON()
  primaryContact: any | null;
  segmentMeta: {
    label: string;
    class: string;
    dotClass: string;
  };
  debtState: "normal" | "warning" | "critical";
  reliabilityState: {
    label: string;
    class: string;
  };
  formattedDebt: string;
  formattedTotalSpent: string;
  formattedBalance: string;
};

interface CustomersGridProps {
  isLoading: boolean;
  mappedCustomers: CustomerGridRow[];
  onRowClick: (row: any) => void;
  onEditClick: (row: any) => void;
  onDeleteClick: (row: any) => void;
}

function getDebtAccentColor(debtState: string): string {
  if (debtState === "critical") return "border-t-[3px] border-t-red-500";
  if (debtState === "warning") return "border-t-[3px] border-t-amber-500";
  return "";
}

function getDebtBgColor(debtState: string): string {
  if (debtState === "critical") return "bg-red-50/50";
  if (debtState === "warning") return "bg-amber-50/50";
  return "bg-gray-50/50";
}

const CustomerCard = React.memo(function CustomerCard({
  customer,
  onRowClick,
  onEditClick,
  onDeleteClick,
}: {
  customer: CustomerGridRow;
  onRowClick: (row: any) => void;
  onEditClick: (row: any) => void;
  onDeleteClick: (row: any) => void;
}) {
  const contact = customer.primaryContact;

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditClick(customer);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteClick(customer);
  };

  return (
    <motion.div
      data-testid="customer-card"
      onClick={() => onRowClick(customer)}
      whileHover={{ y: -3, boxShadow: "0 10px 20px rgba(22, 60, 30, 0.08)" }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={cn(
        "group cursor-pointer overflow-hidden rounded-xl border border-gray-200/80 bg-white transition-all duration-200 flex flex-col justify-between select-none relative hover:border-gray-300",
        getDebtAccentColor(customer.debtState)
      )}
    >
      <div className="p-4 flex-1">
        {/* Header: Name + Segment */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-purple-100 bg-purple-50/50 font-bold text-purple-800 text-[14px]">
              <User className="size-4 text-purple-700" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-gray-800 text-[13.5px] leading-tight" title={customer.name}>
                {customer.name}
              </h3>
              <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wide">
                {customer.customerType === "agency" ? "Đại lý" : customer.customerType === "wholesale" ? "Sỉ" : "Lẻ"}
              </p>
            </div>
          </div>

          <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wider whitespace-nowrap",
            customer.segmentMeta.class
          )}>
            <span className={cn("size-1 rounded-full shrink-0", customer.segmentMeta.dotClass)} />
            {customer.segmentMeta.label}
          </span>
        </div>

        {/* Contact info & Registry */}
        <div className="space-y-2 mt-4 text-[12px] text-gray-600">
          {contact && (
            <div className="flex items-center gap-2 min-w-0">
              {contact.type === "phone" || contact.type === "zalo" ? (
                <Phone className="size-3.5 text-gray-400 shrink-0" />
              ) : (
                <Link2 className="size-3.5 text-gray-400 shrink-0" />
              )}
              <span className="truncate text-gray-700 font-medium">{contact.value}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Award className="size-3.5 text-gray-400" />
            <span>Nicks đăng ký: <strong className="text-gray-700 font-mono">{customer.nicksRegistry.length}</strong> nicks</span>
          </div>
        </div>

        {/* Debt Alert Box */}
        {customer.debtAmountVnd > 0 && (
          <div className={cn(
            "mt-4 rounded-lg px-3 py-2 flex items-center justify-between border border-gray-150",
            getDebtBgColor(customer.debtState)
          )}>
            <span className="text-[12px] font-semibold text-gray-700 flex items-center gap-1">
              <AlertCircle className="size-3.5 text-red-500 shrink-0" />
              Nợ {customer.debtOverdueDays} ngày
            </span>
            <span className="font-mono text-[12px] font-bold text-red-600">
              {customer.formattedDebt}
            </span>
          </div>
        )}
      </div>

      {/* Footer: Spent + Actions */}
      <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2.5 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Đã chi tiêu</span>
          <span className="font-mono font-bold text-[13.5px] text-gray-800 mt-0.5">
            {customer.formattedTotalSpent}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            title="Sửa khách hàng"
            onClick={handleEdit}
            className="flex size-7 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-500 hover:text-gray-700 transition-all"
          >
            <Settings className="size-3.5" />
          </button>
          <button
            title="Xóa khách hàng"
            onClick={handleDelete}
            className="flex size-7 items-center justify-center rounded-lg border border-red-200 bg-white hover:bg-red-50 hover:border-red-300 text-red-500 hover:text-red-700 transition-all"
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
});

export const CustomersGrid = React.memo(function CustomersGrid({
  isLoading,
  mappedCustomers,
  onRowClick,
  onEditClick,
  onDeleteClick,
}: CustomersGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-xl border border-gray-150 bg-white shadow-sm flex flex-col justify-between min-h-[170px]">
            <div className="p-4 flex-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="size-9 animate-pulse rounded-lg bg-gray-200" />
                  <div>
                    <div className="h-3.5 w-24 animate-pulse rounded bg-gray-200 mb-1.5" />
                    <div className="h-2.5 w-16 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
              </div>
              <div className="h-3.5 w-36 animate-pulse rounded bg-gray-200 my-4" />
            </div>
            <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2.5 flex items-center justify-between">
              <div>
                <div className="h-2.5 w-12 animate-pulse rounded bg-gray-200 mb-1" />
                <div className="h-3.5 w-20 animate-pulse rounded bg-gray-200 font-mono" />
              </div>
              <div className="size-7 animate-pulse rounded-lg bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (mappedCustomers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full border border-purple-100 bg-purple-50/50">
          <User className="size-5 text-purple-600 opacity-60" />
        </div>
        <p className="text-[13.5px] font-semibold text-gray-800">Không tìm thấy khách hàng</p>
        <p className="mt-0.5 text-[11.5px] text-gray-500">Thử thay đổi bộ lọc hoặc tạo khách hàng mới.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="customers-grid">
      {mappedCustomers.map((customer) => (
        <CustomerCard
          key={customer.id}
          customer={customer}
          onRowClick={onRowClick}
          onEditClick={onEditClick}
          onDeleteClick={onDeleteClick}
        />
      ))}
    </div>
  );
});
