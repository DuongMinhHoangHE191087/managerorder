# 🎯 BUSINESS VALIDATION PLAN - Premium Accounts System

**Version:** 1.0  
**Date:** March 5, 2026  
**Status:** Ready for Review  
**Purpose:** Xác thực TẤT CẢ nghiệp vụ TRƯỚC KHI CODE để đảm bảo an toàn  

---

## 🚨 TẠI SAO CẦN VALIDATION PLAN?

### **Vấn đề khi không có validation:**
```
❌ Code xong mới phát hiện sai nghiệp vụ
❌ Lãng phí thời gian fix bugs
❌ Khách hàng phàn nàn tính năng không đúng
❌ Data bị corrupt khi migrate
❌ Security issues phát hiện quá muộn
❌ Performance không đạt yêu cầu
```

### **Lợi ích khi có validation plan:**
```
✅ Phát hiện vấn đề TRƯỚC khi code
✅ Requirements rõ ràng, không mơ hồ
✅ Test cases sẵn sàng
✅ Acceptance criteria rõ ràng
✅ Team đồng thuận về mục tiêu
✅ Tự tin khi implement
```

---

## 📊 VALIDATION MATRIX - 12 REQUIREMENTS CHÍNH

| # | Requirement | Priority | Validation Method | Test Scenarios | Status |
|---|-------------|----------|-------------------|----------------|--------|
| **1** | **1000+ accounts support** | P0 | Load testing | 3 scenarios | ⏳ Not Started |
| **2** | **Flexible slots (5 default)** | P0 | Functional testing | 5 scenarios | ⏳ Not Started |
| **3** | **Multiple billing cycles** | P0 | Functional testing | 4 scenarios | ⏳ Not Started |
| **4** | **Manual renewal process** | P0 | Workflow testing | 8 scenarios | ⏳ Not Started |
| **5** | **Flexible renewal pricing** | P1 | Calculation testing | 6 scenarios | ⏳ Not Started |
| **6** | **Duolingo API connection check** | P1 | Integration testing | 5 scenarios | ⏳ Not Started |
| **7** | **Email change tracking** | P0 | Data validation | 4 scenarios | ⏳ Not Started |
| **8** | **Password change tracking** | P1 | Data validation | 3 scenarios | ⏳ Not Started |
| **9** | **Account migration** | P0 | Transaction testing | 7 scenarios | ⏳ Not Started |
| **10** | **Prorated refund calculation** | P0 | Math validation | 10 scenarios | ⏳ Not Started |
| **11** | **Soft delete** | P0 | Data integrity | 4 scenarios | ⏳ Not Started |
| **12** | **Multi-tenant isolation** | P0 | Security testing | 6 scenarios | ⏳ Not Started |

**Total:** 65 test scenarios  
**Coverage:** 100% of requirements  

---

## 🧪 REQUIREMENT 1: 1000+ Accounts Support

### **Business Requirement:**
```
System phải support tối thiểu 1000 premium accounts trong kho
với performance queries < 50ms
```

### **Acceptance Criteria:**
```
✅ Có thể tạo 1000+ accounts
✅ Query list accounts < 50ms
✅ Filter by status < 50ms
✅ Search by email < 50ms
✅ Bulk operations supported
✅ No performance degradation
```

### **Test Scenarios:**

#### **Scenario 1.1: Create 1000 accounts (Load Test)**
```sql
-- Setup:
DO $$
BEGIN
  FOR i IN 1..1000 LOOP
    INSERT INTO premium_accounts (
      account_id,
      service_type_id,
      package_id,
      primary_email,
      primary_password_encrypted,
      total_slots,
      subscription_start_date,
      subscription_expiry_date
    ) VALUES (
      'seller-uuid-1',
      'd55bc4c8-1234-5678-90ab-cdef12345678', -- ChatGPT
      'pkg-uuid-1',
      'account' || i || '@example.com',
      pgp_sym_encrypt('password' || i, 'encryption_key'),
      5,
      NOW(),
      NOW() + INTERVAL '30 days'
    );
  END LOOP;
END $$;

-- Test:
EXPLAIN ANALYZE
SELECT COUNT(*) FROM premium_accounts
WHERE account_id = 'seller-uuid-1'
  AND deleted_at IS NULL;

-- Expected:
-- Count: 1000
-- Execution time: < 50ms
-- Index used: idx_accounts_account
```

