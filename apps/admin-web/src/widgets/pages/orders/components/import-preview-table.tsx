"use client";

import { AlertCircle, CheckCircle2, Users, ShoppingBag, BadgeDollarSign, AlertTriangle, Copy } from "lucide-react";
import { CONTACT_CHANNEL_OPTIONS, type ContactChannelOption } from "@/lib/utils";
import { formatMoney, formatDateShort } from "@/lib/utils";
import { formatPaymentTermsLabel } from "@/lib/domain/financial";
import { useMemo } from "react";

export type ParsedOrder = {
  orderCode?: string;
  customerName?: string;
  customerCode?: string;
  customerPhone?: string;
  customerEmail?: string;
  productName?: string;
  quantity?: number;
  totalAmountVnd?: number;
  totalPaid?: number;
  paymentMethod?: string;
  salesNote?: string;
  duolingoUsername?: string;
  duolingoId?: string;
  facebookUrl?: string;
  ctvName?: string;
  sourceUsername?: string;
  inviteLink?: string;
  idFamily?: string;
  startDate?: string;
  endDate?: string;
  rawPaymentStatus?: string;
  normalizedStatus?: 'paid' | 'refunded' | 'expired' | 'pending_payment' | 'draft';
  _error?: string;
  _warning?: string;
  _originalRowIndex?: number;
  _orderType?: 'ctv' | 'retail';
  _contactMethod?: string;
  _resolvedCustomerCode?: string;
  _contactChannels?: { channel: string; value: string }[];
  [key: string]: unknown;
};

/** Get color for a contact channel */
function getChannelColor(channel: string): string {
  const opt = CONTACT_CHANNEL_OPTIONS.find((c: ContactChannelOption) => c.key === channel);
  return opt?.color || '#6b7280';
}

