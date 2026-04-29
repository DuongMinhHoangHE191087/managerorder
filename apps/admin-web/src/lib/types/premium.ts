// ============================================
// PREMIUM SYSTEM TYPES
// ============================================
// Generated from Supabase schema
// Date: March 5, 2026
// ============================================

// ============================================
// 1. PREMIUM SERVICE TYPES
// ============================================

export interface PremiumServiceType {
  id: string;
  account_id: string;
  name: string;
  slug: string;
  description?: string | null;
  logo_url?: string | null;
  website?: string | null;
  category?: string | null;
  
  // Connection check
  supports_connection_check: boolean;
  connection_check_type?: 'api' | 'manual' | 'scheduled' | null;
  connection_check_api_url?: string | null;
  
  max_packages_allowed?: number;
  is_active: boolean;
  
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CreatePremiumServiceType {
  account_id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  website?: string;
  category?: string;
  supports_connection_check?: boolean;
  connection_check_type?: 'api' | 'manual' | 'scheduled';
  connection_check_api_url?: string;
  max_packages_allowed?: number;
  is_active?: boolean;
}

export interface UpdatePremiumServiceType extends Partial<CreatePremiumServiceType> {
  updated_at?: string;
}

// ============================================
// 2. PREMIUM PACKAGES
// ============================================

export interface PremiumPackage {
  id: string;
  account_id: string;
  service_type_id: string;
  name: string;
  slug: string;
  description?: string | null;
  
  // Slots configuration
  total_slots: number; // flexible, default 5
  default_price: number;
  
  // Billing cycles
  billing_cycles: ('1month' | '3months' | '6months' | '1year')[];
  
  // Renewal pricing
  allow_flexible_renewal_pricing: boolean;
  renewal_price_factor?: number | null; // 0.9 = discount 10%, 1.1 = markup 10%
  
  features?: Record<string, unknown> | null;
  is_active: boolean;
  sort_order?: number;
  
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CreatePremiumPackage {
  account_id: string;
  service_type_id: string;
  name: string;
  slug: string;
  description?: string;
  total_slots?: number;
  default_price: number;
  billing_cycles: ('1month' | '3months' | '6months' | '1year')[];
  allow_flexible_renewal_pricing?: boolean;
  renewal_price_factor?: number;
  features?: Record<string, unknown>;
  is_active?: boolean;
  sort_order?: number;
}

export interface UpdatePremiumPackage extends Partial<CreatePremiumPackage> {
  updated_at?: string;
}

// ============================================
// 3. PREMIUM ACCOUNTS
// ============================================

export interface PremiumAccount {
  id: string;
  account_id: string;
  service_type_id: string;
  package_id: string;
  
  // Account credentials
  primary_email: string;
  primary_password_encrypted: string; // encrypted
  secondary_emails?: string[] | null;
  phone_number?: string | null;
  
  // Password management
  last_password_changed_at?: string | null;
  password_change_count: number;
  
  // Slots management
  total_slots: number;
  used_slots: number;
  available_slots: number; // computed: total - used
  
  // Subscription
  subscription_start_date: string;
  subscription_expiry_date: string;
  subscription_renewal_count: number;
  
  // Status
  status: 'active' | 'expired' | 'suspended' | 'cancelled';
  connection_status?: 'working' | 'error' | 'manual_check_needed' | null;
  last_connection_check_at?: string | null;
  
  // Metadata
  purchase_invoice_url?: string | null;
  notes?: string | null;
  
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CreatePremiumAccount {
  account_id: string;
  service_type_id: string;
  package_id: string;
  primary_email: string;
  primary_password: string; // will be encrypted
  secondary_emails?: string[];
  phone_number?: string;
  total_slots?: number;
  subscription_start_date: string;
  subscription_expiry_date: string;
  status?: 'active' | 'expired' | 'suspended' | 'cancelled';
  purchase_invoice_url?: string;
  notes?: string;
}

export interface UpdatePremiumAccount extends Partial<Omit<CreatePremiumAccount, 'primary_password'>> {
  primary_password_encrypted?: string;
  updated_at?: string;
}

// ============================================
// 4. PREMIUM ACCOUNT USERS (Sub-users)
// ============================================

export interface PremiumAccountUser {
  id: string;
  premium_account_id: string;
  account_id: string;
  customer_id?: string | null;
  subscription_id?: string | null;
  
  // User info
  user_email: string;
  user_password_encrypted?: string | null;
  phone_number?: string | null;
  
  // Email change tracking (for warranty)
  email_change_history?: Record<string, unknown>[] | null;
  last_email_changed_at?: string | null;
  last_email_changed_by?: string | null;
  