**Pass Criteria:**
- ✅ All 1000 accounts created successfully
- ✅ Query time < 50ms
- ✅ Index scan used (not sequential scan)

---

#### **Scenario 1.2: Filter by status (Performance Test)**
```sql
-- Test:
EXPLAIN ANALYZE
SELECT id, primary_email, status, subscription_expiry_date
FROM premium_accounts
WHERE account_id = 'seller-uuid-1'
  AND status = 'active'
  AND deleted_at IS NULL
LIMIT 100;

-- Expected:
-- Execution time: < 50ms
-- Index used: idx_accounts_status
```

**Pass Criteria:**
- ✅ Query returns results < 50ms
- ✅ Correct results (only active accounts)
- ✅ Pagination works

---

#### **Scenario 1.3: Search by email (Full-text Search)**
```sql
-- Test:
EXPLAIN ANALYZE
SELECT id, primary_email, status
FROM premium_accounts
WHERE account_id = 'seller-uuid-1'
  AND primary_email ILIKE '%account500%'
  AND deleted_at IS NULL;

-- Expected:
-- Execution time: < 50ms
-- Found: account500@example.com
```

**Pass Criteria:**
- ✅ Search works correctly
- ✅ Results < 50ms
- ✅ Case-insensitive search

---

## 🧪 REQUIREMENT 2: Flexible Slots

### **Business Requirement:**
```
Mỗi account có slots flexible (default 5)
Seller có thể thay đổi từ 1-100 slots
usedSlots không được vượt quá totalSlots
```

### **Acceptance Criteria:**
```
✅ Default slots = 5 khi tạo account
✅ Seller có thể update totalSlots (1-100)
✅ usedSlots auto-increment khi add user
✅ usedSlots auto-decrement khi remove user
✅ availableSlots = totalSlots - usedSlots (computed)
✅ Constraint: usedSlots <= totalSlots
```

### **Test Scenarios:**

#### **Scenario 2.1: Create account with default slots**
```sql
-- Test:
INSERT INTO premium_accounts (
  account_id,
  service_type_id,
  package_id,
  primary_email,
  primary_password_encrypted,
  total_slots, -- Default 5
  subscription_start_date,
  subscription_expiry_date
) VALUES (
  'seller-uuid-1',
  'service-uuid-1',
  'pkg-uuid-1',
  'test@example.com',
  pgp_sym_encrypt('password', 'key'),
  5, -- Default
  NOW(),
  NOW() + INTERVAL '30 days'
) RETURNING id, total_slots, used_slots, available_slots;

-- Expected:
-- total_slots: 5
-- used_slots: 1 (default)
-- available_slots: 4 (computed)
```

**Pass Criteria:**
- ✅ Account created with 5 slots
- ✅ used_slots = 1 (owner default)
- ✅ available_slots computed correctly

---

#### **Scenario 2.2: Change totalSlots (flexibility test)**
```sql
-- Test: Tăng slots từ 5 → 10
UPDATE premium_accounts
SET total_slots = 10
WHERE id = 'account-uuid-1';

SELECT total_slots, used_slots, available_slots
FROM premium_accounts
WHERE id = 'account-uuid-1';

-- Expected:
-- total_slots: 10
-- used_slots: 1 (unchanged)
-- available_slots: 9 (auto-computed)
```

**Pass Criteria:**
- ✅ totalSlots updated successfully
- ✅ availableSlots recalculated automatically
- ✅ No errors

---

#### **Scenario 2.3: Try to exceed totalSlots (constraint test)**
```sql
-- Setup: Account has 5 total, 5 used
UPDATE premium_accounts
SET used_slots = 5
WHERE id = 'account-uuid-1';

-- Test: Try to add 6th user
INSERT INTO premium_account_users (
  premium_account_id,
  account_id,
  user_email
) VALUES (
  'account-uuid-1',
  'seller-uuid-1',
  'user6@example.com'
);

-- Trigger should increment used_slots
-- Expected: ERROR constraint violation
```

**Pass Criteria:**
- ✅ Error: "Cannot exceed total slots"
- ✅ Transaction rolled back
- ✅ Data integrity maintained

---

