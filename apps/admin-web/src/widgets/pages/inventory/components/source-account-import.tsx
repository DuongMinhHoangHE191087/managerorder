"use client";

import { useState, useRef } from "react";
import { FileSpreadsheet, AlertCircle, CheckCircle2, Download, Loader2, X } from "lucide-react";
import { appToast } from "@/shared/lib/toast";
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

export function SourceAccountImport() {
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validExts = [".xlsx", ".xls"];
    const isValid = validExts.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!isValid) {
      appToast.error("Chỉ chấp nhận file Excel (.xlsx, .xls)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      appToast.error("File quá lớn. Tối đa 5MB");
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
          appToast.success(`✅ Đã nhập ${data.createdCount} tài khoản thành công!`);
          queryClient.invalidateQueries({ queryKey: queryKeys.sourceAccounts });
        }
      } else {
        appToast.error("Lỗi import: " + (data as unknown as { error: string }).error);
      }
    } catch {
      appToast.error("Lỗi kết nối khi upload file");
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleDownloadTemplate() {
    // Create simple CSV template
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
        {/* Template download */}
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold text-[var(--fg-muted)] hover:text-[var(--fg-base)] hover:bg-gray-100 rounded-lg transition-colors"
          title="Tải file mẫu CSV"
        >
          <Download className="size-3.5" />
          Mẫu
        </button>

        {/* Import button */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[var(--border-soft)] rounded-xl text-[13px] font-bold text-[var(--fg-base)] hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
        >
          {isUploading ? (
            <Loader2 className="size-4 animate-spin text-[var(--accent)]" />
          ) : (
            <FileSpreadsheet className="size-4 text-green-500" />
          )}
          {isUploading ? "Đang nhập..." : "Import Excel"}
        </button>
      </div>

      {/* Result popup */}
      {result && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-[var(--border-soft)] rounded-2xl shadow-xl z-50 w-80 p-5 animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[14px] font-bold text-[var(--fg-base)] flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-green-500" />
              Kết quả Import
            </h4>
            <button
              onClick={() => setResult(null)}
              className="size-6 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="size-4 text-[var(--fg-muted)]" />
            </button>
          </div>

          <div className="space-y-2.5 text-[12px]">
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-2 rounded-lg">
              <CheckCircle2 className="size-4 shrink-0" />
              <span className="font-bold">{result.createdCount}</span> tạo thành công
            </div>

            {result.skippedCount > 0 && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2 rounded-lg">
                <AlertCircle className="size-4 shrink-0" />
                <span className="font-bold">{result.skippedCount}</span> bỏ qua (lỗi validate)
              </div>
            )}

            {result.insertErrors.length > 0 && (
              <div className="flex items-center gap-2 text-red-500 bg-red-50 p-2 rounded-lg">
                <AlertCircle className="size-4 shrink-0" />
                <span className="font-bold">{result.insertErrors.length}</span> lỗi database
              </div>
            )}

            <p className="text-[var(--fg-muted)] pt-2 border-t border-[var(--border-soft)] text-[11px]">
              Tổng: <strong>{result.totalRows}</strong> dòng trong file
            </p>
          </div>

          {/* Error details */}
          {(result.parseErrors.length > 0 || result.insertErrors.length > 0) && (
            <div className="mt-3 pt-3 border-t border-[var(--border-soft)]">
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1.5">
                Chi tiết lỗi
              </p>
              <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                {[...result.parseErrors, ...result.insertErrors].slice(0, 5).map((err, i) => (
                  <p key={i} className="text-[11px] text-red-500 font-mono">
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
