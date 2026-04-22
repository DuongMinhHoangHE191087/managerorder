# ✅ DATABASE SETUP COMPLETE GUIDE

**Version:** 3.0 Complete  
**Date:** March 5, 2026  
**Status:** Production Ready  

---

## 🎯 WHAT'S IN THE COMPLETE SCHEMA

### **Total: 14 Tables Organized in 2 Parts**

#### **Part 1: Core System Tables (4 tables)**
```
1. accounts              → Business/Seller accounts
2. users                 → System users (nhiều users/account)
3. customers             → End customers
4. orders                → Orders/transactions
```

#### **Part 2: Premium System Tables (10 tables)**
```
5. premium_service_types           → Services (ChatGPT, Duolingo, ...)
6. premium_packages                → Packages với flexible slots
7. premium_accounts                → Kho premium accounts (1000+)
8. premium_account_users           → Sub-users/slots
9. customer_premium_subscriptions  → Customer subscriptions
10. premium_account_health_logs    → Connection checks
11. premium_account_user_history   → Audit trail
12. subscription_renewals          → Renewal management
13. account_migrations             → Account switching
14. account_migration_history      → Migration steps
```

#### **Plus:**
- ✅ 3 Functions (prorated refund, auto-update slots, timestamps)
- ✅ 10+ Triggers (auto-update used_slots, updated_at)
- ✅ 60+ Indexes (optimized queries)
- ✅ 1 Sample account (for testing)

---

## 🚀 SETUP INSTRUCTIONS

### **Step 1: Copy Schema File**

```bash
File: docs/03-database/supabase-schema-complete.sql
Size: ~800 lines
Time to run: ~30 seconds
```

### **Step 2: Run in Supabase**

#### A. Open Supabase Dashboard
```
1. Go to https://supabase.com
2. Select your project (or create new)
3. Click "SQL Editor" in sidebar
```

#### B. Paste & Run
```
1. Create new query
2. Copy ENTIRE file: supabase-schema-complete.sql
3. Paste into editor
4. Click "Run" button
5. Wait ~30 seconds
6. Check for success message
```

#### C. Expected Output
```
NOTICE: ==============================================
NOTICE: SCHEMA CREATION COMPLETE!
NOTICE: ==============================================
NOTICE: Core Tables: 4
NOTICE:   - accounts, users, customers, orders
NOTICE: Premium Tables: 10
NOTICE:   - premium_service_types, premium_packages, premium_accounts
NOTICE:   - premium_account_users, customer_premium_subscriptions
NOTICE:   - premium_account_health_logs, premium_account_user_history
NOTICE:   - subscription_renewals, account_migrations, account_migration_history
NOTICE: ==============================================
NOTICE: Total Tables: 14
NOTICE: Functions: 3
NOTICE: Triggers: 10+
NOTICE: Indexes: 60+
NOTICE: ==============================================
NOTICE: Sample Account Created:
NOTICE:   Email: demo@example.com
NOTICE:   ID: 550e8400-e29b-41d4-a716-446655440000
NOTICE: ==============================================
NOTICE: Use this account_id for testing APIs!
NOTICE: ==============================================

Success. No rows returned
```

---

## ✅ VERIFICATION

### **Query 1: Check All Tables Created**

```sql
SELECT 
  table_name,
  (SELECT COUNT(*) 
   FROM information_schema.columns 
   WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'accounts', 'users', 'customers', 'orders',
    'premium_service_types', 'premium_packages', 'premium_accounts',
    'premium_account_users', 'customer_premium_subscriptions',
    'premium_account_health_logs', 'premium_account_user_history',
    'subscription_renewals', 'account_migrations', 'account_migration_history'
  )
ORDER BY table_name;
```

**Expected Result:** 14 rows

### **Query 2: Check Sample Account**

```sql
SELECT 
  id,
  name,
  email,
  business_name,
  status,
  created_at
FROM accounts
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

**Expected Result:** 1 row (Demo Account)

### **Query 3: Check Functions Created**

```sql
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'calculate_prorated_refund',
    'update_premium_account_used_slots',
    'update_updated_at_column'
  )
