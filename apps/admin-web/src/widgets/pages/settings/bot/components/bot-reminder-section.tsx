"use client";

import dynamic from "next/dynamic";
import { SectionCard } from "@/shared/ui/section-card";
import { vi } from "@/shared/messages/vi";

const ReminderConfigManager = dynamic(
  () => import("@/widgets/pages/settings/components/reminder-config").then((module) => ({ default: module.ReminderConfigManager })),
    {
      loading: () => (
        <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-6 text-sm text-[var(--fg-muted)]">
          {vi.bot.reminder.loading}
        </div>
      ),
    }
);

export function BotReminderSection() {
  return (
    <SectionCard
      title={vi.bot.reminder.title}
      description={vi.bot.reminder.description}
    >
      <ReminderConfigManager />
    </SectionCard>
  );
}
