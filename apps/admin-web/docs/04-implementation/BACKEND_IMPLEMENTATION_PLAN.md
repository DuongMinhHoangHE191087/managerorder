# 🚀 BACKEND IMPLEMENTATION PLAN - Premium Accounts System

**Date:** March 5, 2026  
**Status:** In Progress  
**Phase:** Backend Development  

---

## ⚠️ IMPORTANT: VALIDATION TRƯỚC KHI PRODUCTION

**Lưu ý:** Theo plan, nên thực hiện **Business Validation Plan** (65 test scenarios) trước khi deploy production.  

**Tuy nhiên**, để bắt đầu development, chúng ta có thể:
1. ✅ Setup database
2. ✅ Implement basic APIs
3. ✅ Test locally
4. ⏳ Sau đó mới execute validation plan (trước production)

---

## 📋 IMPLEMENTATION STEPS

### **Phase 1: Database Setup (30 min)** ← BẮT ĐẦU TỪ ĐÂY

#### Step 1.1: Setup Supabase Project
```bash
1. Truy cập https://supabase.com
2. Tạo project mới (hoặc dùng existing)
3. Copy URL và Anon Key
4. Update .env.local với credentials
```

#### Step 1.2: Run Database Schema
```bash
1. Mở Supabase Dashboard
2. Vào SQL Editor
3. Copy toàn bộ file: docs/03-database/supabase-schema.sql
4. Paste và Run
5. Verify 10 tables created
```

#### Step 1.3: Verify Database
```sql
-- Check tables created:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'premium_%'
ORDER BY table_name;

-- Expected result: 10 tables
```

---

### **Phase 2: API Structure Setup (1 hour)**

#### Step 2.1: Create API Routes Structure
```
src/app/api/premium/
├── services/
│   ├── route.ts                 ← GET all services, POST new service
│   └── [id]/
│       └── route.ts             ← GET/PUT/DELETE specific service
│
├── packages/
│   ├── route.ts                 ← GET all packages, POST new package
│   └── [id]/
│       └── route.ts             ← GET/PUT/DELETE specific package
│
├── accounts/
│   ├── route.ts                 ← GET all accounts, POST new account
│   ├── [id]/
│   │   └── route.ts             ← GET/PUT/DELETE specific account
│   └── available/
│       └── route.ts             ← GET available accounts (có slot trống)
│
├── subscriptions/
│   ├── route.ts                 ← GET all subscriptions, POST new subscription
│   ├── [id]/
│   │   ├── route.ts             ← GET/PUT/DELETE subscription
│   │   ├── renew/
│   │   │   └── route.ts         ← POST renewal request
│   │   └── refund/
│   │       └── route.ts         ← POST refund calculation
│   └── expiring/
│       └── route.ts             ← GET subscriptions sắp hết hạn
│
├── migrations/
│   ├── route.ts                 ← GET all migrations, POST new migration
│   └── [id]/
│       └── route.ts             ← GET/PUT migration status
│
└── health-checks/
    ├── route.ts                 ← GET health check logs
    └── run/
        └── route.ts             ← POST trigger manual health check
```

#### Step 2.2: Create Type Definitions
```typescript
// src/lib/types/premium.ts
export interface PremiumServiceType {
  id: string;
  account_id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  website?: string;
  category?: string;
  supports_connection_check: boolean;
  connection_check_type?: 'api' | 'manual' | 'scheduled';
  connection_check_api_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ... (và các types khác)
```

#### Step 2.3: Create API Utilities
```typescript
// src/lib/utils/api-response.ts
export function successResponse<T>(data: T, message?: string) {
  return Response.json({
    success: true,
    data,
    message
  });
}

export function errorResponse(error: string, status = 400) {
  return Response.json({
    success: false,
    error
  }, { status });
}
```

---

### **Phase 3: Implement Core APIs (2-3 days)**

#### Priority 1: Service Types API (2 hours)
```
✅ GET  /api/premium/services        ← List all services
✅ POST /api/premium/services        ← Create new service
✅ GET  /api/premium/services/[id]   ← Get specific service
✅ PUT  /api/premium/services/[id]   ← Update service
✅ DELETE /api/premium/services/[id] ← Soft delete service
```

**Business Logic:**
- Multi-tenant: Filter by account_id
- Soft delete: Set deleted_at
- Validation: Required fields check

#### Priority 2: Packages API (2 hours)
```
✅ GET  /api/premium/packages        ← List all packages
✅ POST /api/premium/packages        ← Create new package
✅ GET  /api/premium/packages/[id]   ← Get specific package
✅ PUT  /api/premium/packages/[id]   ← Update package
✅ DELETE /api/premium/packages/[id] ← Soft delete package
```

**Business Logic:**
- Link to service_type_id
- Default slots = 5
- Renewal price factor validation (0.9-1.1)

#### Priority 3: Premium Accounts API (3 hours)
```
✅ GET  /api/premium/accounts              ← List all accounts
✅ GET  /api/premium/accounts/available    ← Available accounts (có slots)
✅ POST /api/premium/accounts              ← Create new account
✅ GET  /api/premium/accounts/[id]         ← Get specific account
✅ PUT  /api/premium/accounts/[id]         ← Update account
✅ DELETE /api/premium/accounts/[id]       ← Soft delete account
```