ORDER BY routine_name;
```

**Expected Result:** 3 functions

### **Query 4: Check Triggers**

```sql
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY trigger_name;
```

**Expected Result:** 10+ triggers

---

## 🧪 TEST SAMPLE DATA

### **Test 1: Create Service Type**

```sql
INSERT INTO premium_service_types (
  account_id,
  name,
  slug,
  description,
  category,
  supports_connection_check
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'ChatGPT Plus',
  'chatgpt-plus',
  'OpenAI ChatGPT Plus subscription',
  'AI',
  false
) RETURNING *;
```

**Expected:** Success, returns new service with UUID

### **Test 2: Create Package**

```sql
INSERT INTO premium_packages (
  account_id,
  service_type_id,
  name,
  slug,
  total_slots,
  default_price,
  billing_cycles
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  '<service-id-from-test-1>',
  'ChatGPT Family Plan',
  'chatgpt-family',
  5,
  30.00,
  '["1month", "3months", "6months", "1year"]'::jsonb
) RETURNING *;
```

**Expected:** Success, returns new package

### **Test 3: Create Premium Account (with password encryption)**

```sql
INSERT INTO premium_accounts (
  account_id,
  service_type_id,
  package_id,
  primary_email,
  primary_password_encrypted, -- Encrypt with pgp_sym_encrypt
  total_slots,
  subscription_start_date,
  subscription_expiry_date
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  '<service-id>',
  '<package-id>',
  'chatgpt-family@example.com',
  pgp_sym_encrypt('MySecretPassword123', 'your-encryption-key'),
  5,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days'
) RETURNING 
  id,
  primary_email,
  total_slots,
  used_slots,
  available_slots, -- computed column!
  status;
```

**Expected:** Success, available_slots = 5

### **Test 4: Test Prorated Refund Function**

```sql
SELECT calculate_prorated_refund(
  30.00,                    -- original_price
  CURRENT_DATE - 10,        -- start_date (10 days ago)
  CURRENT_DATE + 20         -- expiry_date (20 days future)
);
```

**Expected:** ~20.00 (20/30 × 30 = 20)

---

## 📊 DATABASE STATISTICS

After setup, you should have:

```
✅ Tables: 14
✅ Columns: 200+
✅ Indexes: 60+
✅ Constraints: 40+
✅ Functions: 3
✅ Triggers: 10+
✅ Foreign Keys: 30+
```

**Performance:**
- ✅ Optimized for 1000+ premium accounts
- ✅ Query time < 50ms (with proper indexes)
- ✅ Support for concurrent operations
- ✅ Transaction safety

---

## 🔐 SECURITY FEATURES

### **1. Password Encryption**

**Premium accounts và sub-users use pgp_sym_encrypt:**

```sql
-- Encrypt password
INSERT INTO premium_accounts (
  primary_password_encrypted,
  ...
) VALUES (
  pgp_sym_encrypt('password', 'encryption-key'),
  ...
);

-- Decrypt password (when needed)
SELECT 
  primary_email,
  pgp_sym_decrypt(primary_password_encrypted, 'encryption-key') as password
FROM premium_accounts
WHERE id = 'some-uuid';
```

**⚠️ IMPORTANT:** Set encryption key in your .env.local:
```bash
PREMIUM_PASSWORD_ENCRYPTION_KEY=your-secure-key-here-min-32-chars
```

### **2. Soft Delete**

All tables have `deleted_at` column:
- DELETE operations set `deleted_at = NOW()`
- Queries filter by `deleted_at IS NULL`
- Data preserved for audit

### **3. Multi-Tenant Isolation**

All tables have `account_id`:
- Every query MUST filter by account_id
- Enforced by application layer
- Prevents cross-account data access

### **4. Audit Trail**

Complete tracking:
- `premium_account_user_history` - email/password changes
- `account_migration_history` - migration steps
- All tables have created_at/updated_at

---

## 🎯 NEXT STEPS

### **After Database Setup:**

#### 1. Update .env.local
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PREMIUM_PASSWORD_ENCRYPTION_KEY=your-32-char-key
```

