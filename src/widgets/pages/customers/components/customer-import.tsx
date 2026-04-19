"use client";

import { useState, useRef } from "react";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

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
      appToast.error("Chỉ chấp nhận file Excel (.xlsx, .xls)");
      return;
    }

    // Client-side size check (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      appToast.error("File quá lớn. Tối đa 5MB");
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
          appToast.success(`Đã nhập ${data.createdCount} khách hàng thành công!`);
          queryClient.invalidateQueries({ queryKey: queryKeys.customers });
        }
      } else {
        appToast.error("Lỗi import: " + (data as unknown as { error: string }).error);
      }
    } catch {
      appToast.error("Lỗi kết nối khi upload file");
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
        aria-label="Import khách hàng từ Excel"
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[var(--border-soft)] rounded-xl text-[13px] font-bold text-[var(--fg-base)] hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
      >
        {isUploading ? (
          <div className="size-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {isUploading ? "Đang nhập..." : "Import Excel"}
      </button>

      {/* Result popup */}
      {result && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-[var(--border-soft)] rounded-xl shadow-lg z-50 w-72 p-4 animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[13px] font-bold text-[var(--fg-base)]">Kết quả Import</h4>
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
              <span className="font-bold">{result.createdCount}</span> tạo thành công
            </div>
            {result.skippedCount > 0 && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="size-3.5" />
                <span className="font-bold">{result.skippedCount}</span> bỏ qua (lỗi validate)
              </div>
            )}
            {result.insertErrors.length > 0 && (
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle className="size-3.5" />
                <span className="font-bold">{result.insertErrors.length}</span> lỗi database
              </div>
            )}
            <p className="text-[var(--fg-muted)] pt-1 border-t border-[var(--border-soft)]">
              Tổng: {result.totalRows} dòng trong file
            </p>
          </div>

          {/* Show first 3 errors */}
          {(result.parseErrors.length > 0 || result.insertErrors.length > 0) && (
            <div className="mt-2 pt-2 border-t border-[var(--border-soft)]">
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Chi tiết lỗi</p>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {[...result.parseErrors, ...result.insertErrors].slice(0, 3).map((err, i) => (
                  <p key={i} className="text-[11px] text-red-500">
                    Dòng {err.row}: {err.message}
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
