"use client";

import { useState } from "react";
import { Download, FileJson, FileSpreadsheet, ShieldCheck, CalendarClock } from "lucide-react";
import { SectionCard } from "@/shared/ui/section-card";
import { Button } from "@/shared/ui/button";
import { appToast } from "@/shared/ui/app-toast";

type ExportTarget = "orders" | "customers" | "backup";

async function downloadAttachment(url: string, fileNameFallback: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Không thể tải dữ liệu từ ${url}`);
  }

  const blob = await response.blob();
  const filename =
    response.headers.get("content-disposition")?.match(/filename=\"?([^\";]+)\"?/)?.[1] ??
    fileNameFallback;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function PlatformExportPanel() {
  const [loadingTarget, setLoadingTarget] = useState<ExportTarget | null>(null);

  async function handleDownload(target: ExportTarget) {
    setLoadingTarget(target);
    try {
      if (target === "orders") {
        await downloadAttachment("/api/orders/export", `orders_export_${new Date().toISOString().split("T")[0]}.csv`);
        appToast.success("Đã tải CSV đơn hàng");
        return;
      }

      if (target === "customers") {
        await downloadAttachment("/api/customers/export", `customers_${new Date().toISOString().split("T")[0]}.xlsx`);
        appToast.success("Đã tải workbook khách hàng");
        return;
      }

      await downloadAttachment("/api/settings/platform/export", `platform_backup_${new Date().toISOString().split("T")[0]}.json`);
      appToast.success("Đã tải backup JSON");
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : "Không thể tải dữ liệu");
    } finally {
      setLoadingTarget(null);
    }
  }

  return (
    <SectionCard
      title="Backup & Data Export"
      description=""
      action={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
          <ShieldCheck className="size-4" />
          Ready
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleDownload("orders")}
              isLoading={loadingTarget === "orders"}
              className="h-auto justify-start gap-3 rounded-2xl border-[var(--border-soft)] bg-white px-4 py-4 text-left"
            >
              <Download className="size-4 text-[var(--accent)]" />
              <span className="flex flex-col items-start">
                <span className="text-[12px] font-bold">Orders CSV</span>
                <span className="text-[10px] font-medium text-[var(--fg-muted)]">Đơn hàng & tài chính</span>
              </span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => handleDownload("customers")}
              isLoading={loadingTarget === "customers"}
              className="h-auto justify-start gap-3 rounded-2xl border-[var(--border-soft)] bg-white px-4 py-4 text-left"
            >
              <FileSpreadsheet className="size-4 text-emerald-600" />
              <span className="flex flex-col items-start">
                <span className="text-[12px] font-bold">Customers XLSX</span>
                <span className="text-[10px] font-medium text-[var(--fg-muted)]">Danh sách khách hàng</span>
              </span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => handleDownload("backup")}
              isLoading={loadingTarget === "backup"}
              className="h-auto justify-start gap-3 rounded-2xl border-[var(--border-soft)] bg-white px-4 py-4 text-left"
            >
              <FileJson className="size-4 text-violet-600" />
              <span className="flex flex-col items-start">
                <span className="text-[12px] font-bold">Full Backup JSON</span>
                <span className="text-[10px] font-medium text-[var(--fg-muted)]">Customers / orders / kho / settings</span>
              </span>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)]/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">
            <CalendarClock className="size-4 text-[var(--accent)]" />
            Lịch báo cáo tự động
          </div>
          <ul className="space-y-2 text-[12px] font-medium text-[var(--fg-base)]">
            <li className="flex items-start gap-2">
              <span className="mt-1 size-1.5 rounded-full bg-[var(--accent)]" />
              Báo cáo doanh thu chạy bằng cron hàng ngày và hàng tuần.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 size-1.5 rounded-full bg-[var(--accent)]" />
              Nhắc hạn đơn dùng T-7, T-3, T-1 theo cấu hình trong reminder config.
            </li>
          </ul>
        </div>
      </div>
    </SectionCard>
  );
}
