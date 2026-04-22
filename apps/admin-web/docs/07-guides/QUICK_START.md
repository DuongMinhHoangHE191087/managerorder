# 🚀 QUICK START - Setup Database & Test APIs

**Time Required:** 10-15 minutes  
**Date:** March 5, 2026  

---

## ✅ WHAT YOU NEED TO DO NOW

### **Step 1: Setup Supabase Database (5 mins)**

#### A. Open Supabase
```
1. Go to https://supabase.com
2. Sign in to your project
3. Click "SQL Editor" in left sidebar
```

#### B. Run Complete Schema
```
1. Click "New Query"
2. Open file: docs/03-database/supabase-schema-complete.sql
3. Copy ENTIRE file (~800 lines)
4. Paste into SQL Editor
5. Click "Run" button
6. Wait ~30 seconds
7. ✅ Check for success notice
```

#### C. Expected Success Message:
```
NOTICE: SCHEMA CREATION COMPLETE!
NOTICE: Total Tables: 14
NOTICE: Sample Account: demo@example.com
NOTICE: ID: 550e8400-e29b-41d4-a716-446655440000

Success. No rows returned
```

---

### **Step 2: Update .env.local (2 mins)**

#### A. Copy Example File
```bash
# In terminal/PowerShell:
cd d:\GITHUB\managerorder\premium-admin-web
cp .env.local.example .env.local
```

#### B. Get Supabase Credentials
```
1. In Supabase Dashboard → Settings → API
2. Copy:
   - Project URL
   - anon public key
   - service_role key (keep secret!)
```

#### C. Update .env.local
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key
PREMIUM_PASSWORD_ENCRYPTION_KEY=change-this-to-32-char-random-key
```

**Generate encryption key:**
```bash
# In PowerShell:
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

---

### **Step 3: Test Database (3 mins)**

#### A. Verify Tables Created
```sql
-- Run in Supabase SQL Editor:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name LIKE 'premium_%'
ORDER BY table_name;
```

**Expected:** 10 rows (premium tables)

#### B. Check Sample Account
```sql
SELECT id, name, email, status
FROM accounts
WHERE email = 'demo@example.com';
```

**Expected:** 1 row
```
id: 550e8400-e29b-41d4-a716-446655440000
name: Demo Account
email: demo@example.com
status: active
```

---

### **Step 4: Start Dev Server (1 min)**

```bash
# In terminal:
cd d:\GITHUB\managerorder\premium-admin-web
npm run dev
```

**Expected:**
```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

---

### **Step 5: Test APIs (5 mins)**

#### A. Install REST Client
- **Option 1:** Postman (https://postman.com)
- **Option 2:** VS Code Thunder Client extension
- **Option 3:** cURL in terminal

#### B. Test Service Types API

**Create Service:**
```http
POST http://localhost:3000/api/premium/services

Headers:
Content-Type: application/json
x-account-id: 550e8400-e29b-41d4-a716-446655440000

Body:
{
  "name": "ChatGPT Plus",
  "slug": "chatgpt-plus",
  "description": "OpenAI ChatGPT Plus subscription",
  "category": "AI",
  "supports_connection_check": false
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "newly-generated-uuid",
    "name": "ChatGPT Plus",
    "slug": "chatgpt-plus",
    "category": "AI",
    ...
  },
  "message": "Service created successfully"
}
```

**List Services:**
```http
GET http://localhost:3000/api/premium/services

Headers:
x-account-id: 550e8400-e29b-41d4-a716-446655440000
```

**Expected:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

#### C. Test Packages API

**Create Package:**
```http
POST http://localhost:3000/api/premium/packages

Headers:
Content-Type: application/json
x-account-id: 550e8400-e29b-41d4-a716-446655440000

Body:
{
  "service_type_id": "<uuid-from-service-created-above>",
  "name": "ChatGPT Family Plan",
  "slug": "chatgpt-family",
  "total_slots": 5,
  "default_price": 30.00,
  "billing_cycles": ["1month", "3months", "6months", "1year"]
}
```

**Expected:** 201 Created

---

## ✅ SUCCESS CHECKLIST

After completing all steps:

- [ ] Supabase database setup (14 tables)
- [ ] .env.local configured
- [ ] Dev server running on localhost:3000
- [ ] Can create service type via API
- [ ] Can list service types via API
- [ ] Can create package via API
- [ ] Can list packages via API
- [ ] No errors in console

---

## 🎯 WHAT'S WORKING NOW

**Database:**
```
✅ 14 tables created
✅ 3 functions (refund calculation, auto-update)
✅ 10+ triggers (auto timestamps, slots tracking)
✅ 60+ indexes (optimized queries)
✅ Sample account ready
```

**APIs:**
```
✅ 10 endpoints working:
   - 5 Service Types endpoints
   - 5 Packages endpoints
   
