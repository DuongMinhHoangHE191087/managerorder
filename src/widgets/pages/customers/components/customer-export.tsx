"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileJson, FileText } from "lucide-react";
import type { Customer } from "@/lib/domain/types";
import { formatDateShort } from "@/lib/utils";

interface CustomerExportProps {
  customers: Customer[];
  /** Label override (optional) */
  label?: string;
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function generateCSV(customers: Customer[]): string {
  const headers = [
    "Tên", "Phân loại", "Phân khúc", "Điểm RFM", "Liên hệ chính", "Kênh liên hệ",
    "Công nợ (VNĐ)", "Ngày quá hạn", "Điểm tín nhiệm", "Ghi chú", "Ngày tạo"
  ];

  const rows = customers.map(c => {
    const primary = c.contacts.find(ct => ct.isPrimary) || c.contacts[0];
    const typeLabel = c.customerType === "retail" ? "Khách lẻ"
      : c.customerType === "wholesale" ? "Bán sỉ" : "Đại lý";
    return [
      escapeCSV(c.name),
      typeLabel,
      c.segment,
      String(c.rfmScore),
      primary?.value ?? "",
      primary?.type ?? "",
      String(c.debtAmountVnd),
      String(c.debtOverdueDays),
      String(c.reliabilityScore),
      escapeCSV(c.notes ?? ""),
      formatDateShort(c.createdAt),
    ].join(",");
  });

  // BOM for Excel UTF-8 compatibility
  return "\uFEFF" + [headers.join(","), ...rows].join("\n");
}

function generateJSON(customers: Customer[]): string {
  const data = customers.map(c => {
    const primary = c.contacts.find(ct => ct.isPrimary) || c.contacts[0];
    return {
      name: c.name,
      type: c.customerType,
      segment: c.segment,
      rfmScore: c.rfmScore,
      primaryContact: primary?.value ?? null,
      contactChannel: primary?.type ?? null,
      debtVnd: c.debtAmountVnd,
      overdueDays: c.debtOverdueDays,
      reliabilityScore: c.reliabilityScore,
      notes: c.notes ?? null,
      createdAt: c.createdAt,
    };
  });
  return JSON.stringify(data, null, 2);
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function CustomerExport({ customers, label }: CustomerExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
  const timestamp = new Date().toISOString().split("T")[0];

  function handleExportCSV() {
    const csv = generateCSV(customers);
    downloadFile(csv, `khach-hang_${timestamp}.csv`, "text/csv;charset=utf-8");
    setIsOpen(false);
  }

  function handleExportJSON() {
    const json = generateJSON(customers);
    downloadFile(json, `khach-hang_${timestamp}.json`, "application/json");
    setIsOpen(false);
  }

  async function handleExportXLSX() {
    setIsExportingXlsx(true);
    try {
      const res = await fetch("/api/customers/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `khach-hang_${timestamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback error handling
    } finally {
      setIsExportingXlsx(false);
      setIsOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[var(--border-soft)] rounded-xl text-[13px] font-bold text-[var(--fg-base)] hover:bg-gray-50 transition-colors"
      >
        <Download className="size-4" />
        {label ?? `Export (${customers.length})`}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-1.5 bg-white border border-[var(--border-soft)] rounded-xl shadow-lg z-50 w-52 animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden">
            {/* XLSX - Featured */}
            <button
              onClick={handleExportXLSX}
              disabled={isExportingXlsx}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet className="size-5 text-emerald-500" />
              <div>
                <p className="text-[13px] font-bold text-[var(--fg-base)]">
                  {isExportingXlsx ? "Đang xuất..." : "Excel (XLSX)"}
                </p>
                <p className="text-[11px] text-[var(--fg-muted)]">Đầy đủ RFM + Phân khúc</p>
              </div>
            </button>
            <div className="border-t border-[var(--border-soft)]" />
            <button
              onClick={handleExportCSV}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <FileText className="size-5 text-gray-500" />
              <div>
                <p className="text-[13px] font-bold text-[var(--fg-base)]">CSV</p>
                <p className="text-[11px] text-[var(--fg-muted)]">Mở bằng Excel, Google Sheets</p>
              </div>
            </button>
            <div className="border-t border-[var(--border-soft)]" />
            <button
              onClick={handleExportJSON}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <FileJson className="size-5 text-blue-500" />
              <div>
                <p className="text-[13px] font-bold text-[var(--fg-base)]">JSON</p>
                <p className="text-[11px] text-[var(--fg-muted)]">Dữ liệu structured</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

