"use client";

import { format } from "date-fns";

export const HEALTH_CHECK_STATUSES = ["working", "error", "unknown"] as const;
export const HEALTH_CHECK_TYPES = ["api", "manual", "scheduled"] as const;

export type HealthCheckStatus = (typeof HEALTH_CHECK_STATUSES)[number];
export type HealthCheckType = (typeof HEALTH_CHECK_TYPES)[number];
export type HealthCheckStatusFilter = HealthCheckStatus | "all";
export type HealthCheckTypeFilter = HealthCheckType | "all";

export function formatHealthCheckStatus(status: string | null | undefined): string {
  switch (status) {
    case "working":
      return "Đang ổn";
    case "error":
      return "Lỗi";
    case "unknown":
      return "Chưa rõ";
    default:
      return status ?? "N/A";
  }
}

export function formatHealthCheckType(type: string | null | undefined): string {
  switch (type) {
    case "api":
      return "API";
    case "manual":
      return "Thủ công";
    case "scheduled":
      return "Theo lịch";
    default:
      return type ?? "N/A";
  }
}

export function formatHealthCheckTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "N/A";
  }

  try {
    return format(new Date(value), "dd/MM/yyyy HH:mm");
  } catch {
    return value;
  }
}

export function formatPremiumAccountStatus(status: string | null | undefined): string {
  switch (status) {
    case "active":
      return "Hoạt động";
    case "removed":
      return "Đã xoá";
    case "suspended":
      return "Tạm ngưng";
    default:
      return status ?? "N/A";
  }
}

export function formatConnectionStatus(status: string | null | undefined): string {
  switch (status) {
    case "working":
      return "Đang ổn";
    case "error":
      return "Lỗi";
    case "unknown":
      return "Chưa rõ";
    case "manual_check_needed":
      return "Cần kiểm tra";
    default:
      return status ?? "N/A";
  }
}

export function getStatusPillClass(status: string | null | undefined): string {
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

export function getCheckTypePillClass(type: string | null | undefined): string {
  switch (type) {
    case "api":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "manual":
      return "border-[var(--accent)]/20 bg-[var(--accent)]/8 text-[var(--accent)]";
    case "scheduled":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    default:
      return "border-[var(--border-soft)] bg-[var(--surface-light)] text-[var(--fg-muted)]";
  }
}

export function getConnectionStatusClass(status: string | null | undefined): string {
  switch (status) {
    case "working":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "error":
      return "border-red-200 bg-red-50 text-red-700";
    case "manual_check_needed":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "unknown":
      return "border-[var(--border-soft)] bg-[var(--surface-light)] text-[var(--fg-muted)]";
    default:
      return "border-[var(--border-soft)] bg-[var(--surface-light)] text-[var(--fg-muted)]";
  }
}