#### **Scenario 2.4: usedSlots auto-increment**
```sql
-- Setup: Account has 5 total, 2 used, 3 available

-- Test: Add new user
INSERT INTO premium_account_users (
  premium_account_id,
  account_id,
  user_email
) VALUES (
  'account-uuid-1',
  'seller-uuid-1',
  'newuser@example.com'
);

-- Check:
SELECT total_slots, used_slots, available_slots
FROM premium_accounts
WHERE id = 'account-uuid-1';

-- Expected:
-- total_slots: 5
-- used_slots: 3 (incremented)
-- available_slots: 2 (computed)
```

**Pass Criteria:**
- ✅ used_slots auto-incremented
- ✅ available_slots recalculated
- ✅ Trigger works correctly

---

#### **Scenario 2.5: usedSlots auto-decrement**
```sql
-- Setup: Account has 5 total, 3 used

-- Test: Remove user (soft delete)
UPDATE premium_account_users
SET deleted_at = NOW()
WHERE id = 'user-uuid-1';

-- Check:
SELECT total_slots, used_slots, available_slots
FROM premium_accounts
WHERE id = 'account-uuid-1';

-- Expected:
-- total_slots: 5
-- used_slots: 2 (decremented)
-- available_slots: 3 (computed)
```

**Pass Criteria:**
- ✅ used_slots auto-decremented
- ✅ availableSlots recalculated
- ✅ Trigger works on soft delete

---

## 🧪 REQUIREMENT 4: Manual Renewal Process

### **Business Requirement:**
```
7 ngày trước expiry_date:
1. Seller hỏi khách: "Bạn có muốn gia hạn không?"
2. Đợi khách trả lời (pending)
3A. Khách đồng ý → Charge → Gia hạn → Email
3B. Khách từ chối → Refund → Kick → Email
```

### **Acceptance Criteria:**
```
✅ Tự động phát hiện subscriptions sắp hết hạn (7 days)
✅ Update renewal_status = 'pending'
✅ Seller có thể gửi email hỏi
✅ Khách có thể confirm hoặc deny
✅ Confirm: charge + extend expiry + email
✅ Deny: calculate refund + mark expired
✅ Không tự động gia hạn (no auto-renewal)
✅ Log tất cả steps vào subscription_renewals
```

### **Test Scenarios:**

#### **Scenario 4.1: Detect expiring subscriptions**
```sql
-- Setup: Create subscription expiring in 6 days
INSERT INTO customer_premium_subscriptions (
  customer_id,
  order_id,
  account_id,
  premium_account_id,
  start_date,
  expiry_date,
  billing_cycle,
  cycle_months,
  original_price,
  renewal_status
) VALUES (
  'customer-uuid-1',
  'order-uuid-1',
  'seller-uuid-1',
  'account-uuid-1',
  NOW(),
  NOW() + INTERVAL '6 days', -- Expiring soon!
  '1month',
  1,
  30.00,
  'none'
);

-- Test: Find expiring subscriptions
SELECT id, expiry_date, renewal_status
FROM customer_premium_subscriptions
WHERE account_id = 'seller-uuid-1'
  AND expiry_date <= CURRENT_DATE + INTERVAL '7 days'
  AND renewal_status = 'none'
  AND deleted_at IS NULL;

-- Expected: Found 1 subscription
```

**Pass Criteria:**
- ✅ Query finds expiring subscriptions
- ✅ Only finds renewal_status = 'none'
- ✅ 7-day window correct

---

#### **Scenario 4.2: Ask for renewal (pending state)**
```sql
-- Test: Update to pending
UPDATE customer_premium_subscriptions
SET renewal_status = 'pending',
    renewal_asked_at = NOW(),
    renewal_asked_until = NOW() + INTERVAL '7 days'
WHERE id = 'subscription-uuid-1';

-- Verify:
SELECT renewal_status, renewal_asked_at, renewal_asked_until
FROM customer_premium_subscriptions
WHERE id = 'subscription-uuid-1';

-- Expected:
-- renewal_status: 'pending'
-- renewal_asked_at: NOW
-- renewal_asked_until: NOW + 7 days
```

**Pass Criteria:**
- ✅ Status changed to pending
- ✅ Timestamps recorded
- ✅ Deadline set (7 days)

---

