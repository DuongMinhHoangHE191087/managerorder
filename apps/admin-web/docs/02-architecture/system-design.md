# 🏗️ SYSTEM DESIGN - Premium Accounts System

**Version:** 2.0 Final  
**Date:** March 5, 2026  
**Database:** Supabase PostgreSQL  
**Status:** Production-Ready  

---

## 📐 KIẾN TRÚC HỆ THỐNG (ARCHITECTURE)

### **Overview**
```
┌─────────────────────────────────────────────────────┐
│                 CLIENT LAYER                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Next.js  │  │  React   │  │Tailwind/ │          │
│  │   App    │  │Components│  │ shadcn/ui│          │
│  └──────────┘  └──────────┘  └──────────┘          │
└─────────────────────────────────────────────────────┘
                        ↓ HTTPS
┌─────────────────────────────────────────────────────┐
│              API LAYER (Next.js API)                │
│  ┌──────────────────────────────────────┐           │
│  │ /api/premium/                        │           │
│  │   ├─ accounts/ (CRUD)                │           │
│  │   ├─ subscriptions/ (CRUD + renew)   │           │
│  │   ├─ migrations/ (account switch)    │           │
│  │   └─ health-checks/ (connection)     │           │
│  └──────────────────────────────────────┘           │
│  ┌──────────────────────────────────────┐           │
│  │ Middleware:                          │           │
│  │   ├─ JWT Authentication              │           │
│  │   ├─ Multi-tenant isolation          │           │
│  │   └─ Rate limiting                   │           │
│  └──────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
                        ↓ SQL
┌─────────────────────────────────────────────────────┐
│         DATABASE LAYER (Supabase PostgreSQL)        │
│  ┌──────────────────────────────────────┐           │
│  │ 10 Tables:                           │           │
│  │   1. premium_service_types           │           │
│  │   2. premium_packages                │           │
│  │   3. premium_accounts ←─ KHO HÀNG    │           │
│  │   4. premium_account_users ←─ SLOTS  │           │
│  │   5. customer_premium_subscriptions  │           │
│  │   6. premium_account_health_logs     │           │
│  │   7. premium_account_user_history    │           │
│  │   8. subscription_renewals           │           │
│  │   9. account_migrations              │           │
│  │  10. account_migration_history       │           │
│  └──────────────────────────────────────┘           │
│  ┌──────────────────────────────────────┐           │
│  │ Existing Tables (unchanged):         │           │
│  │   - accounts (sellers)               │           │
│  │   - users                            │           │
│  │   - customers                        │           │
│  │   - orders                           │           │
│  │   - payments                         │           │
│  └──────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│              BACKGROUND JOBS (Cron)                 │
│  ┌──────────────────────────────────────┐           │
│  │ Daily at 2:00 AM:                    │           │
│  │   ├─ Health checks (Duolingo API)    │           │
│  │   ├─ Expiry reminders (7 days)       │           │
│  │   └─ Renewal notifications           │           │
│  └──────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│           EXTERNAL INTEGRATIONS                     │
│  ┌──────────────────────────────────────┐           │
│  │ - Duolingo API (health checks)       │           │
│  │ - Email service (notifications)      │           │
│  │ - Payment gateway (charge/refund)    │           │
│  └──────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
```

---

## 🗂️ DATABASE SCHEMA DESIGN

### **Entity Relationship Diagram**

