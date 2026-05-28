"use client";

import Link from "next/link";
import { CalendarClock, MonitorPlay, Trash2, Users } from "lucide-react";
import { format } from "date-fns";
import { ActionMenu } from "@/shared/ui/action-menu";
import { Button } from "@/shared/ui/button";
import type { PremiumAccountRow } from "../types";

function formatAccountDate(value?: string | null) {
  if (!value) {
    return "Chưa đặt";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Chưa đặt";
  }

  return format(parsed, "dd/MM/yyyy");
}

function getAccountStateLabel(account: Pick<PremiumAccountRow, "status" | "connection_status">) {
  if (account.connection_status === "manual_check_needed") {
    return "Cần kiểm tra";
  }

  if (account.connection_status === "error") {
    return "Lỗi kết nối";
  }

  switch (account.status) {
    case "active":
      return "Đang hoạt động";
    case "expired":
      return "Đã hết hạn";
    case "suspended":
      return "Tạm ngưng";
    case "cancelled":
      return "Đã hủy";
    default:
      return "Không xác định";
  }
}

function getAccountStateClass(account: Pick<PremiumAccountRow, "status" | "connection_status">) {
  if (account.connection_status === "manual_check_needed") {
    return "bg-[#ff9500]/10 text-[#b86a00]";
  }

  if (account.connection_status === "error" || account.status === "expired") {
    return "bg-[var(--danger)]/10 text-[var(--danger)]";
  }

  return "bg-[var(--accent)]/10 text-[var(--accent)]";
}

export function AccountsTable({
  accounts,
  isLoading,
  onOpenDetail,
  onOpenSubscriptions,
  onDelete,
}: {
  accounts: PremiumAccountRow[];
  isLoading: boolean;
  onOpenDetail: (account: PremiumAccountRow) => void;
  onOpenSubscriptions: () => void;
  onDelete: (account: PremiumAccountRow) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-[var(--border-soft)] border-dashed bg-white p-12">
        <div className="size-10 animate-spin rounded-full border-4 border-[var(--border-soft)] border-t-[var(--accent)]" />
        <p className="mt-4 text-[13px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
          Đang tải kho tài khoản...
        </p>
      </div>
    );
  }

  return (
    <div className="pb-12">
      {accounts.length === 0 ? (
        <div className="rounded-3xl border border-[var(--border-soft)] border-dashed bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)]">
            <MonitorPlay className="size-8 text-[var(--fg-muted)]" />
          </div>
          <p className="text-[15px] font-extrabold text-[var(--fg-base)] mb-1">Kho đang trống</p>
          <p className="text-[13px] text-[var(--fg-muted)] font-medium">
            Bắt đầu bằng cách thêm tài khoản gốc đầu tiên vào hệ thống.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {accounts.map((acc) => {
            const totalSlots = Math.max(1, acc.total_slots);
            const percent = Math.min((acc.used_slots / totalSlots) * 100, 100);
            const isFull = acc.total_slots > 0 && acc.used_slots >= acc.total_slots;

            return (
              <article
                key={acc.id}
                className="group relative overflow-hidden rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.03)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.07)]"
              >
                {/* Header card: Service Name, Package Name & Connection Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent)]/5 text-[var(--accent)] transition-transform group-hover:rotate-12">
                      <MonitorPlay className="size-4.5" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/premium/accounts/${acc.id}`}
                        className="block truncate text-[14px] font-black text-[var(--fg-base)] transition-colors hover:text-[var(--accent)]"
                      >
                        {acc.service?.name || "N/A"}
                      </Link>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                        {acc.package?.name || "Gói Tự Do"}
                      </p>
                    </div>
                  </div>

                  <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${getAccountStateClass(acc)}`}>
                    {getAccountStateLabel(acc)}
                  </span>
                </div>

                {/* Account email representation */}
                <div className="mt-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)]/50 p-3 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[12px] font-extrabold text-[var(--fg-base)]">
                    {acc.primary_email}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--fg-muted)] tracking-wider shrink-0 uppercase">Pwd: ••••••••</span>
                </div>

                {/* Progress slots bar */}
                <div className="mt-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                    <span className={isFull ? "text-[#ff9500]" : "text-emerald-600"}>
                      {acc.used_slots} slot đã dùng
                    </span>
                    <span className="text-[var(--fg-muted)]">Max {acc.total_slots} slot</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 border border-[var(--border-soft)]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isFull ? "bg-gradient-to-r from-[#ff9500] to-[#ffcc00]" : "bg-gradient-to-r from-emerald-500 to-teal-400"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Expiry mốc thuê bao info */}
                <div className="mt-4 rounded-xl border border-[var(--border-soft)] bg-white px-3.5 py-2.5 flex items-center justify-between text-[11px] font-semibold text-[var(--fg-muted)]">
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="size-3.5 text-[var(--fg-muted)]" />
                    <span>Hết hạn:</span>
                    <span className="font-extrabold text-[var(--fg-base)]">
                      {formatAccountDate(acc.subscription_expiry_date)}
                    </span>
                  </div>
                  <span className="text-[10px] italic">
                    Bắt đầu: {formatAccountDate(acc.subscription_start_date)}
                  </span>
                </div>

                {/* Actions footer */}
                <div className="mt-4 flex items-center justify-between border-t border-[var(--border-soft)] pt-3.5">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onOpenDetail(acc)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold h-8"
                  >
                    <MonitorPlay className="size-3.5" />
                    Chi tiết
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={onOpenSubscriptions}
                      className="inline-flex items-center justify-center size-8 rounded-full p-0"
                      title="Xem thuê bao liên quan"
                    >
                      <Users className="size-4 text-[var(--accent)]" />
                    </Button>
                    <ActionMenu
                      items={[
                        {
                          label: "Mở chi tiết account",
                          icon: <MonitorPlay className="size-4" />,
                          onClick: () => onOpenDetail(acc),
                        },
                        {
                          label: "Xóa tài khoản",
                          icon: <Trash2 className="size-4" />,
                          onClick: () => onDelete(acc),
                          variant: "danger" as const,
                        },
                      ]}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
