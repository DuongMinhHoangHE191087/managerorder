"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  CircleAlert,
  Loader2,
  ServerCrash,
  Warehouse,
} from "lucide-react";
import { fetcher } from "@/lib/api/fetcher";
import { cn } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import type { ShellNotification } from "@/shared/types/shell";

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

function NotificationIcon({
  kind,
  severity,
}: Pick<ShellNotification, "kind" | "severity">) {
  if (kind === "premium_health") {
    return (
      <ServerCrash
        className={cn(
          "size-4",
          severity === "critical" ? "text-[var(--danger)]" : "text-[#ff9500]",
        )}
      />
    );
  }

  if (kind === "inventory_capacity" || kind === "inventory_expiry") {
    return (
      <Warehouse
        className={cn(
          "size-4",
          severity === "critical" ? "text-[var(--danger)]" : "text-[#ff9500]",
        )}
      />
    );
  }

  if (kind === "migration") {
    return <CircleAlert className="size-4 text-[#ff9500]" />;
  }

  return <AlertTriangle className="size-4 text-[#ff9500]" />;
}

function severityClasses(severity: ShellNotification["severity"]) {
  switch (severity) {
    case "critical":
      return "border-[var(--danger)]/20 bg-[var(--danger)]/5";
    case "warning":
      return "border-[#ff9500]/20 bg-[#ff9500]/5";
    default:
      return "border-[var(--border-soft)] bg-[var(--surface-light)]";
  }
}

export function NotificationsDrawer({
  isOpen,
  onClose,
  onCountChange,
}: NotificationsDrawerProps) {
  const { data: notifications = [], isLoading, isFetching } = useQuery({
    queryKey: queryKeys.notificationsFeed(12),
    queryFn: () => fetcher<ShellNotification[]>("/api/notifications/feed?limit=12"),
    enabled: isOpen,
    placeholderData: keepPreviousData,
    staleTime: 20_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    onCountChange?.(notifications.length);
  }, [notifications.length, onCountChange]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const notificationLabel = useMemo(() => {
    if (notifications.length === 0) {
      return vi.navigation.notifications.emptyTitle;
    }

    return vi.navigation.notifications.count(notifications.length);
  }, [notifications.length]);

  if (!isOpen) {
    return null;
  }

  const isInitialLoading = (isLoading || isFetching) && notifications.length === 0;

  return (
    <>
      <button
        type="button"
        aria-label={vi.navigation.notifications.close}
        className="fixed inset-x-0 bottom-0 bg-slate-900/24"
        style={{
          top: "var(--app-header-height)",
          zIndex: "var(--z-drawer)",
        }}
        onClick={onClose}
      />

      <aside
        className="overlay-surface fixed inset-x-4 bottom-4 rounded-[22px] p-4 sm:left-auto sm:w-[min(420px,calc(100vw-2rem))] sm:p-5"
        style={{
          top: "calc(var(--app-header-height) + 0.75rem)",
          zIndex: 81,
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              {vi.navigation.notifications.title}
            </p>
            <h2 className="text-lg font-black tracking-tight text-[var(--fg-base)]">
              {notificationLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-light)] hover:text-[var(--fg-base)]"
          >
            {isFetching && notifications.length > 0 ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Bell className="size-4" />
            )}
          </button>
        </div>

        <div className="mt-4 max-h-[min(70vh,34rem)] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
          {isInitialLoading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <Loader2 className="size-5 animate-spin text-[var(--accent)]" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="empty-state min-h-[220px]">
              <Bell className="size-8 text-[var(--fg-muted)]/60" />
              <div>
                <p className="text-sm font-bold text-[var(--fg-base)]">
                  {vi.navigation.notifications.emptyStateTitle}
                </p>
                <p className="text-sm text-[var(--fg-muted)]">
                  {vi.navigation.notifications.emptyStateDescription}
                </p>
              </div>
            </div>
          ) : (
            notifications.map((item) => (
              <Link
                key={item.id}
                href={item.href ?? "#"}
                onClick={onClose}
                className={cn(
                  "group flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors hover:border-[var(--accent)]/25 hover:bg-white",
                  severityClasses(item.severity),
                )}
              >
                <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/80">
                  <NotificationIcon kind={item.kind} severity={item.severity} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[var(--fg-base)]">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--fg-muted)]">{item.description}</p>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                    {new Date(item.createdAt).toLocaleString("vi-VN")}
                  </p>
                </div>
                <ChevronRight className="mt-1 size-4 shrink-0 text-[var(--fg-muted)] transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