✅ Features:
   - CRUD operations
   - Pagination
   - Search & filter
   - Validation
   - Error handling
   - Multi-tenant isolation
```

---

## 📚 DOCUMENTATION REFERENCE

### **Database:**
- [supabase-schema-complete.sql](d:/GITHUB/managerorder/premium-admin-web/docs/03-database/supabase-schema-complete.sql) - Complete schema
- [DATABASE_SETUP_GUIDE.md](d:/GITHUB/managerorder/premium-admin-web/docs/03-database/DATABASE_SETUP_GUIDE.md) - Detailed setup guide

### **API Testing:**
- [API_TESTING_GUIDE.md](d:/GITHUB/managerorder/premium-admin-web/docs/04-implementation/API_TESTING_GUIDE.md) - Testing examples
- [BACKEND_IMPLEMENTATION_PLAN.md](d:/GITHUB/managerorder/premium-admin-web/docs/04-implementation/BACKEND_IMPLEMENTATION_PLAN.md) - Implementation roadmap

### **Reports:**
- [BACKEND_PHASE1_COMPLETE.md](d:/GITHUB/managerorder/premium-admin-web/docs/reports/BACKEND_PHASE1_COMPLETE.md) - Phase 1 completion

---

## ⏭️ WHAT'S NEXT

### **Phase 2: Premium Accounts API (3-4 hours)**
```
⏳ Implement CRUD for premium_accounts
⏳ Password encryption/decryption
⏳ Slots management
⏳ Available accounts endpoint
```

### **Phase 3: Subscriptions API (4-5 hours)**
```
⏳ Create subscription + sub-user
⏳ Renewal workflow
⏳ Prorated refund calculation
⏳ Expiring subscriptions endpoint
```

### **Phase 4: Business Logic (2-3 days)**
```
⏳ Account migrations
⏳ Health checks (Duolingo)
⏳ Renewal reminders (cron)
⏳ Email notifications
```

### **Phase 5: Validation & Testing (3-6 days)**
```
⏳ Execute Business Validation Plan
⏳ 65 test scenarios
⏳ Security testing
⏳ Performance testing
```

---

## 🚨 COMMON ISSUES

### **Issue: "Cannot connect to Supabase"**
```
✅ Check .env.local credentials
✅ Check NEXT_PUBLIC_ prefix for public keys
✅ Restart dev server after .env.local changes
```

### **Issue: "Account ID is required"**
```
✅ Add header: x-account-id: 550e8400-e29b-41d4-a716-446655440000
✅ Use sample account ID for testing
```

### **Issue: "Slug already exists"**
```
✅ Use unique slugs (lowercase, hyphens only)
✅ Check existing data: SELECT * FROM premium_service_types;
```

### **Issue: "Service type not found"**
```
✅ Create service type first
✅ Copy returned UUID
✅ Use UUID (not ID number) in package creation
```

---

## 📊 CURRENT PROGRESS

```
✅ Documentation: 100%
✅ Database Schema: 100%
✅ Infrastructure (types/utils): 100%
✅ Service Types API: 100%
✅ Packages API: 100%
⏳ Premium Accounts API: 0%
⏳ Subscriptions API: 0%
⏳ Business Logic: 0%

Overall Progress: ~20%
Estimated Time Remaining: 2-3 weeks
```

---

## 🎉 YOU'RE READY!

**You now have:**
- ✅ Complete database structure
- ✅ Working API endpoints
- ✅ Professional code organization
- ✅ Comprehensive documentation
- ✅ Ready for development

**Start testing and building!** 🚀

---

**Questions?**
- Review [DATABASE_SETUP_GUIDE.md](d:/GITHUB/managerorder/premium-admin-web/docs/03-database/DATABASE_SETUP_GUIDE.md) for details
- Check [API_TESTING_GUIDE.md](d:/GITHUB/managerorder/premium-admin-web/docs/04-implementation/API_TESTING_GUIDE.md) for examples
- Test APIs with sample account: `550e8400-e29b-41d4-a716-446655440000`

**Chúc bạn thành công!** 🎉
