import type { AdminHistoryMeta } from "@/lib/types/admin-history";

export interface PremiumAccountDetailSubscriptionSummary {
  id: string;
  customer_id: string;
  customer_name: string;
  premium_account_user_id: string | null;
  premium_account_user_email: string | null;
  service_type_id: string;
  package_id: string;
  billing_cycle: string;
  cycle_months: number;
  start_date: string;
  expiry_date: string;
  original_price: number;
  final_price: number;
  status: string;
  renewal_status: string;
  days_remaining: number;
  migrated_at: string | null;
  migration_id: string | null;
}

export interface PremiumAccountDetailUserSummary {
  id: string;
  user_email: string;
  status: "active" | "removed" | "suspended";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PremiumAccountDetailRenewalSummary {
  id: string;
  status: string;
  customer_id: string;
  customer_name: string;
  original_subscription_id: string;
  renewal_requested_date: string;
  renewal_confirmed_date: string | null;
  renewal_price: number | null;
  original_price: number | null;
}

export interface PremiumAccountDetailMigrationSummary {
  id: string;
  status: string;
  customer_id: string;
  customer_name: string;
  subscription_id: string;
  source_account_id: string;
  target_account_id: string;
  created_at: string;
  completed_at: string | null;
  reason: string | null;
  notes: string | null;
  terminal_reason: string | null;
}

export interface PremiumAccountHealthCheckSummary {
  id: string;
  check_timestamp: string;
  check_type: "api" | "manual" | "scheduled";
  current_status: "working" | "error" | "unknown";
  previous_status: string | null;
  error_message: string | null;
}

export interface PremiumAccountAuditSummaryItem {
  id: string;
  action_type: string;
  created_at: string;
  created_by: string | null;
  details: Record<string, unknown> | null;
}

export interface PremiumAccountDetailMetrics {
  available_slots: number;
  slot_fill_rate: number;
  active_subscription_count: number;
  expiring_subscription_count: number;
  user_count: number;
  active_user_count: number;
  pending_renewal_count: number;
  pending_migration_count: number;
}

export interface PremiumAccountDetailViewModel {
  id: string;
  account_id: string;
  service_type_id: string;
  package_id: string;
  primary_email: string;
  primary_password_encrypted: string;
  phone_number: string | null;
  total_slots: number;
  used_slots: number;
  available_slots: number;
  subscription_start_date: string | null;
  subscription_expiry_date: string | null;
  status: "active" | "expired" | "suspended" | "cancelled";
  connection_status: "working" | "error" | "manual_check_needed" | null;
  last_connection_check_at: string | null;
  purchase_invoice_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  service: { name: string; slug: string; logo_url: string | null } | null;
  package: { name: string; slug: string; total_slots: number } | null;
  metrics: PremiumAccountDetailMetrics;
  subscriptions: PremiumAccountDetailSubscriptionSummary[];
  users: PremiumAccountDetailUserSummary[];
  renewals: PremiumAccountDetailRenewalSummary[];
  migrations: PremiumAccountDetailMigrationSummary[];
  healthChecks: PremiumAccountHealthCheckSummary[];
  audit: {
    items: PremiumAccountAuditSummaryItem[];
    meta: AdminHistoryMeta;
  };
  isLocalFixture?: boolean;
}

export interface PremiumAccountUpdatePayload {
  primary_email?: string;
  primary_password?: string;
  package_id?: string;
  phone_number?: string | null;
  total_slots?: number;
  subscription_start_date?: string | null;
  subscription_expiry_date?: string | null;
  status?: "active" | "expired" | "suspended" | "cancelled";
  connection_status?: "working" | "error" | "manual_check_needed" | null;
  purchase_invoice_url?: string | null;
  notes?: string | null;
}