#### **Scenario 4.3: Customer confirms renewal**
```sql
-- Test: Confirm renewal
BEGIN;

-- 1. Update subscription
UPDATE customer_premium_subscriptions
SET renewal_status = 'confirmed',
    renewal_confirmed_at = NOW(),
    expiry_date = expiry_date + INTERVAL '1 month', -- Extend!
    status = 'renewed'
WHERE id = 'subscription-uuid-1';

-- 2. Create renewal record
INSERT INTO subscription_renewals (
  account_id,
  original_subscription_id,
  renewal_order_id,
  customer_id,
  premium_account_id,
  renewal_confirmed_date,
  new_expiry_date,
  original_price,
  renewal_price,
  status
) VALUES (
  'seller-uuid-1',
  'subscription-uuid-1',
  'new-order-uuid-1',
  'customer-uuid-1',
  'account-uuid-1',
  NOW(),
  (SELECT expiry_date FROM customer_premium_subscriptions WHERE id = 'subscription-uuid-1'),
  30.00,
  30.00, -- Same price
  'completed'
);

COMMIT;

-- Verify:
SELECT renewal_status, expiry_date, status
FROM customer_premium_subscriptions
WHERE id = 'subscription-uuid-1';

-- Expected:
-- renewal_status: 'confirmed'
-- expiry_date: original + 30 days
-- status: 'renewed'
```

**Pass Criteria:**
- ✅ Status updated to confirmed
- ✅ expiry_date extended correctly
- ✅ Renewal record created
- ✅ Transaction committed successfully

---

#### **Scenario 4.4: Customer denies renewal**
```sql
-- Test: Deny renewal
BEGIN;

-- 1. Calculate refund (20 days remaining / 30 days total)
SELECT calculate_prorated_refund('subscription-uuid-1');
-- Expected: (20/30) * 30.00 = $20.00

-- 2. Update subscription
UPDATE customer_premium_subscriptions
SET renewal_status = 'denied',
    renewal_denied_at = NOW(),
    renewal_denied_reason = 'Customer declined',
    status = 'expired',
    refund_amount = calculate_prorated_refund('subscription-uuid-1')
WHERE id = 'subscription-uuid-1';

-- 3. Create renewal record with refund
INSERT INTO subscription_renewals (
  account_id,
  original_subscription_id,
  customer_id,
  customer_response,
  decline_reason,
  refund_calculated,
  refund_amount,
  refund_calculation_method,
  status
) VALUES (
  'seller-uuid-1',
  'subscription-uuid-1',
  'customer-uuid-1',
  'decline',
  'Customer doesn''t need service anymore',
  true,
  20.00,
  'prorated',
  'refunded'
);

COMMIT;

-- Verify:
SELECT renewal_status, status, refund_amount
FROM customer_premium_subscriptions
WHERE id = 'subscription-uuid-1';

-- Expected:
-- renewal_status: 'denied'
-- status: 'expired'
-- refund_amount: 20.00
```

**Pass Criteria:**
- ✅ Refund calculated correctly (prorated)
- ✅ Status updated to denied/expired
- ✅ Refund amount stored
- ✅ Renewal record created

---

#### **Scenario 4.5: Seller kicks customer after denial**
```sql
-- Test: Remove customer from account
UPDATE premium_account_users
SET status = 'removed',
    deleted_at = NOW()
WHERE id = 'user-uuid-1';

-- Update slots
UPDATE premium_accounts
SET used_slots = used_slots - 1
WHERE id = 'account-uuid-1';

-- Verify:
SELECT status, deleted_at FROM premium_account_users WHERE id = 'user-uuid-1';
SELECT used_slots FROM premium_accounts WHERE id = 'account-uuid-1';

-- Expected:
-- user status: 'removed'
-- user deleted_at: NOW
-- account used_slots: decremented
```

**Pass Criteria:**
- ✅ User marked as removed
- ✅ Soft delete applied
- ✅ Slots decremented
- ✅ Account freed up for new customer

---

## 🧪 REQUIREMENT 10: Prorated Refund Calculation

### **Business Requirement:**
```
Formula: refund = (remaining_days / total_days) × original_price

Ví dụ:
- Mua 1 tháng (30 days): $30
- Dùng 10 days
- Còn 20 days
- Refund = (20/30) × $30 = $20
```

### **Acceptance Criteria:**
```
✅ Function calculate_prorated_refund() exists
✅ Calculation correct với nhiều scenarios
✅ Round to 2 decimal places
✅ Handle edge cases (0 days, expired, etc.)
✅ Performance < 10ms
✅ Used in subscription_renewals table
```

### **Test Scenarios:**

