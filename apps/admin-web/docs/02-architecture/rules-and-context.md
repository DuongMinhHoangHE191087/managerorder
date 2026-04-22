# 🎯 CONTEXT & RULES - Premium Accounts System

**Purpose:** File này lưu TẤT CẢ context và rules để TRÁNH QUÊN khi làm việc  
**Date:** March 5, 2026  
**Version:** Final Production  

---

## 🔥 ĐỌC FILE NÀY TRƯỚC KHI BẮT ĐẦU BẤT KỲ CÔNG VIỆC NÀO!

---

## 📚 SYSTEM OVERVIEW

### **Hệ thống là gì?**
```
Hệ thống BÁN TÀI KHOẢN PREMIUM DÙNG CHUNG
- Kiểu: Family Sharing / Group Sharing
- Dịch vụ: ChatGPT, Duolingo, Netflix, YouTube Premium, ...
- Quy mô: 1000+ accounts trong kho
- Kinh doanh: Seller mua 1 account, bán cho 5-10 người dùng chung
```

### **Business Model**
```
1. Seller mua account Premium (VD: ChatGPT Plus Family)
2. Account có 5 slots → bán cho 5 khách
3. Mỗi khách trả $10/tháng → Seller thu $50/tháng
4. Seller trả $25/tháng cho account → Lãi $25/tháng
5. Quản lý: renewal, refund, migration, warranty
```

---

## 📋 4 FILES CHÍNH - ĐỌC THEO THỨ TỰ

### **1. 📋_BUSINESS_REQUIREMENTS_COMPLETE.md**
```
Nội dung:
- 12 nhóm yêu cầu nghiệp vụ
- 6 workflows chính
- Công thức tính refund
- Email/password tracking
- Migration process

Khi nào đọc:
- Trước khi implement bất kỳ feature nào
- Khi có thắc mắc về business logic
- Khi cần reference workflow

Tóm tắt:
✅ 1000+ accounts support
✅ Flexible slots (default 5)
✅ Multiple billing cycles (1m/3m/6m/1y)
✅ Manual renewal process
✅ Prorated refund calculation
✅ Account migration when expired
✅ Duolingo API check only
✅ Complete email/password history
```

### **2. 🏗️_SYSTEM_DESIGN_COMPLETE.md**
```
Nội dung:
- Architecture diagram
- 10 database tables design
- 16 RULES phải tuân theo
- Security rules
- Performance rules
- Business logic rules

Khi nào đọc:
- Trước khi tạo database
- Khi implement API
- Khi optimize performance
- Khi có lỗi security

Tóm tắt:
✅ Next.js + Supabase architecture
✅ 10 tables với 180+ fields
✅ Encryption, soft delete, RLS
✅ Audit trail, multi-tenant
✅ Indexes for 1000+ accounts
```

### **3. SUPABASE_SQL_SCHEMA.sql**
```
Nội dung:
- SQL script hoàn chỉnh
- CREATE TABLE statements
- Indexes, constraints, triggers
- Functions (calculate_prorated_refund)
- RLS policies
- Verification queries

Khi nào dùng:
- Lúc setup database lần đầu
- Copy-paste vào Supabase SQL Editor
- Chạy 1 lần duy nhất
- Verify bằng queries ở cuối file

Tóm tắt:
✅ Ready-to-use SQL
✅ All tables + relations
✅ All triggers + functions
✅ Production-ready
```

### **4. 🎯_CONTEXT_RULES.md (FILE NÀY)**
```
Nội dung:
- Quick reference
- Critical rules
- Don't forget checklist
- Common mistakes

Khi nào đọc:
- MỖI NGÀY trước khi code
- Khi bắt đầu làm task mới
- Khi merge code
- Khi review code
```

---

## 🚨 CRITICAL RULES - KHÔNG BAO GIỜ QUÊN!

### **RULE #1: Always Check Business Requirements First**
```
✅ DO:
  1. Đọc 📋_BUSINESS_REQUIREMENTS_COMPLETE.md
  2. Tìm section liên quan (VD: Section 6 - Renewal)
  3. Implement CHÍNH XÁC như spec
  4. Test theo workflow diagram

❌ DON'T:
  - Đoán logic mà không check docs
  - Implement theo ý riêng
  - Bỏ qua edge cases
  - Quên check workflows
```

### **RULE #2: Passwords ALWAYS Encrypted**
```
✅ DO:
  - Dùng pgp_sym_encrypt() cho Supabase
  - Store trong _encrypted fields
  - Never log passwords
  - Never return plain passwords in API

❌ DON'T:
  - Store plain text passwords
  - Log passwords (even in dev)
  - Return passwords in GET requests
```

