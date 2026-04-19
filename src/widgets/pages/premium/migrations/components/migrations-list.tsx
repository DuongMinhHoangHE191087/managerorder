"use client";

import {
  ArrowRightLeft,
  CalendarClock,
  ClipboardList,
  Database,
  User,
  Warehouse,
} from "lucide-react";
import { ActionMenu } from "@/shared/ui/action-menu";
import { Select } from "@/shared/ui/select";
import { MIGRATION_STATUSES, formatDateTime, getStatusLabel } from "../utils";
import type { MigrationListRow, MigrationStatus } from "../types";

export function MigrationsList({
  migrations,
  selectedStatus,
  activeAccountsCount,
  activeSubscriptionsCount,
  isLoading,
  onStatusChange,
  onOpenDetail,
}: {
  migrations: MigrationListRow[];
  selectedStatus: MigrationStatus;
  activeAccountsCount: number;
  activeSubscriptionsCount: number;
  isLoading: boolean;
  onStatusChange: (status: MigrationStatus) => void;
  onOpenDetail: (migrationId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">Danh sách yêu cầu di chuyển</h2>
          <p className="text-[12px] text-[var(--fg-muted)]">
            {activeAccountsCount} kho đích khả dụng · {activeSubscriptionsCount} thuê bao active
          </p>
        </div>
        <Select
          value={selectedStatus}
          onChange={(event) => onStatusChange(event.target.value as MigrationStatus)}
          className="w-full sm:w-56"
        >
          {MIGRATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {getStatusLabel(status)}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 p-12">
          <div className="size-9 animate-spin rounded-full border-4 border-[var(--border-soft)] border-t-[var(--accent)]" />
          <p className="text-[13px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            Đang tải yêu cầu di chuyển...
          </p>
        </div>
      ) : migrations.length === 0 ? (
        <div className="p-12 text-center">
          <Database className="mx-auto mb-3 size-12 text-[var(--fg-muted)] opacity-20" />
          <p className="text-[15px] font-bold text-[var(--fg-base)]">Chưa có yêu cầu di chuyển nào</p>
          <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
            Tạo yêu cầu đầu tiên để bắt đầu theo dõi audit và lịch sử xử lý.
          </p>
        </div>
      ) : (
        <div className="space-y-3 p-4 sm:p-5">
          <div className="hidden grid-cols-12 gap-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-5 py-4 lg:grid">
            <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Khách hàng</div>
            <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Nguồn → Đích</div>
            <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Lý do</div>
            <div className="col-span-2 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Tạo lúc</div>
            <div className="col-span-1 text-right text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Thao tác</div>
          </div>

          {migrations.map((migration) => (
            <article
              key={migration.id}
              className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] transition-shadow hover:shadow-sm"
            >
              <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-12 lg:items-center lg:px-5 lg:py-4">
                <div className="col-span-1 lg:col-span-3">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)] lg:hidden">Khách hàng</p>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] text-[var(--accent)]">
                      <User className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-extrabold text-[var(--fg-base)]">{migration.customer_name}</p>
                      <p className="truncate text-[11px] font-bold text-[var(--fg-muted)]">
                        {migration.subscription_id.slice(0, 8)} · {getStatusLabel(migration.status)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-span-1 lg:col-span-3">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)] lg:hidden">Nguồn → Đích</p>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--fg-base)]">
                      <Warehouse className="size-4 text-[var(--accent)]" />
                      <span className="truncate">{migration.source_account_email ?? "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--fg-base)]">
                      <ArrowRightLeft className="size-4 text-[var(--fg-muted)]" />
                      <span className="truncate">{migration.target_account_email ?? "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-1 lg:col-span-3">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)] lg:hidden">Lý do</p>
                  <p className="line-clamp-2 text-[13px] font-medium text-[var(--fg-base)]">{migration.reason ?? "N/A"}</p>
                </div>

                <div className="col-span-1 lg:col-span-2">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)] lg:hidden">Tạo lúc</p>
                  <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--fg-base)]">
                    <CalendarClock className="size-4 text-[var(--fg-muted)]" />
                    <span>{formatDateTime(migration.created_at)}</span>
                  </div>
                </div>

                <div className="col-span-1 flex justify-start lg:col-span-1 lg:justify-end">
                  <ActionMenu
                    items={[
                      {
                        label: "Xem audit",
                        icon: <ClipboardList className="size-4" />,
                        onClick: () => {
                          void onOpenDetail(migration.id);
                        },
                      },
                    ]}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
