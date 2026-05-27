"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Activity,
  AlertCircle,
  ClipboardCopy,
  Copy,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { appToast } from "@/shared/lib/toast";
import { ActionMenu } from "@/shared/ui/action-menu";
import { Button } from "@/shared/ui/button";
import { SlideOverDrawer } from "@/shared/ui/slide-over-drawer";
import { cn } from "@/lib/utils";
import type { HealthCheckLogRow, PremiumServiceOption } from "../types";
import {
  formatConnectionStatus,
  formatHealthCheckStatus,
  formatHealthCheckTimestamp,
  formatHealthCheckType,
  formatPremiumAccountStatus,
  getCheckTypePillClass,
  getConnectionStatusClass,
} from "../utils";

interface HealthCheckLogDrawerProps {
  isOpen: boolean;
  log: HealthCheckLogRow | null;
  service: PremiumServiceOption | null;
  onClose: () => void;
  onRunAgain: (accountId: string) => void;
}

function DrawerMetric({
  label,
  value,
  accent = "text-[var(--fg-base)]",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[1rem] border border-[var(--border-soft)] bg-white/85 p-3.5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">{label}</p>
      <p className={cn("mt-1 text-[14px] font-black tracking-tight", accent)}>{value}</p>
    </div>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">{label}</span>
      <span className="max-w-[70%] text-right text-[13px] font-bold text-[var(--fg-base)]">{value}</span>
    </div>
  );
}

function getStatusTone(status: string | null | undefined) {
  switch (status) {
    case "working":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "error":
      return "border-red-200 bg-red-50 text-red-700";
    case "unknown":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-[var(--border-soft)] bg-[var(--surface-light)] text-[var(--fg-muted)]";
  }
}

