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
    <div className="space-y-4 pb-12">
      <div className="mb-2 hidden grid-cols-12 items-center gap-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-8 py-4 lg:grid">
        <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Dịch vụ & Gói</div>
        <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Tài khoản & Mật khẩu</div>
        <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Mức sử dụng (Slots)</div>
        <div className="col-span-2 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Mốc thuê bao</div>
        <div className="col-span-1 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)] text-right">Thao tác</div>
      </div>

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
        <div className="space-y-3">
          {accounts.map((acc) => {
            const totalSlots = Math.max(1, acc.total_slots);
            const percent = Math.min((acc.used_slots / totalSlots) * 100, 100);
            const isFull = acc.total_slots > 0 && acc.used_slots >= acc.total_slots;

            return (
              <div key={acc.id} className="group relative overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-white transition-[background-color,border-color,box-shadow,color,opacity,transform,width] duration-300">
                <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-12 lg:items-center lg:p-6 lg:px-8">
                  <div className="col-span-1 flex items-center gap-3 lg:col-span-3">
                    <div className="size-10 shrink-0 rounded-xl border border-[var(--accent)]/10 bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent)]/5 text-[var(--accent)] transition-transform group-hover:rotate-12 flex items-center justify-center">
                      <MonitorPlay className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/premium/accounts/${acc.id}`}
                        className="block truncate text-base font-extrabold tracking-tight text-[var(--fg-base)] transition-colors hover:text-[var(--accent)]"
                      >
                        {acc.service?.name || "N/A"}
                      </Link>
                      <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                        {acc.package?.name || "Gói Tự Do"}
                      </span>
                    </div>
                  </div>

                  <div className="col-span-1 lg:col-span-3">
                    <div className="lg:hidden mb-1 text-[10px] font-black uppercase text-[var(--fg-muted)] tracking-widest">Tài khoản & Mật khẩu</div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="line-clamp-1 rounded border border-[var(--border-soft)] bg-[var(--surface-light)] px-2 py-0.5 font-mono text-[13px] font-bold text-[var(--fg-base)]">
                          {acc.primary_email}
                        </span>
                      </div>
                      <span className="ml-1 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Pwd: ••••••••</span>
                    </div>
                  </div>

                  <div className="col-span-1 lg:col-span-3">
                    <div className="lg:hidden mb-1 text-[10px] font-black uppercase text-[var(--fg-muted)] tracking-widest">Mức sử dụng</div>
                    <div className="flex max-w-[200px] flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-tight">
                        <span className={isFull ? "text-[#ff9500]" : "text-[#32d74b]"}>{acc.used_slots} Đã dùng</span>
                        <span className="text-[var(--fg-muted)]">Max {acc.total_slots}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)] p-0.5 shadow-inner">
                        <div
                          className={`h-full rounded-full transition-[background-color,border-color,box-shadow,color,opacity,transform,width] duration-500 ${
                            isFull ? "bg-gradient-to-r from-[#ff9500] to-[#ffcc00]" : "bg-gradient-to-r from-[#32d74b] to-[#63f58c]"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="col-span-1 lg:col-span-2">
                    <div className="lg:hidden mb-1 text-[10px] font-black uppercase text-[var(--fg-muted)] tracking-widest">Mốc thuê bao</div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="size-4 text-[var(--fg-muted)]" />
                        <span className="text-[13px] font-extrabold tracking-tight text-[var(--fg-base)]">
                          {formatAccountDate(acc.subscription_expiry_date)}
                        </span>
                      </div>
                      <span className="ml-6 text-[11px] font-bold text-[var(--fg-muted)]">
                        Bắt đầu: {formatAccountDate(acc.subscription_start_date)}
                      </span>
                      <span className="ml-6 text-[11px] font-bold text-[var(--fg-muted)]">
                        Kiểm tra cuối: {acc.last_connection_check_at ? formatAccountDate(acc.last_connection_check_at) : "Chưa kiểm tra"}
                      </span>
                      <span className={`ml-6 w-fit rounded px-1.5 py-0.5 text-[11px] font-black uppercase tracking-widest ${getAccountStateClass(acc)}`}>
                        {getAccountStateLabel(acc)}
                      </span>
                    </div>
                  </div>

                  <div className="col-span-1 flex justify-start gap-2 lg:col-span-1 lg:justify-end">
                    <div className="lg:hidden mb-1 w-full text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Thao tác</div>
                    <Button
                      variant="ghost"
                      onClick={() => onOpenDetail(acc)}
                      className="size-9 shrink-0 rounded-xl p-0 text-[var(--fg-base)] transition-colors hover:bg-[var(--surface-light)]"
                      title="Mở chi tiết account"
                      aria-label="Mở chi tiết account"
                    >
                      <MonitorPlay className="size-4.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={onOpenSubscriptions}
                      className="size-9 shrink-0 rounded-xl p-0 text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10"
                      title="Xem thuê bao"
                      aria-label="Xem thuê bao"
                    >
                      <Users className="size-4.5" />
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