  // Status
  status: 'active' | 'removed' | 'suspended';
  added_at: string;
  removed_at?: string | null;
  
  // Metadata
  notes?: string | null;
  
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CreatePremiumAccountUser {
  account_id: string;
  premium_account_id: string;
  user_email: string;
  customer_id?: string;
  subscription_id?: string;
  notes?: string;
}

export interface UpdatePremiumAccountUser {
  user_email?: string;
  status?: 'active' | 'removed' | 'suspended';
  notes?: string;
  updated_at?: string;
}

export interface PremiumAccountUserHistory {
  id: string;
  account_user_id: string;
  premium_account_id: string;
  account_id: string;
  change_type: 'email_change' | 'password_change' | 'status_change' | 'added' | 'removed';
  old_value?: string | null;
  new_value?: string | null;
  old_email?: string | null;
  new_email?: string | null;
  reason?: string | null;
  changed_by?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  notes?: string | null;
  created_at: string;
}

// ============================================
// 5. CUSTOMER PREMIUM SUBSCRIPTIONS
// ============================================

export interface CustomerPremiumSubscription {
  id: string;
  customer_id: string;
  order_id: string;
  account_id: string;
  premium_account_id: string;
  premium_account_user_id?: string | null;
  
  // Package & billing
  service_type_id: string;
  package_id: string;
  billing_cycle: '1month' | '3months' | '6months' | '1year';
  cycle_months: number;
  
  // Dates
  start_date: string;
  expiry_date: string;
  
  // Pricing
  original_price: number;
  discount?: number;
  final_price: number;
  
  // Renewal management
  renewal_status: 'none' | 'pending' | 'confirmed' | 'denied';
  renewal_asked_at?: string | null;
  renewal_asked_until?: string | null;
  renewal_confirmed_at?: string | null;
  renewal_denied_at?: string | null;
  renewal_denied_reason?: string | null;
  refund_amount?: number | null;
  package_default_price?: number | null;
  renewal_price_factor?: number | null;
  
  // Status
  status: 'active' | 'expired' | 'cancelled' | 'renewed' | 'migrated';
  
  // Migration
  migration_id?: string | null;
  migrated_from_account_id?: string | null;
  migrated_at?: string | null;
  
  // Metadata
  notes?: string | null;
  
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// ============================================
// 6. SUBSCRIPTION RENEWALS
// ============================================

export interface SubscriptionRenewal {
  id: string;
  account_id: string;
  original_subscription_id: string;
  renewal_order_id: string;
  customer_id: string;
  premium_account_id: string;
  
  // Dates
  renewal_requested_date: string;
  renewal_confirmed_date?: string | null;
  renewal_date?: string | null;
  new_expiry_date?: string | null;
  new_billing_cycle?: string | null;
  new_cycle_months?: number | null;
  
  // Pricing
  original_price?: number | null;
  renewal_price?: number | null;
  cost_price?: number | null;
  collected_amount?: number | null;
  profit_amount?: number | null;
  discount?: number;
  total_price?: number | null;
  
  // Status
  status: 'pending' | 'confirmed' | 'denied' | 'completed' | 'failed' | 'refunded';
  payment_status?: string | null;
  payment_method?: string | null;
  
  // Customer response
  customer_response_date?: string | null;
  customer_response?: 'accept' | 'decline' | null;
  decline_reason?: string | null;
  
  // Refund calculation
  refund_calculated: boolean;
  refund_amount?: number | null;
  refund_calculation_method?: 'prorated' | 'full' | 'partial' | null;
  refund_approved_at?: string | null;
  refund_completed_at?: string | null;
  refund_transaction_id?: string | null;
  
  // Migration option
  migrate_to_new_account: boolean;
  new_premium_account_id?: string | null;
  migration_completed?: string | null;
  
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 7. ACCOUNT MIGRATIONS
// ============================================

export interface AccountMigration {
  id: string;
  account_id: string;
  subscription_id: string;
  customer_id: string;
  
  // Migration from/to
  source_account_id: string;
  target_account_id: string;
  source_account_email?: string | null;
  target_account_email?: string | null;
  
  // Sub-users
  source_user_id?: string | null;
  target_user_id?: string | null;
  
  // Reason
  reason?: string | null;
  initiated_by: string;
  
  // Status
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rollback';
  
  started_at: string;
  completed_at?: string | null;
  
  details?: Record<string, unknown> | null;
  error_log?: string | null;
  notes?: string | null;
  
