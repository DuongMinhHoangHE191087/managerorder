"use client";

import dynamic from "next/dynamic";
import { SectionCard } from "@/shared/ui/section-card";

const ReminderConfigManager = dynamic(
  () => import("@/widgets/pages/settings/components/reminder-config").then((module) => ({ default: module.ReminderConfigManager })),
  {
    loading: () => (
      <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-6 text-sm text-[var(--fg-muted)]">
        Đang tải cấu hình nhắc hạn...
      </div>
    ),
  }
);

export function BotReminderSection() {
  return (
    <SectionCard
      title="Reminder Templates"
      description="Điều chỉnh lịch nhắc, template Telegram nội bộ và template Zalo gửi khách hàng."
    >
      <ReminderConfigManager />
    </SectionCard>
  );
}