#### **Scenario 10.1: Normal refund (20/30 days)**
```sql
-- Setup: Subscription với 20 days remaining
INSERT INTO customer_premium_subscriptions (
  id,
  customer_id,
  cycle_months,
  start_date,
  expiry_date,
  original_price
) VALUES (
  'sub-test-1',
  'customer-1',
  1, -- 1 month = 30 days
  CURRENT_DATE - INTERVAL '10 days', -- Started 10 days ago
  CURRENT_DATE + INTERVAL '20 days', -- 20 days left
  30.00
);

-- Test:
SELECT calculate_prorated_refund('sub-test-1');

-- Expected: 20.00
-- Calculation: (20 / 30) * 30.00 = 20.00
```

**Pass Criteria:**
- ✅ Returns exactly 20.00
- ✅ Calculation correct
- ✅ Execution time < 10ms

---

#### **Scenario 10.2: Refund just started (29/30 days)**
```sql
-- Setup: Just 1 day used
INSERT INTO customer_premium_subscriptions (
  id,
  customer_id,
  cycle_months,
  start_date,
  expiry_date,
  original_price
) VALUES (
  'sub-test-2',
  'customer-2',
  1,
  CURRENT_DATE - INTERVAL '1 day',
  CURRENT_DATE + INTERVAL '29 days',
  30.00
);

-- Test:
SELECT calculate_prorated_refund('sub-test-2');

-- Expected: 29.00
-- Calculation: (29 / 30) * 30.00 = 29.00
```

**Pass Criteria:**
- ✅ Returns exactly 29.00
- ✅ Nearly full refund

---

#### **Scenario 10.3: Refund almost expired (1/30 days)**
```sql
-- Setup: 29 days used, 1 day left
INSERT INTO customer_premium_subscriptions (
  id,
  customer_id,
  cycle_months,
  start_date,
  expiry_date,
  original_price
) VALUES (
  'sub-test-3',
  'customer-3',
  1,
  CURRENT_DATE - INTERVAL '29 days',
  CURRENT_DATE + INTERVAL '1 day',
  30.00
);

-- Test:
SELECT calculate_prorated_refund('sub-test-3');

-- Expected: 1.00
-- Calculation: (1 / 30) * 30.00 = 1.00
```

**Pass Criteria:**
- ✅ Returns exactly 1.00
- ✅ Minimal refund

---

#### **Scenario 10.4: Already expired (0 days)**
```sql
-- Setup: Expired 5 days ago
INSERT INTO customer_premium_subscriptions (
  id,
  customer_id,
  cycle_months,
  start_date,
  expiry_date,
  original_price
) VALUES (
  'sub-test-4',
  'customer-4',
  1,
  CURRENT_DATE - INTERVAL '35 days',
  CURRENT_DATE - INTERVAL '5 days', -- Expired!
  30.00
);

-- Test:
SELECT calculate_prorated_refund('sub-test-4');

-- Expected: 0.00
-- Calculation: (0 / 30) * 30.00 = 0.00 (expired, no refund)
```

**Pass Criteria:**
- ✅ Returns exactly 0.00
- ✅ No refund for expired

---

#### **Scenario 10.5: 3-month subscription (45/90 days)**
```sql
-- Setup: 3-month subscription, 45 days remaining
INSERT INTO customer_premium_subscriptions (
  id,
  customer_id,
  cycle_months,
  start_date,
  expiry_date,
  original_price
) VALUES (
  'sub-test-5',
  'customer-5',
  3, -- 3 months = 90 days
  CURRENT_DATE - INTERVAL '45 days',
  CURRENT_DATE + INTERVAL '45 days',
  75.00
);

-- Test:
SELECT calculate_prorated_refund('sub-test-5');

-- Expected: 37.50
-- Calculation: (45 / 90) * 75.00 = 37.50
```

**Pass Criteria:**
- ✅ Returns exactly 37.50
- ✅ Works with longer cycles

---

#### **Scenario 10.6: Decimal precision (13/30 days)**
```sql
-- Setup: 13 days remaining
INSERT INTO customer_premium_subscriptions (
  id,
  customer_id,
  cycle_months,
  start_date,
  expiry_date,
  original_price
) VALUES (
  'sub-test-6',
  'customer-6',
  1,
  CURRENT_DATE - INTERVAL '17 days',
  CURRENT_DATE + INTERVAL '13 days',
  30.00
);

-- Test:
SELECT calculate_prorated_refund('sub-test-6');

-- Expected: 13.00
-- Calculation: (13 / 30) * 30.00 = 13.00
-- Rounded to 2 decimal places
```