  created_at: string;
  updated_at: string;
}

// ============================================
// CREATE/UPDATE SUBSCRIPTION TYPES
// ============================================

export interface CreateCustomerPremiumSubscription {
  customer_id: string;
  account_id: string;
  order_id?: string;
  premium_account_id: string;
  premium_account_user_id?: string;
  service_type_id: string;
  package_id: string;
  billing_cycle: '1month' | '3months' | '6months' | '1year';
  start_date: string;
  expiry_date: string;
  original_price: number;
  discount?: number;
  final_price: number;
  notes?: string;
}

export interface UpdateCustomerPremiumSubscription
  extends Partial<Omit<CreateCustomerPremiumSubscription, 'customer_id' | 'account_id'>> {
  renewal_status?: 'none' | 'pending' | 'confirmed' | 'denied';
  renewal_denied_reason?: string;
  refund_amount?: number;
  status?: 'active' | 'expired' | 'cancelled' | 'renewed' | 'migrated';
  migration_id?: string;
  updated_at?: string;
}

export interface CreateSubscriptionRenewal {
  account_id: string;
  original_subscription_id: string;
  customer_id: string;
  premium_account_id: string;
  new_billing_cycle?: '1month' | '3months' | '6months' | '1year';
  renewal_price?: number;
  discount?: number;
  total_price?: number;
  migrate_to_new_account?: boolean;
  new_premium_account_id?: string;
  notes?: string;
}

export interface UpdateSubscriptionRenewal extends Partial<Omit<CreateSubscriptionRenewal, 'original_subscription_id' | 'customer_id'>> {
  customer_response?: 'accept' | 'decline';
  decline_reason?: string;
  refund_calculated?: boolean;
  refund_amount?: number;
  refund_calculation_method?: 'prorated' | 'full' | 'partial';
  status?: 'pending' | 'confirmed' | 'denied' | 'completed' | 'failed' | 'refunded';
  payment_status?: string;
  migration_completed?: string;
  updated_at?: string;
}

// ============================================
// 8. HEALTH CHECK LOGS
// ============================================

export interface PremiumAccountHealthLog {
  id: string;
  premium_account_id: string;
  account_id: string;
  service_type_id: string;
  
  // Check info
  check_timestamp: string;
  check_type: 'api' | 'manual' | 'scheduled';
  
  // Status
  current_status: 'working' | 'error' | 'unknown';
  previous_status?: string | null;
  
  // Details
  response_time_ms?: number | null;
  error_message?: string | null;
  error_code?: string | null;
  api_response?: Record<string, unknown> | null;
  
  // Metadata
  checked_by: string;
  notes?: string | null;
  
  created_at: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// QUERY PARAMETERS
// ============================================

export interface QueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  account_id?: string;
}

export interface ServiceTypeQueryParams extends QueryParams {
  category?: string;
  is_active?: boolean;
}

export interface AccountQueryParams extends QueryParams {
  service_type_id?: string;
  package_id?: string;
  status?: 'active' | 'expired' | 'suspended' | 'cancelled';
  has_available_slots?: boolean;
}

export interface SubscriptionQueryParams extends QueryParams {
  customer_id?: string;
  status?: 'active' | 'expired' | 'cancelled' | 'renewed';
  renewal_status?: 'none' | 'pending' | 'confirmed' | 'denied';
  expiring_soon?: boolean; // within 7 days
}

// ============================================
// CREATE/UPDATE MIGRATION TYPES
// ============================================

export interface CreateAccountMigration {
  account_id: string;
  subscription_id: string;
  customer_id: string;
  source_account_id: string;
  target_account_id: string;
  reason?: string;
  notes?: string;
}

export interface AccountMigrationHistory {
  id: string;
  migration_id: string;
  account_id: string;
  step_number: number;
  step_name: string;
  step_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  details?: Record<string, unknown> | null;
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
  created_at: string;
}

// ============================================
// HEALTH CHECK + MIGRATION QUERY PARAMS
// ============================================

export interface RunHealthCheck {
  /** Run check only for this account; omit to check all eligible accounts */
  premium_account_id?: string;
  check_type?: 'api' | 'manual' | 'scheduled';
  notes?: string;
}

export interface HealthCheckQueryParams extends QueryParams {
  premium_account_id?: string;
  service_type_id?: string;
  current_status?: 'working' | 'error' | 'unknown';
  check_type?: 'api' | 'manual' | 'scheduled';
  from_date?: string;
  to_date?: string;
}

export interface MigrationQueryParams extends QueryParams {
  subscription_id?: string;
  customer_id?: string;
  source_account_id?: string;
  target_account_id?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rollback';
}

export interface AccountUserQueryParams extends QueryParams {
  premium_account_id?: string;
  status?: 'active' | 'removed' | 'suspended';
}