```
accounts (seller) ←──────────────────────┐
    ↓                                    │
    ├─→ premium_service_types            │
    │       ├─ name (ChatGPT, Duolingo)  │
    │       ├─ supportsConnectionCheck   │
    │       └─ connectionCheckApiUrl     │
    │       ↓                             │
    │   premium_packages                 │
    │       ├─ packageType (Family/...)  │
    │       ├─ slots (default 5)         │
    │       ├─ isFlexibleSlots           │
    │       ├─ renewalPriceFactor        │
    │       └─ supportedCycles (JSON)    │
    │       ↓                             │
    │   premium_accounts ←─ KHO HÀNG     │
    │       ├─ primaryEmail              │
    │       ├─ primaryPasswordEncrypted  │
    │       ├─ totalSlots (flexible)     │
    │       ├─ usedSlots                 │
    │       ├─ subscriptionExpiryDate    │
    │       ├─ status                    │
    │       ├─ connectionStatus          │
    │       └─ billingCycle              │
    │       ↓                             │
    │   ┌───────────────┬────────────────┤
    │   ↓               ↓                ↓
    │   premium_account_users     premium_account_health_logs
    │   ├─ userEmail              ├─ checkTimestamp
    │   ├─ emailChangeHistory     ├─ connectionTest
    │   ├─ passwordChangeCount    └─ currentStatus
    │   └─ status                       ↓
    │   ↓                    premium_account_user_history
    │   customer_premium_subscriptions  ├─ actionType
    │       ├─ billingCycle             ├─ oldValue/newValue
    │       ├─ originalPrice            └─ performedBy
    │       ├─ renewalStatus            
    │       ├─ refundAmount             
    │       └─ migrationFields          
    │       ↓                             
    │   ┌───────────────┬────────────────┤
    │   ↓               ↓                │
    │   subscription_renewals  account_migrations
    │   ├─ customerResponse    ├─ sourceAccountId
    │   ├─ refundCalculated    ├─ targetAccountId
    │   └─ refundAmount        ├─ reason
    │                          └─ status
    │                          ↓
    │                 account_migration_history
    │                          ├─ oldStatus/newStatus
    │                          ├─ action
    │                          └─ timestamp
    │
customers ←─────────────────────────────┘
    └─→ customer_premium_subscriptions
    └─→ subscription_renewals

orders ←────────────────────────────────┐
    ├─ isPremiumAccountOrder            │
    ├─ isRenewalOrder                   │
    └─ isMigrationOrder                 │
    └─→ customer_premium_subscriptions  │
    └─→ subscription_renewals           │
```

---

## 📋 10 DATABASE TABLES

### **1. premium_service_types**
**Purpose:** Lưu các dịch vụ (ChatGPT, Duolingo, Netflix, ...)

```
Fields:
├─ id (UUID, PK)
├─ account_id (UUID, FK → accounts)
├─ name (TEXT) ← "ChatGPT Plus", "Duolingo Super"
├─ slug (TEXT) ← "chatgpt", "duolingo" (unique per account)
├─ description (TEXT)
├─ logo_url (TEXT)
├─ website (TEXT)
├─ category (TEXT) ← "ai", "learning", "streaming"
├─ supports_connection_check (BOOLEAN) ← Duolingo: true, others: false
├─ connection_check_type (TEXT) ← "api", "manual"
├─ connection_check_api_url (TEXT) ← Duolingo API endpoint
├─ max_packages_allowed (INTEGER) ← 100
├─ is_active (BOOLEAN)
├─ created_at (TIMESTAMP)
└─ updated_at (TIMESTAMP)

Indexes:
├─ (account_id, slug) UNIQUE
├─ (account_id)
└─ (is_active)

Constraints:
├─ FK: account_id → accounts(id) ON DELETE CASCADE
└─ CHECK: slug ~ '^[a-z0-9-]+$' (lowercase, numbers, hyphens only)
```

---

### **2. premium_packages**
**Purpose:** Mẫu gói bán (Family, Individual, Group)

```
Fields:
├─ id (UUID, PK)
├─ account_id (UUID, FK → accounts)
├─ service_type_id (UUID, FK → premium_service_types)
├─ package_type (TEXT) ← "individual", "family", "group"
├─ name (TEXT) ← "ChatGPT Family 5-person"
├─ description (TEXT)
├─ slots (INTEGER) ← Default 5
├─ is_flexible_slots (BOOLEAN) ← true = seller can change max slots
├─ min_slots (INTEGER) ← 1
├─ max_slots_limit (INTEGER) ← 100 (safety)
├─ price_per_slot (NUMERIC(10,2))
├─ renewal_price_factor (NUMERIC(3,2)) ← 1.0, 0.9, 1.1, etc.
├─ supported_cycles (JSONB) ← ["1month", "3months", "6months", "1year"]
├─ is_active (BOOLEAN)
├─ created_at (TIMESTAMP)
└─ updated_at (TIMESTAMP)

Indexes:
├─ (account_id, service_type_id, package_type) UNIQUE
├─ (account_id)
├─ (service_type_id)
└─ (is_active)

Constraints:
├─ FK: account_id → accounts(id) ON DELETE CASCADE
├─ FK: service_type_id → premium_service_types(id)
├─ CHECK: slots > 0
├─ CHECK: renewal_price_factor > 0
└─ CHECK: package_type IN ('individual', 'family', 'group')
```

