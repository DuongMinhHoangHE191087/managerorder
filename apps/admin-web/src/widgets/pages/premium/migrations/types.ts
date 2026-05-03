"use client";

import type { AccountMigration, CustomerPremiumSubscription, PremiumAccount } from "@/lib/domain/premium-types";

export type MigrationStatus = AccountMigration["status"];

export type MigrationAccountRow = PremiumAccount & {
  service: { name: string; slug: string; logo_url: string | null } | null;
  package: { name: string; slug: string; total_slots: number } | null;
};

export type MigrationTargetUserRow = {
  id: string;
  user_email: string;
  status: "active" | "removed" | "suspended";
  created_at?: string;
  updated_at?: string;
};

export type MigrationSubscriptionRow = CustomerPremiumSubscription & {
  customer_name: string;
  account_email: string;
  service_name: string;
  account: {
    id: string;
    primary_email: string;
    service_type_id: string;
    total_slots: number;
    used_slots: number;
    status: string | null;
    service: { name: string; slug: string; logo_url: string | null } | null;
  } | null;
};

export type MigrationListRow = AccountMigration & {
  customer_name: string;
  source_account_email: string | null;
  target_account_email: string | null;
  source_user_id?: string | null;
  target_user_id?: string | null;
  terminal_reason?: string | null;
  initiated_by: string | null;
  started_at: string;
  completed_at: string | null;
  error_log: string | null;
  updated_at: string;
  source_account: {
    id: string;
    primary_email: string;
    service_type_id: string;
    total_slots: number;
    used_slots: number;
    status: string | null;
  } | null;
  target_account: {
    id: string;
    primary_email: string;
    service_type_id: string;
    total_slots: number;
    used_slots: number;
    status: string | null;
  } | null;
  reason: string | null;
  notes: string | null;
  details: Record<string, unknown> | null;
};

export type MigrationListMeta = {
  total: number;
  status: string;
  page: number;
  limit: number;
  totalPages: number;
};

export type MigrationStepRow = {
  step_number: number;
  step_name: string;
  step_status: "pending" | "in_progress" | "completed" | "failed";
  details: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type MigrationDetailRow = MigrationListRow & {
  steps: MigrationStepRow[];
  target_users?: MigrationTargetUserRow[];
};