### **RULE #3: Soft Delete EVERYWHERE**
```
✅ DO:
  - UPDATE deleted_at = NOW()
  - WHERE deleted_at IS NULL in queries
  - Keep data for audit trail

❌ DON'T:
  - Use DELETE FROM
  - Hard delete user data
  - Lose audit trail
```

### **RULE #4: Multi-Tenant Isolation ALWAYS**
```
✅ DO:
  - SET app.current_account_id = 'seller_id'
  - Use RLS policies
  - Filter by account_id everywhere

❌ DON'T:
  - Query without account_id filter
  - Share data between sellers
  - Skip RLS setup
```

### **RULE #5: Refund = Prorated ONLY**
```
Formula:
  refund = (remaining_days / total_days) × original_price

✅ DO:
  - Use calculate_prorated_refund() function
  - Round to 2 decimal places
  - Store in subscription_renewals

❌ DON'T:
  - Full refund (unless special case)
  - Forget to calculate
  - Hardcode refund amount
```

### **RULE #6: Email Changes = Warranty Proof**
```
✅ DO:
  - Track ALL email changes in JSON
  - Store: date, oldEmail, newEmail, reason, changedBy
  - Update email_change_history field
  - Log to premium_account_user_history

❌ DON'T:
  - Allow email changes without logging
  - Lose old email history
  - Skip warranty tracking
```

### **RULE #7: Duolingo ONLY for Auto-Check**
```
✅ DO:
  IF supports_connection_check = true:
    - Call API daily
    - Log to premium_account_health_logs
    - Alert on errors
  ELSE:
    - Set connection_status = 'manual_check_needed'
    - Seller reports manually

❌ DON'T:
  - Auto-check non-Duolingo services
  - Assume all services have API
  - Skip error handling
```

### **RULE #8: Manual Renewal Process**
```
Flow:
1. Ask customer (7 days before)
2. Wait for response
3A. Confirmed → Charge → Renew → Email
3B. Denied → Refund → Kick → Email

✅ DO:
  - Follow exact sequence
  - Update renewal_status at each step
  - Send emails
  - Log everything

❌ DON'T:
  - Auto-renew without asking
  - Skip customer response
  - Charge without confirmation
```

### **RULE #9: Migration = Transaction**
```
✅ DO:
BEGIN;
  1. Create new sub-user
  2. Update subscription
  3. Mark old user removed
  4. Update slots
  5. Log to history
COMMIT;

❌ DON'T:
  - Run steps separately
  - Skip transaction
  - Forget to update slots
  - Miss logging
```

### **RULE #10: Audit Trail EVERYTHING**
```
✅ DO:
  - Log to premium_account_user_history
  - Store: who, what, when, why
  - Include: old_value, new_value
  - Track IP address

❌ DON'T:
  - Skip logging
  - Lose change history
  - Miss important changes
```

---

## 🎯 COMMON WORKFLOWS - QUICK REFERENCE

### **Workflow 1: Khách Mua Slot**
```
1. Customer selects service + package + cycle
2. Create Order
3. Create CustomerPremiumSubscription
4. Create PremiumAccountUser
5. Update premium_accounts.used_slots++
6. Send email with access
✅ DONE
```

### **Workflow 2: Hỏi Gia Hạn**
```
Trigger: 7 days before expiry_date
1. Send email to customer
2. Update subscription:
   - renewal_status = 'pending'
   - renewal_asked_at = NOW()
   - renewal_asked_until = NOW() + 7 days
3. Wait...
```

### **Workflow 3: Khách Đồng Ý Gia Hạn**
```
1. Customer confirms
2. Calculate renewal_price (with factor)
3. Charge customer
4. Create SubscriptionRenewal
5. Update subscription:
   - renewal_status = 'confirmed'
   - expiry_date += cycle_months
   - status = 'renewed'
6. Send "Success!" email
✅ DONE
```

### **Workflow 4: Khách Từ Chối Gia Hạn**
```
1. Customer declines
2. Calculate refund:
   refund = (remaining_days / total_days) × original_price
3. Create SubscriptionRenewal with refund
4. Update subscription:
   - renewal_status = 'denied'
   - status = 'expired'
   - refund_amount = calculated
5. Seller approves → Issue refund
6. Seller kicks customer manually
7. Update sub-user: status = 'removed'
8. Send refund confirmation email
✅ DONE
```