---

### **3. premium_accounts** ← KHO HÀNG
**Purpose:** Tài khoản Premium chính (1000+ accounts)

```
Fields:
├─ id (UUID, PK)
├─ account_id (UUID, FK → accounts) ← Seller
├─ service_type_id (UUID, FK → premium_service_types)
├─ package_id (UUID, FK → premium_packages)
├─ primary_email (TEXT) ← Email chính
├─ primary_password_encrypted (TEXT) ← MÃ HÓA AES-256
├─ join_link (TEXT)
├─ total_slots (INTEGER) ← Flexible (seller can change)
├─ used_slots (INTEGER) ← Default 1
├─ available_slots (INTEGER) ← GENERATED: total_slots - used_slots
├─ billing_cycle (TEXT) ← "1month", "3months", "6months", "1year"
├─ subscription_start_date (TIMESTAMP)
├─ subscription_expiry_date (TIMESTAMP)
├─ days_remaining (INTEGER) ← GENERATED: (expiry_date - today)
├─ auto_renewal (BOOLEAN) ← Default false
├─ manual_renewal (BOOLEAN) ← Default true
├─ status (TEXT) ← "active", "expiring_soon", "expired", "migration_needed", ...
├─ connection_status (TEXT) ← "unknown", "connected", "error", "expired"
├─ last_checked_at (TIMESTAMP)
├─ last_connection_check_result (BOOLEAN)
├─ last_connection_error (TEXT)
├─ connection_check_count (INTEGER)
├─ last_renewal_date (TIMESTAMP)
├─ renewal_count (INTEGER)
├─ next_renewal_date (TIMESTAMP)
├─ notes (TEXT)
├─ created_at (TIMESTAMP)
├─ updated_at (TIMESTAMP)
└─ deleted_at (TIMESTAMP) ← Soft delete

Indexes:
├─ (primary_email) UNIQUE WHERE deleted_at IS NULL
├─ (account_id, primary_email) UNIQUE WHERE deleted_at IS NULL
├─ (account_id)
├─ (status)
├─ (connection_status)
├─ (subscription_expiry_date)
├─ (service_type_id)
└─ (status, subscription_expiry_date) ← Find expiring

Constraints:
├─ FK: account_id → accounts(id) ON DELETE CASCADE
├─ FK: service_type_id → premium_service_types(id)
├─ FK: package_id → premium_packages(id)
├─ CHECK: total_slots > 0
├─ CHECK: used_slots >= 0
├─ CHECK: used_slots <= total_slots
└─ CHECK: billing_cycle IN ('1month', '3months', '6months', '1year')

Triggers:
├─ update_available_slots: SET available_slots = total_slots - used_slots
├─ update_days_remaining: SET days_remaining = (expiry_date - CURRENT_DATE)
└─ update_status_on_expiry: IF expiry_date <= CURRENT_DATE THEN status = 'expired'
```

---

### **4. premium_account_users** ← SUB-USERS
**Purpose:** Người dùng con (default 5/account)