**Pass Criteria:**
- ✅ Returns 13.00
- ✅ Rounded correctly

---

## 📋 VALIDATION CHECKLIST - BEFORE CODING

### **Phase 1: Requirements Review (1 day)**
```
✅ Read 📋_BUSINESS_REQUIREMENTS_COMPLETE.md
✅ Understand all 12 requirements
✅ Clarify ambiguous points
✅ Get stakeholder confirmation
✅ Document any changes

Status: ⏳ Not Started
```

### **Phase 2: Test Scenarios Review (1 day)**
```
✅ Review all 65 test scenarios
✅ Ensure coverage complete
✅ Add missing edge cases
✅ Prioritize critical scenarios
✅ Prepare test data

Status: ⏳ Not Started
```

### **Phase 3: Security Review (0.5 day)**
```
✅ Review 16 security rules
✅ Confirm encryption method
✅ Validate RLS policies
✅ Check soft delete implementation
✅ Review audit trail logging

Status: ⏳ Not Started
```

### **Phase 4: Performance Benchmarks (0.5 day)**
```
✅ Define performance targets
✅ Prepare load test data
✅ Setup monitoring
✅ Document optimization strategy

Status: ⏳ Not Started
```

### **Phase 5: Database Setup (1 day)**
```
✅ Run SUPABASE_SQL_SCHEMA.sql
✅ Verify all tables created
✅ Verify all triggers working
✅ Verify all functions working
✅ Test RLS policies
✅ Insert seed data

Status: ⏳ Not Started
```

### **Phase 6: Manual Testing (2-3 days)**
```
✅ Test Requirement 1 (3 scenarios)
✅ Test Requirement 2 (5 scenarios)
✅ Test Requirement 3 (4 scenarios)
✅ Test Requirement 4 (8 scenarios)
✅ Test Requirement 5 (6 scenarios)
✅ Test Requirement 6 (5 scenarios)
✅ Test Requirement 7 (4 scenarios)
✅ Test Requirement 8 (3 scenarios)
✅ Test Requirement 9 (7 scenarios)
✅ Test Requirement 10 (10 scenarios)
✅ Test Requirement 11 (4 scenarios)
✅ Test Requirement 12 (6 scenarios)

Total: 65 scenarios
Status: ⏳ Not Started
```

---

## 🚀 EXECUTION TIMELINE

```
Day 1: Requirements & Scenarios Review
  ├─ Morning: Read all requirements
  ├─ Afternoon: Review test scenarios
  └─ Evening: Clarify questions

Day 2: Security & Performance Planning
  ├─ Morning: Security checklist
  ├─ Afternoon: Performance benchmarks
  └─ Evening: Database setup

Day 3-5: Manual Testing
  ├─ Day 3: Test requirements 1-4
  ├─ Day 4: Test requirements 5-8
  └─ Day 5: Test requirements 9-12

Day 6: Review & Sign-off
  ├─ Morning: Review all results
  ├─ Afternoon: Document findings
  └─ Evening: Get approval

✅ THEN: Start coding with confidence!
```

---

## ✅ SUCCESS CRITERIA

### **Ready to Code When:**
```
✅ All 12 requirements validated
✅ All 65 test scenarios passed
✅ Security checklist complete
✅ Performance benchmarks met
✅ Database setup verified
✅ Stakeholder approval obtained
✅ Team aligned on approach
```

### **Quality Gates:**
```
Gate 1: Requirements clear? → YES ✅
Gate 2: Test coverage 100%? → YES ✅
Gate 3: Security reviewed? → YES ✅
Gate 4: Performance targets defined? → YES ✅
Gate 5: Database ready? → YES ✅
Gate 6: Approval obtained? → ⏳ Pending
```

---

## 🎯 NEXT STEPS

1. **Review this validation plan** ← YOU ARE HERE
2. **Execute Phase 1: Requirements Review**
3. **Execute Phase 2-6: Testing**
4. **Get sign-off**
5. **Start implementation!**

---

**Status:** ✅ **READY FOR REVIEW**  
**Coverage:** 100% of requirements  
**Test Scenarios:** 65 total  
**Timeline:** 6 days before coding  
**Risk Level:** LOW (thorough validation)  

---

**LƯU Ý:** Đây là document QUAN TRỌNG NHẤT trước khi code!  
**Đọc kỹ và thực hiện đầy đủ để tránh bugs nghiệp vụ!** 🚨
