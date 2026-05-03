"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/shared/lib/react-query/query-keys";
import { appToast } from "@/shared/lib/toast";
import { INVENTORY_COPY as copy } from "../copy";

interface ImportResult {
  success: boolean;
  totalRows: number;
  createdCount: number;
  skippedCount: number;
  parseErrors: Array<{ row: number; message: string }>;
  insertErrors: Array<{ row: number; message: string }>;
}

export function SourceAccountImport() {
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExts = [".xlsx", ".xls"];
    const isValid = validExts.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!isValid) {
      appToast.error(copy.sourceAccountImport.excelOnlyError);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      appToast.error(copy.sourceAccountImport.tooLargeError);
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/source-accounts/import", {
        method: "POST",
        body: formData,
      });

      const data: ImportResult = await res.json();

      if (res.ok) {
        setResult(data);
        if (data.createdCount > 0) {
          appToast.success(copy.sourceAccountImport.success(data.createdCount));
          queryClient.invalidateQueries({ queryKey: queryKeys.sourceAccounts });
        }
      } else {
        appToast.error(copy.sourceAccountImport.loadError((data as unknown as { error: string }).error));
      }
    } catch {
      appToast.error(copy.sourceAccountImport.uploadError);
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleDownloadTemplate() {
    const headers = [
      "email",
      "password",
      "provider",
      "products",
      "maxSlots",
      "expiresAt",
      "duolingo_id",
      "link_join",
      "purchaseCostVnd",
      "purchaseDate",
      "purchaseSource",
    ];
    const example = [
      "example@gmail.com",
      "mypassword123",
      "NCC Chính",
      "Duolingo Super",
      "6",
      "2025-12-31",
      "123456789",
      "https://www.duolingo.com/profile/user",
      "200000",
      "2025-01-15",
      "Facebook",
    ];

    const csvContent = [headers.join(","), example.join(",")].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_import_accounts.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="relative">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
        id="source-account-import-file"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold text-[var(--fg-muted)] transition-colors hover:bg-gray-100 hover:text-[var(--fg-base)]"
          title={copy.sourceAccountImport.templateTitle}
        >
          <Download className="size-3.5" />
          {copy.sourceAccountImport.templateButton}
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-white px-4 py-2.5 text-[13px] font-bold text-[var(--fg-base)] shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="size-4 animate-spin text-[var(--accent)]" /> : <FileSpreadsheet className="size-4 text-green-500" />}
          {isUploading ? copy.sourceAccountImport.importing : copy.sourceAccountImport.importButton}
        </button>
      </div>

      {result && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-[var(--border-soft)] bg-white p-5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-[14px] font-bold text-[var(--fg-base)]">
              <FileSpreadsheet className="size-4 text-green-500" />
              {copy.sourceAccountImport.popupTitle}
            </h4>
            <button
              onClick={() => setResult(null)}
              className="flex size-6 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
            >
              <X className="size-4 text-[var(--fg-muted)]" />
            </button>
          </div>

          <div className="space-y-2.5 text-[12px]">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <CheckCircle2 className="size-4 shrink-0" />
              <span className="font-bold">{result.createdCount}</span> {copy.sourceAccountImport.createdSuffix}
            </div>

            {result.skippedCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-amber-600">
                <AlertCircle className="size-4 shrink-0" />
                <span className="font-bold">{result.skippedCount}</span> {copy.sourceAccountImport.skippedSuffix}
              </div>
            )}

            {result.insertErrors.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-red-500">
                <AlertCircle className="size-4 shrink-0" />
                <span className="font-bold">{result.insertErrors.length}</span> {copy.sourceAccountImport.dbErrorsSuffix}
              </div>
            )}

            <p className="border-t border-[var(--border-soft)] pt-2 text-[11px] text-[var(--fg-muted)]">
              {copy.sourceAccountImport.totalRows(result.totalRows)}
            </p>
          </div>

          {(result.parseErrors.length > 0 || result.insertErrors.length > 0) && (
            <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-red-500">
                {copy.sourceAccountImport.errorDetails}
              </p>
              <div className="custom-scrollbar max-h-24 space-y-1 overflow-y-auto">
                {[...result.parseErrors, ...result.insertErrors].slice(0, 5).map((err, i) => (
                  <p key={i} className="font-mono text-[11px] text-red-500">
                    {copy.sourceAccountImport.errorRow(err.row, err.message)}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