```
Fields:
├─ id (UUID, PK)
├─ premium_account_id (UUID, FK → premium_accounts)
├─ account_id (UUID, FK → accounts)
├─ user_email (TEXT) ← Email khách cung cấp
├─ user_email_verified (BOOLEAN)
├─ email_verification_code (TEXT)
├─ email_verification_expiry (TIMESTAMP)
├─ user_password_encrypted (TEXT) ← Optional
├─ user_full_name (TEXT)
├─ phone_number (TEXT)
├─ email_change_history (JSONB) ← [{date, oldEmail, newEmail, reason}]
├─ last_email_changed_at (TIMESTAMP)
├─ last_email_changed_by (TEXT) ← "self" or admin_id
├─ password_change_count (INTEGER)
├─ last_password_changed_at (TIMESTAMP)
├─ role (TEXT) ← "owner", "member", "viewer"
├─ join_date (TIMESTAMP)
├─ last_active_date (TIMESTAMP)
├─ last_active_ip (TEXT)
├─ status (TEXT) ← "active", "inactive", "removed", "migration_pending"
├─ created_at (TIMESTAMP)
├─ updated_at (TIMESTAMP)
└─ deleted_at (TIMESTAMP)

Indexes:
├─ (premium_account_id, user_email) UNIQUE WHERE deleted_at IS NULL
├─ (premium_account_id)
├─ (account_id)
├─ (user_email)
└─ (status)

Constraints:
├─ FK: premium_account_id → premium_accounts(id) ON DELETE CASCADE
├─ FK: account_id → accounts(id)
├─ CHECK: role IN ('owner', 'member', 'viewer')
└─ CHECK: status IN ('active', 'inactive', 'paused', 'removed', 'migration_pending')

Triggers:
├─ log_email_change: INSERT INTO premium_account_user_history
└─ log_password_change: INSERT INTO premium_account_user_history
```

---

### **5. customer_premium_subscriptions** ← KHÁCH MUA
**Purpose:** Đơn mua của khách hàng

```
Fields:
├─ id (UUID, PK)
├─ customer_id (UUID, FK → customers)
├─ order_id (UUID, FK → orders)
├─ account_id (UUID, FK → accounts) ← Seller
├─ premium_account_id (UUID, FK → premium_accounts)
├─ premium_account_user_id (UUID, FK → premium_account_users)
├─ purchase_date (TIMESTAMP)
├─ billing_cycle (TEXT)
├─ cycle_months (INTEGER) ← 1, 3, 6, 12
├─ start_date (TIMESTAMP)
├─ expiry_date (TIMESTAMP)
├─ days_remaining (INTEGER) ← GENERATED
├─ original_price (NUMERIC(12,2))
├─ renewal_price (NUMERIC(12,2))
├─ prorated_refund_amount (NUMERIC(12,2)) ← Pre-calculated
├─ renewal_status (TEXT) ← "none", "pending", "confirmed", "denied", ...
├─ renewal_asked_at (TIMESTAMP)
├─ renewal_asked_until (TIMESTAMP)
├─ renewal_confirmed_at (TIMESTAMP)
├─ renewal_denied_at (TIMESTAMP)
├─ renewal_denied_reason (TEXT)
├─ refund_requested (BOOLEAN)
├─ refund_requested_at (TIMESTAMP)
├─ refund_approved_at (TIMESTAMP)
├─ refund_status (TEXT) ← "pending", "approved", "completed"
├─ refund_reason (TEXT)
├─ refund_amount (NUMERIC(12,2))
├─ refund_notes (TEXT)
├─ migrated_from_account_id (UUID)
├─ migrated_to_account_id (UUID)
├─ migration_reason (TEXT)
├─ migration_date (TIMESTAMP)
├─ status (TEXT) ← "active", "waiting_renewal", "renewed", "expired", ...
├─ access_method (TEXT)
├─ last_access_date (TIMESTAMP)
├─ last_access_ip (TEXT)
├─ failed_login_attempts (INTEGER)
├─ notes (TEXT)
├─ created_at (TIMESTAMP)
├─ updated_at (TIMESTAMP)
└─ deleted_at (TIMESTAMP)

Indexes:
├─ (order_id) UNIQUE
├─ (customer_id)
├─ (premium_account_id)
├─ (status)
├─ (renewal_status)
├─ (expiry_date)
└─ (expiry_date, renewal_status) ← Find to ask renewal

Constraints:
├─ FK: customer_id → customers(id)
├─ FK: order_id → orders(id)
├─ FK: account_id → accounts(id)
├─ FK: premium_account_id → premium_accounts(id)
├─ FK: premium_account_user_id → premium_account_users(id)
└─ CHECK: renewal_status IN ('none', 'pending', 'confirmed', 'denied', 'migrated', 'refunded')

Functions:
└─ calculate_prorated_refund():
    RETURN (days_remaining / cycle_months / 30.0) * original_price
```