#### 2. Test API Endpoints
```bash
# Use sample account for testing:
x-account-id: 550e8400-e29b-41d4-a716-446655440000

# Test services API
POST /api/premium/services
GET  /api/premium/services

# Test packages API
POST /api/premium/packages
GET  /api/premium/packages
```

#### 3. Create Your Real Account
```sql
INSERT INTO accounts (name, email, business_name, status)
VALUES (
  'Your Business Name',
  'your-email@example.com',
  'Your Business',
  'active'
) RETURNING id;

-- Use returned ID for all subsequent operations
```

---

## 🚨 TROUBLESHOOTING

### **Error: "pgp_sym_encrypt does not exist"**

**Solution:**
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### **Error: "relation already exists"**

**Solution:** Drop tables first (if re-running)
```sql
-- BE CAREFUL! This deletes all data
DROP TABLE IF EXISTS account_migration_history CASCADE;
DROP TABLE IF EXISTS account_migrations CASCADE;
DROP TABLE IF EXISTS subscription_renewals CASCADE;
DROP TABLE IF EXISTS premium_account_user_history CASCADE;
DROP TABLE IF EXISTS premium_account_health_logs CASCADE;
DROP TABLE IF EXISTS customer_premium_subscriptions CASCADE;
DROP TABLE IF EXISTS premium_account_users CASCADE;
DROP TABLE IF EXISTS premium_accounts CASCADE;
DROP TABLE IF EXISTS premium_packages CASCADE;
DROP TABLE IF EXISTS premium_service_types CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;

-- Then run schema again
```

### **Error: "constraint violation"**

**Check:**
1. Foreign key references exist
2. Check constraints are valid
3. Unique constraints not violated

---

## 📖 SCHEMA RELATIONSHIPS

### **Core System Flow:**
```
accounts (1)
  ├─→ users (N)              -- Multi-user per account
  ├─→ customers (N)          -- Customer management
  └─→ orders (N)             -- Order tracking

customers (1)
  └─→ orders (N)
```

### **Premium System Flow:**
```
accounts (1)
  └─→ premium_service_types (N)
        └─→ premium_packages (N)
              └─→ premium_accounts (N)      -- Kho 1000+ accounts
                    ├─→ premium_account_users (N)      -- Sub-users/slots
                    ├─→ premium_account_health_logs (N) -- Health checks
                    ├─→ customer_premium_subscriptions (N)
                    └─→ account_migrations (N)

customers (1)
  └─→ customer_premium_subscriptions (N)
        ├─→ premium_accounts (1)
        └─→ subscription_renewals (N)
```

---

## ✅ VERIFICATION CHECKLIST

After setup, verify:

- [ ] 14 tables created
- [ ] 3 functions created
- [ ] 10+ triggers created
- [ ] 60+ indexes created
- [ ] Sample account exists (demo@example.com)
- [ ] Can insert service type
- [ ] Can insert package
- [ ] Can insert premium account (with encryption)
- [ ] Can calculate prorated refund
- [ ] available_slots computed correctly
- [ ] used_slots auto-updates on sub-user changes
- [ ] updated_at auto-updates on changes

---

**Created:** March 5, 2026  
**Schema Version:** 3.0 Complete  
**Status:** ✅ **PRODUCTION READY**  

**Ready to start using the APIs!** 🚀

---

## 📞 QUICK REFERENCE

**Sample Account ID for Testing:**
```
550e8400-e29b-41d4-a716-446655440000
```

**Use this in API header:**
```
x-account-id: 550e8400-e29b-41d4-a716-446655440000
```

**Schema File:**
```
docs/03-database/supabase-schema-complete.sql
```

**Testing Guide:**
```
docs/04-implementation/API_TESTING_GUIDE.md
```

---

**Chúc bạn setup thành công!** 🎉
