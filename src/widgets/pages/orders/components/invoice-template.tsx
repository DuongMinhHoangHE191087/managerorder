"use client";

import { useMemo } from "react";
import { formatMoney, formatDateLabel } from "@/lib/utils";
import { OrderWithItems } from "@/lib/supabase/repositories/orders.repo";
import { Printer } from "lucide-react";

export function InvoiceTemplate({ order, onPrint }: { order: OrderWithItems; onPrint?: () => void }) {
  // Parse JSON snapshot safely
  const invoiceSnapshot = useMemo(() => {
    try {
      if (typeof order.invoice_snapshot === 'string') return JSON.parse(order.invoice_snapshot);
      return order.invoice_snapshot;
    } catch { return null; }
  }, [order.invoice_snapshot]);

  const billingDetails = useMemo(() => {
    try {
      if (typeof order.billing_details === 'string') return JSON.parse(order.billing_details);
      return order.billing_details;
    } catch { return null; }
  }, [order.billing_details]);

  const invoiceNo = `INV-${order.id.split("-")[0].toUpperCase()}`;

  // Company Information (From Snapshot or fallback)
  const coName = invoiceSnapshot?.company_name || "CÔNG TY TNHH VÍ DỤ";
  const coTax = invoiceSnapshot?.tax_id || "";
  const coAddress = invoiceSnapshot?.company_address || "Hà Nội, Việt Nam";
  const coBank = invoiceSnapshot?.bank_name || "";
  const coAccount = invoiceSnapshot?.bank_account || "";
  
  // Client Information (From Billing Details or Default strings)
  const clName = billingDetails?.company_name || order.customer_id; // Usually we'd map customer_id to real name if billingDetails is empty, but billing_details is preferred.
  const clTax = billingDetails?.tax_id || "Khách lẻ không xuất hoá đơn VAT";
  const clAddress = billingDetails?.company_address || "";
  const clEmail = billingDetails?.email || "";

  return (
    <div className="bg-white text-black p-8 sm:p-12 w-full max-w-4xl mx-auto shadow-sm min-h-[A4] print:shadow-none print:w-full font-sans border print:border-none relative">
      
      {/* Print Button Wrapper */}
      <div className="absolute top-4 right-4 print:hidden">
        {onPrint && (
          <button 
            onClick={onPrint}
            className="flex items-center gap-2 bg-[var(--accent)] text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-[var(--accent-strong)] transition-colors"
          >
            <Printer className="size-4" /> IN HOÁ ĐƠN
          </button>
        )}
      </div>

      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
        <div>
          <h1 className="text-3xl font-black text-[var(--accent)] mb-2 uppercase tracking-wide">HOÁ ĐƠN BÁN HÀNG</h1>
          <p className="text-sm text-gray-500 font-medium">Bản thể hiện của hoá đơn điện tử</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-800 tracking-tight">{invoiceNo}</p>
          <p className="text-sm text-gray-500 mt-1">Ngày xuất: {formatDateLabel(order.created_at)}</p>
          <p className="text-sm text-gray-500">Mẫu số: 01GTKT0/001</p>
          <p className="text-sm text-gray-500">Ký hiệu: AB/23E</p>
        </div>
      </div>

      {/* Provider & Client Info Grid */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Provider */}
        <div className="space-y-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Đơn vị bán hàng</p>
          <p className="font-extrabold text-lg text-gray-900 uppercase">{coName}</p>
          {coTax && <p className="text-sm"><span className="font-semibold w-24 inline-block text-gray-600">Mã số thuế:</span> {coTax}</p>}
          <p className="text-sm"><span className="font-semibold w-24 inline-block text-gray-600">Địa chỉ:</span> {coAddress}</p>
          {coBank && <p className="text-sm"><span className="font-semibold w-24 inline-block text-gray-600">Số tài khoản:</span> {coAccount} tại {coBank}</p>}
        </div>

        {/* Client */}
        <div className="space-y-1">
           <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Thông tin người mua</p>
           <p className="font-extrabold text-lg text-gray-900 uppercase">{clName}</p>
           {clTax && <p className="text-sm"><span className="font-semibold w-24 inline-block text-gray-600">Mã số thuế:</span> {clTax}</p>}
           {clAddress && <p className="text-sm"><span className="font-semibold w-24 inline-block text-gray-600">Địa chỉ:</span> {clAddress}</p>}
           {clEmail && <p className="text-sm"><span className="font-semibold w-24 inline-block text-gray-600">Email:</span> {clEmail}</p>}
        </div>
      </div>

      {/* Line Items Table */}
      <table className="w-full text-left border-collapse mb-8">
        <thead>
          <tr className="border-b-2 border-gray-300 text-gray-600">
            <th className="py-3 px-2 text-xs font-bold uppercase tracking-wider w-12 text-center">STT</th>
            <th className="py-3 px-2 text-xs font-bold uppercase tracking-wider">Tên hàng hóa, dịch vụ</th>
            <th className="py-3 px-2 text-xs font-bold uppercase tracking-wider w-24 text-center">ĐVT</th>
            <th className="py-3 px-2 text-xs font-bold uppercase tracking-wider w-24 text-right">Số lượng</th>
            <th className="py-3 px-2 text-xs font-bold uppercase tracking-wider w-32 text-right">Đơn giá (VNĐ)</th>
            <th className="py-3 px-2 text-xs font-bold uppercase tracking-wider w-36 text-right">Thành tiền (VNĐ)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {order.items?.map((item, index) => (
            <tr key={item.id} className="hover:bg-gray-50/50">
              <td className="py-4 px-2 text-sm text-center">{index + 1}</td>
              <td className="py-4 px-2 text-sm font-semibold">{item.product_name_snapshot}</td>
              <td className="py-4 px-2 text-sm text-center">Gói</td>
              <td className="py-4 px-2 text-sm text-right">{item.quantity}</td>
              <td className="py-4 px-2 text-sm text-right">{formatMoney(item.price_vnd)}</td>
              <td className="py-4 px-2 text-sm text-right font-bold">{formatMoney(item.subtotal_vnd)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary section */}
      <div className="w-full flex justify-end mb-12">
        <div className="w-1/2 space-y-3">
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-sm text-gray-600 font-semibold">Cộng tiền hàng:</span>
            <span className="text-sm font-bold">{formatMoney(order.total_amount_vnd)}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-sm text-gray-600 font-semibold">Thuế GTGT (0% - Không chịu thuế):</span>
            <span className="text-sm font-bold">0 VNĐ</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-lg text-gray-800 font-black uppercase">Tổng thanh toán:</span>
            <span className="text-lg font-black text-[var(--accent)]">{formatMoney(order.total_amount_vnd)}</span>
          </div>
          <div className="pt-2 text-right text-sm italic font-medium text-gray-500">
            Trạng thái khoản: {order.status === 'paid' ? 'Đã Thanh Toán' : 'Chưa Thanh Toán'}
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="flex justify-between mt-12 px-12 text-center text-sm mb-16">
        <div>
          <p className="font-bold mb-16">Người mua hàng</p>
          <p className="italic text-gray-400">&quot;Chữ ký số hợp lệ (nếu có)&quot;</p>
        </div>
        <div>
          <p className="font-bold mb-16">Người bán hàng</p>
          <p className="italic text-gray-500 font-semibold">{coName}</p>
          <p className="italic text-gray-400 mt-1">Ký bởi hệ thống lúc {formatDateLabel(order.created_at)}</p>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-8 flex justify-between text-xs text-gray-400">
        <p>Cần kiểm tra đối chiếu khi lập, giao, nhận hoá đơn</p>
        <p>Phát hành bởi Dương Minh Hoàng — duongminhhoang.store</p>
      </div>
    </div>
  );
}