---

### **6. premium_account_health_logs**
**Purpose:** Lịch sử kiểm tra kết nối (Duolingo)

```
Fields:
├─ id (UUID, PK)
├─ premium_account_id (UUID, FK → premium_accounts)
├─ account_id (UUID, FK → accounts)
├─ service_type_id (UUID, FK → premium_service_types)
├─ check_timestamp (TIMESTAMP)
├─ check_type (TEXT) ← "auto", "manual", "api"
├─ check_source (TEXT) ← "duolingo_api", "seller_report"
├─ connection_test (BOOLEAN)
├─ connection_test_type (TEXT)
├─ response_time (INTEGER) ← milliseconds
├─ previous_status (TEXT)
├─ current_status (TEXT)
├─ error_code (TEXT)
├─ error_message (TEXT)
├─ error_details (JSONB)
├─ sub_users_count (INTEGER)
├─ slots_actually_used (INTEGER)
├─ days_until_expiry (INTEGER)
├─ expiry_warning (BOOLEAN)
├─ checked_by (TEXT) ← "system", admin_id
├─ notes (TEXT)
└─ created_at (TIMESTAMP)

Indexes:
├─ (premium_account_id)
├─ (account_id)
├─ (check_timestamp)
└─ (current_status)

Constraints:
├─ FK: premium_account_id → premium_accounts(id) ON DELETE CASCADE
├─ FK: account_id → accounts(id)
└─ FK: service_type_id → premium_service_types(id)
```

---

### **7. premium_account_user_history**
**Purpose:** Audit trail của sub-users

```
Fields:
├─ id (UUID, PK)
├─ premium_account_user_id (UUID, FK → premium_account_users)
├─ premium_account_id (UUID, FK → premium_accounts)
├─ account_id (UUID, FK → accounts)
├─ action_type (TEXT) ← "created", "email_changed", "password_changed", ...
├─ old_value (JSONB)
├─ new_value (JSONB)
├─ old_email (TEXT)
├─ new_email (TEXT)
├─ email_changed_reason (TEXT)
├─ performed_by (TEXT) ← user_id, "system", "customer_self"
├─ performed_by_type (TEXT) ← "system", "admin", "customer"
├─ reason (TEXT)
├─ notes (TEXT)
├─ ip_address (TEXT)
└─ created_at (TIMESTAMP)

Indexes:
├─ (premium_account_user_id)
├─ (premium_account_id)
├─ (account_id)
├─ (action_type)
└─ (created_at)

Constraints:
├─ FK: premium_account_user_id → premium_account_users(id) ON DELETE CASCADE
├─ FK: premium_account_id → premium_accounts(id)
└─ FK: account_id → accounts(id)
```

---

### **8. subscription_renewals**
**Purpose:** Quản lý gia hạn + refund

```
Fields:
├─ id (UUID, PK)
├─ account_id (UUID, FK → accounts)
├─ original_subscription_id (UUID, FK → customer_premium_subscriptions)
├─ renewal_order_id (UUID, FK → orders)
├─ customer_id (UUID, FK → customers)
├─ premium_account_id (UUID, FK → premium_accounts)
├─ renewal_requested_date (TIMESTAMP)
├─ renewal_confirmed_date (TIMESTAMP)
├─ renewal_date (TIMESTAMP)
├─ new_expiry_date (TIMESTAMP)
├─ new_billing_cycle (TEXT)
├─ new_cycle_months (INTEGER)
├─ original_price (NUMERIC(12,2))
├─ renewal_price (NUMERIC(12,2))
├─ discount (NUMERIC(12,2))
├─ total_price (NUMERIC(12,2))
├─ status (TEXT) ← "pending", "confirmed", "denied", "completed", "refunded"
├─ payment_status (TEXT)
├─ payment_method (TEXT)
├─ customer_response_date (TIMESTAMP)
├─ customer_response (TEXT) ← "accept", "decline"
├─ decline_reason (TEXT)
├─ refund_calculated (BOOLEAN)
├─ refund_amount (NUMERIC(12,2))
├─ refund_calculation_method (TEXT) ← "prorated", "full", "partial"
├─ refund_approved_at (TIMESTAMP)
├─ refund_completed_at (TIMESTAMP)
├─ refund_transaction_id (TEXT)
├─ migrate_to_new_account (BOOLEAN)
├─ new_premium_account_id (UUID)
├─ migration_completed (TIMESTAMP)
├─ notes (TEXT)
├─ created_at (TIMESTAMP)
└─ updated_at (TIMESTAMP)

Indexes:
├─ (original_subscription_id)
├─ (customer_id)
├─ (status)
└─ (customer_response)

Constraints:
├─ FK: account_id → accounts(id)
├─ FK: original_subscription_id → customer_premium_subscriptions(id)
├─ FK: renewal_order_id → orders(id)
├─ FK: customer_id → customers(id)
└─ FK: premium_account_id → premium_accounts(id)
```

