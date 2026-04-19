"use client";

import { format } from "date-fns";
import { calculateAvailableSlots } from "@/lib/domain/premium-account-math";
import type { MigrationAccountRow, MigrationStatus, MigrationStepRow, MigrationSubscriptionRow } from "./types";

export const MIGRATION_STATUSES: MigrationStatus[] = ["pending", "in_progress", "completed", "failed", "rollback"];

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return format(parsed, "dd/MM/yyyy HH:mm");
}

export function getStatusLabel(status: MigrationStatus) {
  switch (status) {
    case "pending":
      return "Chờ xử lý";
    case "in_progress":
      return "Đang xử lý";
    case "completed":
      return "Hoàn tất";
    case "failed":
      return "Thất bại";
    case "rollback":
      return "Hoàn tác";
    default:
      return status;
  }
}

export function getStatusClass(status: MigrationStatus) {
  switch (status) {
    case "pending":
      return "bg-[#ff9500]/10 text-[#b86a00] border-[#ff9500]/20";
    case "in_progress":
      return "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20";
    case "completed":
      return "bg-[#32d74b]/10 text-[#0f8f2b] border-[#32d74b]/20";
    case "failed":
      return "bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/20";
    case "rollback":
      return "bg-slate-500/10 text-slate-600 border-slate-500/20";
    default:
      return "bg-[var(--surface-light)] text-[var(--fg-muted)] border-[var(--border-soft)]";
  }
}

export function getStepStatusClass(status: MigrationStepRow["step_status"]) {
  switch (status) {
    case "completed":
      return "bg-[#32d74b]/10 text-[#0f8f2b] border-[#32d74b]/20";
    case "in_progress":
      return "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20";
    case "failed":
      return "bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/20";
    default:
      return "bg-[var(--surface-light)] text-[var(--fg-muted)] border-[var(--border-soft)]";
  }
}

export function migrationAccountLabel(account: MigrationAccountRow) {
  const availableSlots = calculateAvailableSlots(account.total_slots, account.used_slots);
  return {
    id: account.id,
    label: account.primary_email,
    sublabel: `${account.service?.name ?? "Dịch vụ"} · còn ${availableSlots} slot · ${account.package?.name ?? "Gói tự do"}`,
    createdAt: account.created_at,
  };
}

export function subscriptionLabel(subscription: MigrationSubscriptionRow) {
  return {
    id: subscription.id,
    label: `${subscription.customer_name} · ${subscription.service_name}`,
    sublabel: `${subscription.account_email} · ${subscription.billing_cycle} · còn ${Math.max(0, subscription.days_remaining)} ngày`,
    createdAt: subscription.created_at,
  };
}

export function jsonPreview(value: unknown) {
  if (value == null) {
    return "N/A";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Không thể hiển thị dữ liệu";
  }
}
