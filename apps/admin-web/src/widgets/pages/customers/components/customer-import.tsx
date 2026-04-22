"use client";

import { useState, useRef } from "react";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import { vi } from "@/shared/messages/vi";

interface ImportResult {
  success: boolean;
  totalRows: number;
  createdCount: number;
  skippedCount: number;
  parseErrors: Array<{ row: number; message: string }>;
  insertErrors: Array<{ row: number; message: string }>;
}

export function CustomerImport() {
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      appToast.error(vi.customers.import.invalidType);
      return;
    }

    // Client-side size check (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      appToast.error(vi.customers.import.tooLarge);
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/customers/import", {
        method: "POST",
        body: formData,
      });

      const data: ImportResult = await res.json();

      if (res.ok) {
        setResult(data);
        if (data.createdCount > 0) {
          appToast.success(vi.customers.import.success(data.createdCount));
          queryClient.invalidateQueries({ queryKey: queryKeys.customers });
        }
      } else {
        appToast.error(`${vi.customers.import.errorPrefix} ${(data as unknown as { error: string }).error}`);
      }
    } catch {
      appToast.error(vi.customers.import.connectionError);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="relative">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
        id="customer-import-file"
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={isUploading}
        aria-label={vi.customers.import.ariaLabel}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[var(--border-soft)] rounded-xl text-[13px] font-bold text-[var(--fg-base)] hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
      >
        {isUploading ? (
          <div className="size-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {isUploading ? vi.customers.import.loading : vi.customers.import.button}
      </button>

      {/* Result popup */}
      {result && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-[var(--border-soft)] rounded-xl shadow-lg z-50 w-72 p-4 animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[13px] font-bold text-[var(--fg-base)]">{vi.customers.import.resultTitle}</h4>
            <button
              onClick={() => setResult(null)}
              className="text-[var(--fg-muted)] hover:text-[var(--fg-base)] text-lg leading-none"
            >
              ×
            </button>
          </div>

          <div className="space-y-2 text-[12px]">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="size-3.5" />
              <span className="font-bold">{result.createdCount}</span> {vi.customers.import.createdLabel}
            </div>
            {result.skippedCount > 0 && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="size-3.5" />
                <span className="font-bold">{result.skippedCount}</span> {vi.customers.import.skippedLabel}
              </div>
            )}
            {result.insertErrors.length > 0 && (
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle className="size-3.5" />
                <span className="font-bold">{result.insertErrors.length}</span> {vi.customers.import.dbErrorsLabel}
              </div>
            )}
            <p className="text-[var(--fg-muted)] pt-1 border-t border-[var(--border-soft)]">
              {vi.customers.import.totalRows(result.totalRows)}
            </p>
          </div>

          {/* Show first 3 errors */}
          {(result.parseErrors.length > 0 || result.insertErrors.length > 0) && (
            <div className="mt-2 pt-2 border-t border-[var(--border-soft)]">
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">{vi.customers.import.detailErrors}</p>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {[...result.parseErrors, ...result.insertErrors].slice(0, 3).map((err, i) => (
                  <p key={i} className="text-[11px] text-red-500">
                    {vi.customers.import.rowPrefix} {err.row}: {err.message}
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