---

### **9. account_migrations**
**Purpose:** Chuyển khách sang account khác

```
Fields:
├─ id (UUID, PK)
├─ account_id (UUID, FK → accounts)
├─ subscription_id (UUID, FK → customer_premium_subscriptions)
├─ customer_id (UUID, FK → customers)
├─ source_account_id (UUID, FK → premium_accounts)
├─ target_account_id (UUID, FK → premium_accounts)
├─ source_account_email (TEXT)
├─ target_account_email (TEXT)
├─ source_user_id (UUID)
├─ target_user_id (UUID)
├─ reason (TEXT) ← "account_expired", "upgrade", "downgrade", ...
├─ initiated_by (TEXT) ← "system", admin_id
├─ status (TEXT) ← "pending", "in_progress", "completed", "failed"
├─ started_at (TIMESTAMP)
├─ completed_at (TIMESTAMP)
├─ details (JSONB)
├─ error_log (TEXT)
├─ notes (TEXT)
├─ created_at (TIMESTAMP)
└─ updated_at (TIMESTAMP)

Indexes:
├─ (subscription_id)
├─ (customer_id)
└─ (status)

Constraints:
├─ FK: account_id → accounts(id)
├─ FK: subscription_id → customer_premium_subscriptions(id)
├─ FK: source_account_id → premium_accounts(id)
└─ FK: target_account_id → premium_accounts(id)
```

---

### **10. account_migration_history**
**Purpose:** Audit trail của migrations

```
Fields:
├─ id (UUID, PK)
├─ migration_id (UUID, FK → account_migrations)
├─ old_status (TEXT)
├─ new_status (TEXT)
├─ timestamp (TIMESTAMP)
├─ performed_by (TEXT)
├─ action (TEXT) ← "initiated", "verified_new_account", "kicked_old_user", ...
├─ details (JSONB)
├─ error_if_any (TEXT)
└─ notes (TEXT)

Indexes:
├─ (migration_id)
└─ (timestamp)

Constraints:
└─ FK: migration_id → account_migrations(id) ON DELETE CASCADE
```

---

## 🔐 SECURITY RULES

### **Rule 1: Password Encryption**
```sql
-- ALL passwords MÃ HÓA AES-256
-- Tables affected:
--   - premium_accounts.primary_password_encrypted
--   - premium_account_users.user_password_encrypted

-- Function:
CREATE OR REPLACE FUNCTION encrypt_password(plain_text TEXT, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_encrypt(plain_text, encryption_key);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrypt_password(encrypted_text TEXT, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_text::bytea, encryption_key);
END;
$$ LANGUAGE plpgsql;

-- Usage:
-- INSERT: primary_password_encrypted = encrypt_password('mypass123', 'secret_key')
-- SELECT: decrypt_password(primary_password_encrypted, 'secret_key')
```

### **Rule 2: Soft Delete**
```sql
-- NEVER DELETE. Always use deleted_at
-- Tables with soft delete:
--   - premium_accounts
--   - premium_account_users
--   - customer_premium_subscriptions

-- Query pattern:
SELECT * FROM premium_accounts 
WHERE deleted_at IS NULL;

-- Delete pattern:
UPDATE premium_accounts 
SET deleted_at = NOW() 
WHERE id = 'xxx';
```

