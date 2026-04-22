export interface PremiumServiceType {
  id: string;
  account_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  category: string | null;
  supports_connection_check: boolean;
  /** Computed count joined from the API response */
  package_count?: number;
  connection_check_type: string | null;
  connection_check_api_url: string | null;
  max_packages_allowed: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PremiumPackage {
  id: string;
  account_id: string;
  service_type_id: string;
  package_type: "individual" | "family" | "group";
  name: string;
  description: string | null;
  slots: number;
  is_flexible_slots: boolean;
  min_slots: number;
  max_slots_limit: number;
  price_per_slot: number;
  renewal_price_factor: number;
  supported_cycles: ("1month" | "3months" | "6months" | "1year")[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PremiumAccount {
  id: string;
  account_id: string;
  service_type_id: string;
  package_id: string;
  primary_email: string;
  primary_password_encrypted: string;
  join_link: string | null;
  total_slots: number;
  used_slots: number;
  available_slots: number; // Generated
  billing_cycle: "1month" | "3months" | "6months" | "1year";
  subscription_start_date: string;
  subscription_expiry_date: string;
  days_remaining: number; // Generated
  auto_renewal: boolean;
  manual_renewal: boolean;
  status: "active" | "expiring_soon" | "expired" | "migration_needed" | "paused" | "suspended" | "deleted";
  connection_status: "unknown" | "connected" | "error" | "expired" | "manual_check_needed";
  last_checked_at: string | null;
  last_connection_check_result: boolean | null;
  last_connection_error: string | null;
  connection_check_count: number;
  last_renewal_date: string | null;
  renewal_count: number;
  next_renewal_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PremiumAccountUser {
  id: string;
  premium_account_id: string;
  account_id: string;
  user_email: string;
  user_email_verified: boolean;
  user_password_encrypted: string | null;
  user_full_name: string | null;
  phone_number: string | null;
  password_change_count: number;
  role: "owner" | "member" | "viewer";
  join_date: string;
  status: "active" | "inactive" | "paused" | "removed" | "migration_pending";
  created_at: string;
  updated_at: string;
}

export interface CustomerPremiumSubscription {
  id: string;
  customer_id: string;
  order_id: string;
  account_id: string;
  premium_account_id: string;
  premium_account_user_id: string | null;
  purchase_date: string;
  billing_cycle: string;
  cycle_months: number;
  start_date: string;
  expiry_date: string;
  days_remaining: number;
  original_price: number;
  renewal_price: number | null;
  renewal_status: "none" | "pending" | "confirmed" | "denied" | "migrated" | "refunded";
  status: "active" | "waiting_renewal" | "renewed" | "expired" | "migrated" | "refunded" | "suspended";
  created_at: string;
}

export interface SubscriptionRenewal {
  id: string;
  account_id: string;
  original_subscription_id: string;
  renewal_order_id: string;
  customer_id: string;
  premium_account_id: string;
  renewal_requested_date: string;
  status: "pending" | "confirmed" | "denied" | "completed" | "failed" | "refunded";
  original_price: number;
  renewal_price: number | null;
  created_at: string;
}

export interface AccountMigration {
  id: string;
  account_id: string;
  subscription_id: string;
  customer_id: string;
  source_account_id: string;
  target_account_id: string;
  source_account_email: string | null;
  target_account_email: string | null;
  status: "pending" | "in_progress" | "completed" | "failed" | "rollback";
  created_at: string;
}