### **Workflow 5: Account Hết Hạn - Migration**
```
1. premium_account expires
2. Seller creates new account
3. Seller initiates migration:
   - source_account_id
   - target_account_id
   - reason = 'account_expired'
4. System processes:
BEGIN;
   - Create new sub-user on target
   - Update subscription.premium_account_id
   - Mark old sub-user removed
   - Update slots on both
   - Log to migration_history
COMMIT;
5. Send email with new access
✅ DONE
```

### **Workflow 6: Daily Health Check (Duolingo)**
```
Cron: Daily at 2:00 AM
1. Find all accounts WHERE service supports_connection_check = true
2. For each account:
   - Call API
   - Check connection
   - Log result
   - Update status
3. If error:
   - Alert seller
   - Send notification
✅ DONE
```

---

## ⚠️ COMMON MISTAKES - TRÁNH!

### **Mistake 1: Quên Filter by account_id**
```
❌ BAD:
SELECT * FROM premium_accounts WHERE status = 'active';

✅ GOOD:
SELECT * FROM premium_accounts 
WHERE account_id = 'seller_id' 
  AND status = 'active' 
  AND deleted_at IS NULL;
```

### **Mistake 2: Hard Delete**
```
❌ BAD:
DELETE FROM premium_accounts WHERE id = 'xxx';

✅ GOOD:
UPDATE premium_accounts 
SET deleted_at = NOW() 
WHERE id = 'xxx';
```

### **Mistake 3: Không Log Changes**
```
❌ BAD:
UPDATE premium_account_users 
SET user_email = 'new@example.com' 
WHERE id = 'xxx';

✅ GOOD:
-- Trigger sẽ tự động log vào premium_account_user_history
-- Nhưng phải set email_change_reason trước
UPDATE premium_account_users 
SET user_email = 'new@example.com',
    last_email_changed_by = 'customer_self',
    -- Trigger will handle the rest
WHERE id = 'xxx';
```

### **Mistake 4: Quên Encryption**
```
❌ BAD:
INSERT INTO premium_accounts (primary_password_encrypted)
VALUES ('plain_password_123');

✅ GOOD:
INSERT INTO premium_accounts (primary_password_encrypted)
VALUES (pgp_sym_encrypt('plain_password_123', 'encryption_key'));
```

### **Mistake 5: Không Dùng Transaction**
```
❌ BAD:
-- Step 1
UPDATE table1 ...;
-- Step 2 (might fail, leaving data inconsistent)
UPDATE table2 ...;

✅ GOOD:
BEGIN;
  UPDATE table1 ...;
  UPDATE table2 ...;
  INSERT INTO audit_log ...;
COMMIT;
```

---

## 📊 DATABASE TABLES - QUICK MAP

```
┌─────────────────────────┐
│  premium_service_types  │ ← ChatGPT, Duolingo, Netflix
│  (supports_connection_  │
│   check: Duolingo only) │
└────────────┬────────────┘
             │
             ↓
┌─────────────────────────┐
│    premium_packages     │ ← Family, Individual, Group
│  (flexible slots, price │   (default 5 slots)
│   renewal_price_factor) │
└────────────┬────────────┘
             │
             ↓
┌─────────────────────────┐
│   premium_accounts      │ ← KHO HÀNG (1000+ accounts)
│  (totalSlots, usedSlots,│   (encrypted passwords)
│   subscriptionExpiry)   │
└────────────┬────────────┘
             │
    ┌────────┼────────┐
    │        │        │
    ↓        ↓        ↓
┌─────┐  ┌─────┐  ┌─────┐
│Users│  │Subs │  │Logs │
│     │  │     │  │     │
└─────┘  └─────┘  └─────┘
   │        │
   ↓        ↓
┌─────┐  ┌─────┐
│Hist │  │Renew│
│     │  │     │
└─────┘  └─────┘
```

### **Table Purpose Quick Reference**
```
1. premium_service_types      → Services config
2. premium_packages            → Plan templates
3. premium_accounts            → Main inventory (1000+)
4. premium_account_users       → Sub-users (slots)
5. customer_premium_subscriptions → Customer orders
6. premium_account_health_logs → Connection checks
7. premium_account_user_history → Audit trail
8. subscription_renewals       → Renewal + refund
9. account_migrations          → Account switching
10. account_migration_history  → Migration audit
```

---

## 🔍 VERIFICATION CHECKLIST - TRƯỚC KHI DEPLOY

### **Database Setup**
- [ ] All 10 tables created
- [ ] All indexes exist
- [ ] All triggers working
- [ ] All functions created
- [ ] RLS policies enabled
- [ ] Soft delete working
- [ ] Computed columns working