### **Rule 3: Multi-Tenant Isolation**
```sql
-- ALWAYS filter by account_id
-- Row Level Security (RLS):

ALTER TABLE premium_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON premium_accounts
FOR ALL
USING (account_id = current_setting('app.current_account_id')::uuid);

-- Application sets: SET app.current_account_id = 'seller_account_id';
```

### **Rule 4: Audit Trail**
```sql
-- LOG ALL CHANGES to premium_account_user_history
-- Trigger example:

CREATE OR REPLACE FUNCTION log_user_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.user_email != NEW.user_email THEN
    INSERT INTO premium_account_user_history (
      premium_account_user_id,
      premium_account_id,
      account_id,
      action_type,
      old_email,
      new_email,
      old_value,
      new_value,
      performed_by,
      created_at
    ) VALUES (
      NEW.id,
      NEW.premium_account_id,
      NEW.account_id,
      'email_changed',
      OLD.user_email,
      NEW.user_email,
      to_jsonb(OLD),
      to_jsonb(NEW),
      current_setting('app.current_user_id', true),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_email_change_trigger
AFTER UPDATE ON premium_account_users
FOR EACH ROW
EXECUTE FUNCTION log_user_changes();
```

---

## ⚡ PERFORMANCE RULES

### **Rule 5: Computed Fields**
```sql
-- Use GENERATED columns for real-time calculations

ALTER TABLE premium_accounts
ADD COLUMN available_slots INTEGER
GENERATED ALWAYS AS (total_slots - used_slots) STORED;

ALTER TABLE premium_accounts
ADD COLUMN days_remaining INTEGER
GENERATED ALWAYS AS (
  EXTRACT(DAY FROM (subscription_expiry_date - CURRENT_DATE))::INTEGER
) STORED;
```

### **Rule 6: Efficient Queries**
```sql
-- ALWAYS use indexes for common queries

-- Find expiring accounts (within 7 days):
CREATE INDEX idx_expiring_accounts 
ON premium_accounts (subscription_expiry_date, status)
WHERE deleted_at IS NULL 
  AND status IN ('active', 'expiring_soon');

-- Find pending renewals:
CREATE INDEX idx_pending_renewals
ON customer_premium_subscriptions (expiry_date, renewal_status)
WHERE renewal_status = 'pending';

-- Find accounts by email (fast lookup):
CREATE INDEX idx_accounts_email
ON premium_accounts (primary_email)
WHERE deleted_at IS NULL;
```

### **Rule 7: Batch Operations**
```sql
-- Use CTEs for complex operations

-- Example: Daily expiry check
WITH expiring_soon AS (
  SELECT id
  FROM premium_accounts
  WHERE subscription_expiry_date <= CURRENT_DATE + INTERVAL '7 days'
    AND status = 'active'
)
UPDATE premium_accounts
SET status = 'expiring_soon'
WHERE id IN (SELECT id FROM expiring_soon);
```

---

## 📝 BUSINESS LOGIC RULES

### **Rule 8: Renewal Flow**
```sql
-- MUST follow this sequence:

-- Step 1: Ask customer (7 days before expiry)
UPDATE customer_premium_subscriptions
SET renewal_status = 'pending',
    renewal_asked_at = NOW(),
    renewal_asked_until = NOW() + INTERVAL '7 days'
WHERE expiry_date <= CURRENT_DATE + INTERVAL '7 days'
  AND renewal_status = 'none';

-- Step 2: If customer confirms
-- (handled in API, then):
UPDATE customer_premium_subscriptions
SET renewal_status = 'confirmed',
    renewal_confirmed_at = NOW(),
    status = 'renewed',
    expiry_date = expiry_date + INTERVAL '1 month' -- or 3/6/12
WHERE id = 'subscription_id';

-- Step 3: If customer denies
-- (calculate refund):
UPDATE customer_premium_subscriptions
SET renewal_status = 'denied',
    renewal_denied_at = NOW(),
    status = 'expired',
    refund_amount = calculate_prorated_refund(id)
WHERE id = 'subscription_id';
```

