"use client";

import { Activity, ArrowRightLeft, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/shared/ui/button";

export function AccountsPageHeader({
  onCreate,
  onOpenMigrations,
  onOpenHealthChecks,
  onRunHealthCheck,
  isRunningHealthCheck,
}: {
  onCreate: () => void;
  onOpenMigrations: () => void;
  onOpenHealthChecks: () => void;
  onRunHealthCheck: () => void;
  isRunningHealthCheck: boolean;
}) {
  return (
    <div className="app-card flex flex-col gap-4 border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] md:flex-row md:items-end md:justify-between gap-4">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-[var(--fg-base)]">Kho Tài Khoản Premium</h1>
        <p className="text-[15px] font-medium text-[var(--fg-muted)]">
          Quản lý kho tài khoản gốc, theo dõi trạng thái thuê bao và luồng migration đang chờ xử lý
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="secondary"
          onClick={onOpenHealthChecks}
          className="flex items-center gap-2 rounded-[1rem] px-6 py-2.5 text-sm font-bold"
        >
          <Activity className="size-5" />
          Sức khỏe hệ thống
        </Button>
        <Button
          variant="secondary"
          onClick={onRunHealthCheck}
          isLoading={isRunningHealthCheck}
          className="flex items-center gap-2 rounded-[1rem] px-6 py-2.5 text-sm font-bold"
        >
          <RefreshCw className="size-5" />
          Kiểm tra kết nối
        </Button>
        <Button
          variant="secondary"
          onClick={onOpenMigrations}
          className="flex items-center gap-2 rounded-[1rem] px-6 py-2.5 text-sm font-bold"
        >
          <ArrowRightLeft className="size-5" />
          Xem migrations
        </Button>
        <Button
          onClick={onCreate}
          className="flex items-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-6 py-2.5 text-sm font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-all hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
        >
          <Plus className="size-5" /> Thêm Tài Khoản Gốc
        </Button>
      </div>
    </div>
  );
}