**Business Logic:**
- Encrypt passwords (pgp_sym_encrypt)
- Track used_slots vs total_slots
- Check subscription_expiry_date
- Status: active/expired/suspended

#### Priority 4: Subscriptions API (4 hours)
```
✅ GET  /api/premium/subscriptions              ← List all subscriptions
✅ GET  /api/premium/subscriptions/expiring     ← Expiring soon (7 days)
✅ POST /api/premium/subscriptions              ← Create subscription
✅ GET  /api/premium/subscriptions/[id]         ← Get subscription
✅ PUT  /api/premium/subscriptions/[id]         ← Update subscription
✅ POST /api/premium/subscriptions/[id]/renew   ← Renewal request
✅ POST /api/premium/subscriptions/[id]/refund  ← Calculate refund
```

**Business Logic:**
- Create subscription + sub-user (transaction)
- Update account.used_slots
- Renewal status: none/pending/confirmed/denied
- Prorated refund calculation

---

### **Phase 4: Business Logic Implementation (3-4 days)**

#### 4.1. Renewal Workflow
```typescript
// POST /api/premium/subscriptions/[id]/renew

Steps:
1. Find subscription (7 days before expiry)
2. Update renewal_status = 'pending'
3. Set renewal_asked_at = NOW()
4. Send email to customer
5. Return pending status

On Customer Response:
- Confirm: Charge → Extend expiry → Email
- Deny: Calculate refund → Issue → Kick user → Email
```

#### 4.2. Account Migration
```typescript
// POST /api/premium/migrations

Steps:
BEGIN TRANSACTION;
  1. Validate source & target accounts
  2. Create new sub-user on target
  3. Update subscription.premium_account_id
  4. Mark old sub-user as 'removed'
  5. Update used_slots on both accounts
  6. Log to migration_history
COMMIT;
```

#### 4.3. Health Checks (Duolingo)
```typescript
// POST /api/premium/health-checks/run

Steps:
1. Find accounts with supports_connection_check = true
2. Call Duolingo API for each
3. Log result to premium_account_health_logs
4. Update connection_status
5. Alert if error
```

---

### **Phase 5: Testing & Validation (2-3 days)**

#### 5.1. Unit Tests
```
✅ Test API endpoints
✅ Test business logic
✅ Test error handling
✅ Test validation
```

#### 5.2. Integration Tests
```
✅ Test complete workflows
✅ Test database transactions
✅ Test multi-tenant isolation
✅ Test soft delete
```

#### 5.3. Manual Testing
```
✅ Execute Business Validation Plan
✅ 65 test scenarios
✅ Document results
```

---

## 🎯 CURRENT PROGRESS

### **✅ Completed:**
- [x] Documentation complete
- [x] Database schema ready
- [x] Validation plan created
- [x] Supabase client setup

### **🔄 In Progress:**
- [ ] Database setup (Supabase)
- [ ] API structure creation
- [ ] Core APIs implementation

### **⏳ Pending:**
- [ ] Business logic
- [ ] Cron jobs
- [ ] Testing
- [ ] Deployment

---

## 📝 WHAT TO DO NOW

### **Option A: Setup Database First (RECOMMENDED)**
```bash
1. Setup Supabase project
2. Update .env.local with credentials
3. Run docs/03-database/supabase-schema.sql
4. Verify 10 tables created
5. Then start coding APIs
```

### **Option B: Start Coding (Database giả sử đã setup)**
```bash
1. Tạo API routes structure
2. Implement Service Types API
3. Implement Packages API
4. Implement Accounts API
5. Test với Supabase local data
```

---

## 🚨 REMINDERS

### **Security:**
```
✅ Always encrypt passwords
✅ Always filter by account_id (multi-tenant)
✅ Always use soft delete
✅ Always log changes (audit trail)
✅ Always use transactions for complex operations
```

### **Performance:**
```
✅ Use proper indexes
✅ Limit query results
✅ Use pagination
✅ Cache when appropriate
```

### **Business Rules:**
```
✅ Total slots flexible (default 5)
✅ Manual renewal (not automatic)
✅ Prorated refund formula
✅ Duolingo only for auto health check
✅ Email/password changes tracked
```

---

## 🎯 NEXT STEPS

**Recommended Workflow:**
```
1. ✅ Setup Supabase database (30 min)
2. ✅ Create API structure (1 hour)
3. ✅ Implement Service Types API (2 hours)
4. ✅ Implement Packages API (2 hours)
5. ✅ Implement Accounts API (3 hours)
6. ✅ Test basic CRUD (1 hour)
7. ✅ Implement Subscriptions API (4 hours)
8. ✅ Implement Business Logic (3-4 days)
9. ✅ Testing & Validation (2-3 days)
10. ✅ Deploy to production
```

**Total Timeline:** 2-3 weeks for complete implementation

---

**Created:** March 5, 2026  
**Status:** Planning → Implementation  
**Ready to Start:** YES ✅  

**Bắt đầu từ đâu?**  
→ Setup Supabase database trước!  
→ Hoặc bắt đầu code API structure (nếu DB đã setup)

**Bạn muốn bắt đầu với bước nào?** 🚀
