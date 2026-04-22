export type ShellSearchResultKind =
  | "page"
  | "order"
  | "customer"
  | "source_account"
  | "premium_account";

export interface ShellSearchResult {
  id: string;
  kind: ShellSearchResultKind;
  title: string;
  subtitle?: string;
  href: string;
  meta?: string;
  priority: number;
}

export type ShellNotificationSeverity = "info" | "warning" | "critical";

export type ShellNotificationKind =
  | "renewal"
  | "migration"
  | "premium_health"
  | "inventory_capacity"
  | "inventory_expiry";

export interface ShellNotification {
  id: string;
  kind: ShellNotificationKind;
  title: string;
  description: string;
  href?: string;
  severity: ShellNotificationSeverity;
  createdAt: string;
  isRead: boolean;
}
