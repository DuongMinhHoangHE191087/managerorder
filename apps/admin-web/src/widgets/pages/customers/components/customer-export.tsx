"use client";

import { useState } from "react";
import { Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import type { Customer } from "@/lib/domain/types";
import { formatDateShort } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";

interface CustomerExportProps {
  customers: Customer[];
  label?: string;
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function generateCSV(customers: Customer[]): string {
  const columns = vi.customers.export.columns;
  const typeLabels = vi.customers.detail.typeLabels;
  const headers = [
    columns.name,
    columns.type,
    columns.segment,
    columns.rfmScore,
    columns.primaryContact,
    columns.contactChannel,
    columns.debtVnd,
    columns.overdueDays,
    columns.reliabilityScore,
    columns.notes,
    columns.createdAt,
  ];

  const rows = customers.map((customer) => {
    const primary = customer.contacts.find((contact) => contact.isPrimary) || customer.contacts[0];
    const typeLabel =
      customer.customerType === "retail"
        ? typeLabels.retail
        : customer.customerType === "wholesale"
          ? typeLabels.wholesale
          : typeLabels.agency;

    return [
      escapeCSV(customer.name),
      typeLabel,
      customer.segment,
      String(customer.rfmScore),
      primary?.value ?? "",
      primary?.type ?? "",
      String(customer.debtAmountVnd),
      String(customer.debtOverdueDays),
      String(customer.reliabilityScore),
      escapeCSV(customer.notes ?? ""),
      formatDateShort(customer.createdAt),
    ].join(",");
  });

  return "\uFEFF" + [headers.join(","), ...rows].join("\n");
}

function generateJSON(customers: Customer[]): string {
  const data = customers.map((customer) => {
    const primary = customer.contacts.find((contact) => contact.isPrimary) || customer.contacts[0];
    return {
      name: customer.name,
      type: customer.customerType,
      segment: customer.segment,
      rfmScore: customer.rfmScore,
      primaryContact: primary?.value ?? null,
      contactChannel: primary?.type ?? null,
      debtVnd: customer.debtAmountVnd,
      overdueDays: customer.debtOverdueDays,
      reliabilityScore: customer.reliabilityScore,
      notes: customer.notes ?? null,
      createdAt: customer.createdAt,
    };
  });
  return JSON.stringify(data, null, 2);
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function CustomerExport({ customers, label }: CustomerExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
  const timestamp = new Date().toISOString().split("T")[0];

  async function handleExportXLSX() {
    setIsExportingXlsx(true);
    try {
      const response = await fetch("/api/customers/export");
      if (!response.ok) {
        throw new Error("Export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `khach-hang_${timestamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback error handling
    } finally {
      setIsExportingXlsx(false);
      setIsOpen(false);
    }
  }

  function handleExportCSV() {
    downloadFile(generateCSV(customers), `khach-hang_${timestamp}.csv`, "text/csv;charset=utf-8");
    setIsOpen(false);
  }

  function handleExportJSON() {
    downloadFile(generateJSON(customers), `khach-hang_${timestamp}.json`, "application/json");
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-white px-4 py-2.5 text-[13px] font-bold text-[var(--fg-base)] transition-colors hover:bg-gray-50"
      >
        <Download className="size-4" />
        {label ?? vi.customers.export.button(customers.length)}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white shadow-lg animate-in fade-in-0 zoom-in-95 duration-150">
            <button
              type="button"
              onClick={handleExportXLSX}
              disabled={isExportingXlsx}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <FileSpreadsheet className="size-5 text-emerald-500" />
              <div>
                <p className="text-[13px] font-bold text-[var(--fg-base)]">
                  {isExportingXlsx ? vi.customers.export.exporting : vi.customers.export.xlsxTitle}
                </p>
                <p className="text-[11px] text-[var(--fg-muted)]">{vi.customers.export.xlsxDescription}</p>
              </div>
            </button>
            <div className="border-t border-[var(--border-soft)]" />
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
            >
              <FileText className="size-5 text-gray-500" />
              <div>
                <p className="text-[13px] font-bold text-[var(--fg-base)]">{vi.customers.export.csvTitle}</p>
                <p className="text-[11px] text-[var(--fg-muted)]">{vi.customers.export.csvDescription}</p>
              </div>
            </button>
            <div className="border-t border-[var(--border-soft)]" />
            <button
              type="button"
              onClick={handleExportJSON}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
            >
              <FileJson className="size-5 text-blue-500" />
              <div>
                <p className="text-[13px] font-bold text-[var(--fg-base)]">{vi.customers.export.jsonTitle}</p>
                <p className="text-[11px] text-[var(--fg-muted)]">{vi.customers.export.jsonDescription}</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