export function HealthCheckLogDrawer({
  isOpen,
  log,
  service,
  onClose,
  onRunAgain,
}: HealthCheckLogDrawerProps) {
  const account = log?.premium_accounts ?? null;

  const copyToClipboard = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      appToast.success(message);
    } catch (error) {
      console.error("[copyHealthCheckLog]", error);
      appToast.error("Không thể sao chép vào clipboard");
    }
  };

  const infoCards = useMemo(() => {
    if (!log) {
      return [];
    }

    return [
      {
        label: "Log ID",
        value: log.id,
      },
      {
        label: "Tenant ID",
        value: log.account_id,
      },
      {
        label: "Premium account",
        value: log.premium_account_id,
      },
      {
        label: "Service type",
        value: log.service_type_id,
      },
    ];
  }, [log]);

  const headerTitle = log ? `${log.premium_accounts?.primary_email ?? log.premium_account_id}` : "Chi tiết log health check";

  if (!isOpen) {
    return null;
  }

  return (
    <SlideOverDrawer isOpen={isOpen} onClose={onClose} title={headerTitle} width="max-w-2xl">
      {log ? (
        <div className="space-y-5">
          <section className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,250,244,0.88))] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--fg-muted)]">Premium health log</p>
                <h3 className="mt-1 truncate text-[22px] font-black tracking-tight text-[var(--fg-base)]">
                  {account?.primary_email ?? log.premium_account_id}
                </h3>
                <p className="mt-2 text-[13px] text-[var(--fg-muted)]">
                  Log #{log.id.slice(0, 8)} · {formatHealthCheckTimestamp(log.check_timestamp)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest", getStatusTone(log.current_status))}>
                    {log.current_status === "error" ? (
                      <AlertCircle className="size-3.5" />
                    ) : log.current_status === "working" ? (
                      <ShieldCheck className="size-3.5" />
                    ) : (
                      <Activity className="size-3.5" />
                    )}
                    {formatHealthCheckStatus(log.current_status)}
                  </span>
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest", getCheckTypePillClass(log.check_type))}>
                    <Zap className="size-3.5" />
                    {formatHealthCheckType(log.check_type)}
                  </span>
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest", getConnectionStatusClass(account?.connection_status ?? null))}>
                    {formatConnectionStatus(account?.connection_status ?? null)}
                  </span>
                  <span className="rounded-full border border-[var(--border-soft)] bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                    {formatPremiumAccountStatus(account?.status ?? null)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ActionMenu
                  items={[
                    {
                      label: "Sao chép ID log",
                      icon: <Copy className="size-4" />,
                      onClick: () => void copyToClipboard(log.id, "Đã sao chép ID log"),
                    },
                    {
                      label: "Sao chép ID tài khoản",
                      icon: <Copy className="size-4" />,
                      onClick: () => void copyToClipboard(log.premium_account_id, "Đã sao chép ID tài khoản"),
                    },
                    {
                      label: "Sao chép ID service",
                      icon: <Copy className="size-4" />,
                      onClick: () => void copyToClipboard(log.service_type_id, "Đã sao chép ID service"),
                    },
                  ]}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onRunAgain(log.premium_account_id)}
                  className="rounded-[1rem] px-4 py-2.5 text-[13px] font-bold"
                >
                  <RefreshCw className="size-4" />
                  Chạy lại
                </Button>
                <Link
                  href="/premium/accounts"
                  className="inline-flex items-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-[background-color,border-color,box-shadow,color,opacity,transform,width] hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
                >
                  <ExternalLink className="size-4" />
                  Kho tài khoản
                </Link>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DrawerMetric
                label="Account"
                value={account?.primary_email ?? log.premium_account_id}
                accent="text-[var(--accent)]"
              />
              <DrawerMetric
                label="Service"
                value={service ? service.name : log.service_type_id}
              />
              <DrawerMetric
                label="Response"
                value={log.response_time_ms != null ? `${log.response_time_ms} ms` : "N/A"}
              />
              <DrawerMetric
                label="Updated"
                value={formatHealthCheckTimestamp(log.updated_at)}
              />
            </div>
          </section>

          <section className="rounded-[1.4rem] border border-[var(--border-soft)] bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-[14px] font-bold text-[var(--fg-base)]">Ngữ cảnh tài khoản và service</h4>
                <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                  Dữ liệu này giúp nhìn nhanh trạng thái account, service và mối liên hệ với log đang mở.
                </p>
              </div>
              {service ? (
                <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)] px-2.5 py-1 text-[11px] font-bold text-[var(--fg-muted)]">
                  {service.category}
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Tài khoản</p>
                <div className="mt-3 space-y-3">
                  <MetaRow label="Email" value={account?.primary_email ?? "N/A"} />
                  <MetaRow label="Trạng thái" value={formatPremiumAccountStatus(account?.status ?? null)} />
                  <MetaRow label="Kết nối" value={formatConnectionStatus(account?.connection_status ?? null)} />
                </div>
              </div>

              <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Service</p>
                <div className="mt-3 space-y-3">
                  <MetaRow label="Tên" value={service?.name ?? log.service_type_id} />
                  <MetaRow label="Danh mục" value={service?.category ?? "N/A"} />
                  <MetaRow label="Hoạt động" value={service ? (service.is_active ? "Có" : "Không") : "N/A"} />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[1.4rem] border border-[var(--border-soft)] bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-[14px] font-bold text-[var(--fg-base)]">Dấu vết kiểm tra</h4>
                <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                  Đây là phần hữu ích nhất khi cần đọc lại một log lỗi hoặc so sánh trước/sau của account.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <div className="space-y-3">
                {infoCards.map((item) => (
                  <MetaRow key={item.label} label={item.label} value={item.value} />
                ))}
              </div>
              <div className="space-y-3">
                <MetaRow label="Trạng thái trước" value={log.previous_status ?? "N/A"} />
                <MetaRow label="Check time" value={formatHealthCheckTimestamp(log.check_timestamp)} />
                <MetaRow label="Created at" value={formatHealthCheckTimestamp(log.created_at)} />
                <MetaRow label="Updated at" value={formatHealthCheckTimestamp(log.updated_at)} />
              </div>
            </div>

            {log.notes ? (
              <div className="mt-4 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Ghi chú</p>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-[var(--fg-base)]">
                  {log.notes}
                </p>
              </div>
            ) : null}
          </section>

          <section className="rounded-[1.4rem] border border-[var(--border-soft)] bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-[14px] font-bold text-[var(--fg-base)]">Hành động nhanh</h4>
                <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                  Dùng khi cần xác minh account đang lỗi hoặc cần replay lại ngay từ log mở hiện tại.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onRunAgain(log.premium_account_id)}
                className="rounded-[1rem] px-4 py-2.5 text-[13px] font-bold"
              >
                <RefreshCw className="size-4" />
                Chạy lại account
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void copyToClipboard(log.id, "Đã sao chép ID log")}
                className="rounded-[1rem] px-4 py-2.5 text-[13px] font-bold"
              >
                <ClipboardCopy className="size-4" />
                Copy log ID
              </Button>
              <Link
                href="/premium/accounts"
                className="inline-flex items-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-[background-color,border-color,box-shadow,color,opacity,transform,width] hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
              >
                <ExternalLink className="size-4" />
                Mở kho tài khoản
              </Link>
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-[1.3rem] border border-dashed border-[var(--border-soft)] bg-[var(--surface-light)] p-6 text-[13px] text-[var(--fg-muted)]">
          Chưa có dữ liệu log để hiển thị.
        </div>
      )}
    </SlideOverDrawer>
  );
}