interface ImportPreviewTableProps {
  data: ParsedOrder[];
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color}`}>
      <div className="size-8 rounded-lg flex items-center justify-center bg-current/10">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-[11px] font-medium opacity-70 uppercase tracking-wider">{label}</p>
        <p className="text-[15px] font-bold">{value}</p>
      </div>
    </div>
  );
}

export function ImportPreviewTable({ data }: ImportPreviewTableProps) {
  const stats = useMemo(() => {
    const errors = data.filter(d => !!d._error).length;
    const warnings = data.filter(d => !!d._warning).length;
    const valid = data.length - errors;
    const ctv = data.filter(d => d._orderType === 'ctv').length;
    const retail = data.filter(d => d._orderType === 'retail').length;
    const totalRevenue = data.reduce((sum, d) => sum + (d.totalAmountVnd || 0), 0);
    const totalPaid = data.reduce((sum, d) => sum + (d.totalPaid || 0), 0);
    // Detect duplicate order codes in preview
    const orderCodes = data.filter(d => d.orderCode).map(d => d.orderCode!);
    const codeSet = new Set<string>();
    const duplicateCodes = new Set<string>();
    orderCodes.forEach(code => {
      if (codeSet.has(code)) duplicateCodes.add(code);
      codeSet.add(code);
    });
    return { errors, warnings, valid, ctv, retail, totalRevenue, totalPaid, duplicateCodeCount: duplicateCodes.size };
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={ShoppingBag}
          label="Tổng đơn"
          value={`${stats.valid} hợp lệ`}
          color="border-emerald-200 bg-emerald-50 text-emerald-600"
        />
        <StatCard
          icon={Users}
          label="Phân loại"
          value={`${stats.ctv} CTV · ${stats.retail} Lẻ`}
          color="border-blue-200 bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={BadgeDollarSign}
          label="Tổng doanh thu"
          value={formatMoney(stats.totalRevenue)}
          color="border-amber-200 bg-amber-50 text-amber-600"
        />
        {stats.errors > 0 ? (
          <StatCard
            icon={AlertTriangle}
            label="Lỗi"
            value={`${stats.errors} dòng`}
            color="border-red-200 bg-red-50 text-red-600"
          />
        ) : stats.duplicateCodeCount > 0 ? (
          <StatCard
            icon={Copy}
            label="Mã đơn trùng"
            value={`${stats.duplicateCodeCount} mã`}
            color="border-orange-200 bg-orange-50 text-orange-600"
          />
        ) : (
          <StatCard
            icon={CheckCircle2}
            label="Đã thu"
            value={formatMoney(stats.totalPaid)}
            color="border-violet-200 bg-violet-50 text-violet-600"
          />
        )}
      </div>

      {/* Data Table */}
      <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-[var(--border-soft)]">
        <table className="w-full text-left bg-white text-[13px]">
          <thead className="bg-[#FAFAFA] sticky top-0 z-10 shadow-sm border-b border-[var(--border-soft)] w-full block">
            <tr className="flex w-full">
              <th className="px-3 py-3 font-semibold text-[var(--fg-muted)] w-12 flex-shrink-0 text-center">#</th>
              <th className="px-3 py-3 font-semibold text-[var(--fg-muted)] w-20 flex-shrink-0">Trạng thái</th>
              <th className="px-3 py-3 font-semibold text-[var(--fg-muted)] flex-1 min-w-[140px]">Khách hàng</th>
              <th className="px-3 py-3 font-semibold text-[var(--fg-muted)] w-24 flex-shrink-0">Mã KH/CTV</th>
              <th className="px-3 py-3 font-semibold text-[var(--fg-muted)] flex-1 min-w-[100px]">Sản phẩm</th>
              <th className="px-3 py-3 font-semibold text-[var(--fg-muted)] w-28 flex-shrink-0">Liên hệ</th>
              <th className="px-3 py-3 font-semibold text-[var(--fg-muted)] w-28 flex-shrink-0 text-right">Tổng tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-soft)] w-full block">
            {data.map((row, i) => (
              <tr key={i} className={`flex w-full ${
                (row.normalizedStatus === 'refunded' || row.normalizedStatus === 'expired') ? 'bg-slate-50 opacity-60'
                : row._error ? 'bg-red-50/60'
                : row._warning ? 'bg-amber-50/40'
                : 'hover:bg-[var(--bg-surface)] transition-colors'
              }`}>
                <td className="px-3 py-3 w-12 flex-shrink-0 text-center font-mono text-[11px] text-[var(--fg-muted)]">
                  {row._originalRowIndex}
                </td>
                <td className="px-3 py-3 w-20 flex-shrink-0">
                  {row._error ? (
                    <div className="flex items-center gap-1 text-red-500 font-medium" title={row._error}>
                      <AlertCircle className="size-4 shrink-0" />
                      <span className="text-[10px]">Lỗi</span>
                    </div>
                  ) : (row.normalizedStatus === 'refunded' || row.normalizedStatus === 'expired') ? (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                      {row.normalizedStatus === 'refunded' ? 'Hoàn' : 'Hết hạn'}
                    </span>
                  ) : row.normalizedStatus === 'paid' ? (
                    <div className="flex items-center gap-1 text-emerald-500 font-medium">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span className="text-[10px]">Đã TT</span>
                    </div>
                  ) : (
                    <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium">Chờ TT</span>
                  )}
                  {row._error && <p className="text-[9px] text-red-400 mt-0.5 max-w-[68px] truncate" title={row._error}>{row._error}</p>}
                  {!row._error && row._warning && (
                    <div className="flex items-center gap-0.5 mt-0.5" title={row._warning}>
                      <AlertTriangle className="size-3 text-amber-500 shrink-0" />
                      <p className="text-[9px] text-amber-500 max-w-[68px] truncate">{row._warning}</p>
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 flex-1 min-w-[140px] overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-[var(--fg-base)] tracking-tight truncate">{row.customerName}</p>
                    {row._orderType === 'ctv' && (
                      <span className="text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-semibold shrink-0">CTV</span>
                    )}
                  </div>
                  {row.duolingoUsername && (
                    <p className="text-[11px] text-[var(--accent)] truncate font-mono">@{row.duolingoUsername}</p>
                  )}
                  {row.ctvName && (
                    <p className="text-[10px] text-purple-500 truncate">⇢ {row.ctvName}</p>
                  )}
                </td>
                {/* Mã KH/CTV column */}
                <td className="px-3 py-3 w-24 flex-shrink-0 overflow-hidden">
                  {row._resolvedCustomerCode ? (
                    <span className={`text-[11px] font-mono font-semibold truncate block ${
                      row._orderType === 'ctv' ? 'text-purple-600' : 'text-blue-600'
                    }`}>
                      {row._resolvedCustomerCode}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[var(--fg-muted)]">—</span>
                  )}
                  {/* Smart contact method tag */}
                  {row._contactMethod && (
                    <span className={`mt-0.5 inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                      row._contactMethod === 'Facebook'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {row._contactMethod}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 flex-1 min-w-[100px] overflow-hidden">
                  <span className="font-semibold text-[var(--accent)] truncate block mb-0.5">{row.productName}</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-medium">SL: {row.quantity}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-medium truncate max-w-[80px]">
                      {formatPaymentTermsLabel(row.paymentMethod) || "—"}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 w-28 flex-shrink-0">
                  {row._contactChannels && row._contactChannels.length > 0 ? (
                    <div className="space-y-0.5">
                      {row._contactChannels.slice(0, 2).map((c: { channel: string; value: string }, ci: number) => (
                        <div
                          key={ci}
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md mr-1"
                          style={{
                            backgroundColor: getChannelColor(c.channel) + '15',
                            color: getChannelColor(c.channel),
                          }}
                          title={`${c.channel}: ${c.value}`}
                        >
                          <span className="truncate max-w-[60px]">{c.value}</span>
                        </div>
                      ))}
                      {row._contactChannels.length > 2 && (
                        <span className="text-[9px] text-[var(--fg-muted)]">+{row._contactChannels.length - 2}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-[var(--fg-muted)]">—</span>
                  )}
                  {row.startDate && (
                    <p className="text-[10px] text-[var(--fg-muted)] truncate">
                      Từ: {formatDateShort(row.startDate)}
                    </p>
                  )}
                  {row.endDate && (
                    <p className="text-[10px] text-[var(--fg-muted)] truncate">
                      Đến: {formatDateShort(row.endDate)}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3 w-28 flex-shrink-0 text-right">
                  <p className="font-bold text-[var(--fg-base)]">{formatMoney(row.totalAmountVnd || 0)}</p>
                  <p className="text-[11px] text-[var(--fg-muted)]">TT: {formatMoney(row.totalPaid || 0)}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