### **Business Logic**
- [ ] Renewal flow implemented
- [ ] Refund calculation correct
- [ ] Migration process working
- [ ] Email tracking working
- [ ] Password tracking working
- [ ] Health checks working (Duolingo)

### **Security**
- [ ] Passwords encrypted
- [ ] Multi-tenant isolation
- [ ] Audit trail logging
- [ ] RLS policies tested
- [ ] No plain passwords in logs
- [ ] Soft delete everywhere

### **Performance**
- [ ] Queries <50ms
- [ ] Indexes optimized
- [ ] Batch operations working
- [ ] Cron jobs efficient

### **Documentation**
- [ ] Business requirements updated
- [ ] System design updated
- [ ] API docs created
- [ ] Deployment guide ready

---

## 🎯 QUICK COMMANDS

### **Supabase Setup**
```sql
-- 1. Copy SUPABASE_SQL_SCHEMA.sql
-- 2. Open Supabase Dashboard → SQL Editor
-- 3. Paste and run
-- 4. Verify:
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'premium_%';
```

### **Set Current Seller**
```sql
-- Before any query:
SET app.current_account_id = 'seller-uuid-here';
```

### **Calculate Refund**
```sql
SELECT calculate_prorated_refund('subscription-uuid-here');
```

### **Find Expiring Accounts**
```sql
SELECT * FROM premium_accounts
WHERE subscription_expiry_date <= CURRENT_DATE + INTERVAL '7 days'
  AND status = 'active'
  AND deleted_at IS NULL;
```

### **Find Pending Renewals**
```sql
SELECT * FROM customer_premium_subscriptions
WHERE renewal_status = 'pending'
  AND renewal_asked_until < NOW()
  AND deleted_at IS NULL;
```

---

## 📝 TODO TEMPLATE - WHEN IMPLEMENTING NEW FEATURE

```
Feature: [Name]
Reference: 📋_BUSINESS_REQUIREMENTS_COMPLETE.md Section X

[ ] Read business requirements
[ ] Read system design rules
[ ] Check workflows
[ ] Identify tables needed
[ ] Write SQL queries
[ ] Add encryption if needed
[ ] Add soft delete
[ ] Add audit logging
[ ] Test multi-tenant
[ ] Test edge cases
[ ] Update docs
[ ] Deploy
```

---

## 🎯 FINAL REMINDERS

### **ALWAYS:**
✅ Check Business Requirements first  
✅ Encrypt passwords  
✅ Soft delete, never hard delete  
✅ Filter by account_id (multi-tenant)  
✅ Log all important changes  
✅ Use transactions for multi-step operations  
✅ Calculate refund with prorated formula  
✅ Track email changes (warranty)  
✅ Only auto-check Duolingo  
✅ Follow manual renewal process  

### **NEVER:**
❌ Implement without checking docs  
❌ Store plain passwords  
❌ Hard delete data  
❌ Query without account_id  
❌ Skip audit logging  
❌ Skip transactions  
❌ Full refund (unless special)  
❌ Auto-check all services  
❌ Auto-renew without asking  
❌ Lose context/history  

---

## 📚 FILES LOCATION

```
d:\GITHUB\managerorder\premium-admin-web\

Main Documents:
├─ 📋_BUSINESS_REQUIREMENTS_COMPLETE.md   (Requirements)
├─ 🏗️_SYSTEM_DESIGN_COMPLETE.md           (Architecture + Rules)
├─ SUPABASE_SQL_SCHEMA.sql                (Database script)
└─ 🎯_CONTEXT_RULES.md                    (THIS FILE - Quick ref)

Reference (Previous work):
├─ PREMIUM_ACCOUNTS_SCHEMA_V2_OPTIMIZED.md
├─ PRISMA_SCHEMA_PREMIUM_ACCOUNTS.md
├─ ✅_FINAL_VERIFICATION_V2.md
├─ 🎯_COMPLETE_READY_FOR_PRODUCTION.md
└─ API_ENDPOINT_EXAMPLES.md
```

---

## ✅ FINAL STATUS

**Business Requirements:** ✅ Complete  
**System Design:** ✅ Complete  
**Database Schema:** ✅ Complete  
**Context Rules:** ✅ Complete  

**Quality:** Production-Ready  
**Scale:** 1000+ accounts  
**Security:** Enterprise-Grade  

**Status:** 🚀 **READY TO IMPLEMENT!**

---

**ĐỌC FILE NÀY MỖI NGÀY TRƯỚC KHI CODE!** 📖

---

*Last Updated: March 5, 2026*  
*Version: Final Production*  
*Status: COMPLETE*