### **Rule 9: Refund Calculation**
```sql
CREATE OR REPLACE FUNCTION calculate_prorated_refund(subscription_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  sub RECORD;
  remaining_days INTEGER;
  total_days INTEGER;
  refund NUMERIC;
BEGIN
  SELECT * INTO sub
  FROM customer_premium_subscriptions
  WHERE id = subscription_id;
  
  remaining_days := EXTRACT(DAY FROM (sub.expiry_date - CURRENT_DATE));
  total_days := sub.cycle_months * 30;
  
  IF remaining_days < 0 THEN
    remaining_days := 0;
  END IF;
  
  refund := (remaining_days::NUMERIC / total_days::NUMERIC) * sub.original_price;
  
  RETURN ROUND(refund, 2);
END;
$$ LANGUAGE plpgsql;
```

### **Rule 10: Account Migration**
```sql
-- MUST be transactional:

BEGIN;

-- 1. Create new sub-user on target account
INSERT INTO premium_account_users (...)
VALUES (...) RETURNING id INTO new_user_id;

-- 2. Update subscription
UPDATE customer_premium_subscriptions
SET premium_account_id = target_account_id,
    premium_account_user_id = new_user_id,
    migrated_from_account_id = source_account_id,
    migrated_to_account_id = target_account_id,
    migration_date = NOW(),
    status = 'migrated'
WHERE id = subscription_id;

-- 3. Mark old user as removed
UPDATE premium_account_users
SET status = 'removed'
WHERE id = old_user_id;

-- 4. Update slots
UPDATE premium_accounts
SET used_slots = used_slots - 1
WHERE id = source_account_id;

UPDATE premium_accounts
SET used_slots = used_slots + 1
WHERE id = target_account_id;

-- 5. Log migration
INSERT INTO account_migration_history (...)
VALUES (...);

COMMIT;
```

---

## 🎯 CONTEXT PRESERVATION RULES

### **Rule 11: Always Reference Business Requirements**
```
When implementing ANY feature:
1. Check 📋_BUSINESS_REQUIREMENTS_COMPLETE.md
2. Verify requirement number (e.g., Section 6: Renewal)
3. Implement exactly as specified
4. Test against workflow diagram
```

### **Rule 12: Never Delete, Always Soft Delete**
```
Reason: Audit trail, refunds, disputes, warranty
Tables: ALL user-facing tables must have deleted_at
Query: ALWAYS add WHERE deleted_at IS NULL
```

### **Rule 13: Email Change History = Warranty Proof**
```
MUST track in JSONB:
- Old email
- New email
- Date changed
- Changed by whom
- Reason for change

Use case: Customer disputes account ownership
```

### **Rule 14: Duolingo ONLY for Auto-Checks**
```
IF service_type.supports_connection_check = false THEN
  connection_status = 'manual_check_needed'
  NO API calls
  Seller reports status manually
ELSE
  Daily cron job calls API
END IF
```

### **Rule 15: Refund = Prorated ONLY**
```
NEVER full refund unless special case
Formula: (remaining_days / total_days) × original_price
Store in: subscription_renewals.refund_amount
Method: subscription_renewals.refund_calculation_method = 'prorated'
```

---

## ✅ VALIDATION RULES

### **Rule 16: Data Validation**
```sql
-- Total slots must be positive
ALTER TABLE premium_accounts
ADD CONSTRAINT check_total_slots CHECK (total_slots > 0);

-- Used slots cannot exceed total
ALTER TABLE premium_accounts
ADD CONSTRAINT check_used_slots CHECK (used_slots >= 0 AND used_slots <= total_slots);

-- Expiry date must be after start date
ALTER TABLE premium_accounts
ADD CONSTRAINT check_dates CHECK (subscription_expiry_date > subscription_start_date);

-- Renewal price factor must be positive
ALTER TABLE premium_packages
ADD CONSTRAINT check_renewal_factor CHECK (renewal_price_factor > 0);
```

---

## 📂 SUMMARY

**10 Tables:** ✅  
**16 Rules:** ✅  
**Business Logic:** ✅  
**Security:** ✅  
**Performance:** ✅  
**Context Preservation:** ✅  

**Status:** Ready for Supabase SQL implementation

**Next:** Generate actual Supabase SQL schema
