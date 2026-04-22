export type PremiumMigrationStatus = "pending" | "in_progress" | "completed" | "failed" | "rollback";

export type PremiumMigrationAccountSnapshot = {
  id: string;
  primary_email: string;
  service_type_id: string;
  total_slots: number;
  used_slots: number;
  status: string | null;
  available_slots: number;
} | null;

export type PremiumMigrationListRow = {
  id: string;
  account_id: string;
  subscription_id: string;
  customer_id: string;
  source_account_id: string;
  target_account_id: string;
  source_account_email: string | null;
  target_account_email: string | null;
  source_user_id: string | null;
  target_user_id: string | null;
  reason: string | null;
  initiated_by: string | null;
  status: PremiumMigrationStatus;
  started_at: string;
  completed_at: string | null;
  details: Record<string, unknown> | null;
  error_log: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer_name: string;
  source_account: PremiumMigrationAccountSnapshot;
  target_account: PremiumMigrationAccountSnapshot;
};

export type PremiumMigrationStepRow = {
  step_number: number;
  step_name: string;
  step_status: "pending" | "in_progress" | "completed" | "failed";
  details: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type PremiumMigrationDetailRow = PremiumMigrationListRow & {
  steps: PremiumMigrationStepRow[];
};
