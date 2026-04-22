# ✅ PHASE 3 TESTING CHECKLIST

**Date:** March 5, 2026  
**Total Endpoints:** 9  
**Estimated Duration:** 30 minutes  

---

## 📋 PRE-TESTING CHECKLIST

Before you start testing, verify:

- [ ] Database is running (Supabase connected)
- [ ] Dev server is running (`npm run dev`)
- [ ] Phase 1 tests completed (services created)
- [ ] Phase 2 tests completed (accounts created)
- [ ] You have these IDs saved:
  - [ ] service_type_id
  - [ ] package_id
  - [ ] premium_account_id
  - [ ] account_id = 550e8400-e29b-41d4-a716-446655440000

---

## 🧪 ENDPOINT TESTING CHECKLIST

### **Test 1: GET /api/premium/subscriptions**
- [ ] Request: GET with pagination params
- [ ] Status: 200 OK
- [ ] Response: Contains array of subscriptions
- [ ] Pagination: page, limit, total, totalPages
- [ ] Fields: id, customer_id, status, renewal_status, dates, pricing
- [ ] Computed: days_remaining field
- [ ] Relationships: premium_accounts, premium_packages, premium_service_types

**Notes:**
```
Query params:
  page=1, limit=20, sort=created_at, order=desc
  status=active, service_type_id=..., package_id=...
```

---

### **Test 2: POST /api/premium/subscriptions - Create**
- [ ] Request: POST with complete subscription data
- [ ] Status: 201 Created
- [ ] Response: Contains created subscription object
- [ ] Auto-fields: id generated, created_at/updated_at set
- [ ] Auto-calculated: expiry_date from billing_cycle
- [ ] Side-effect: used_slots incremented in premium_account
- [ ] Fields validation:
  - [ ] customer_id: required, unique per create
  - [ ] premium_account_id: exists and has slots
  - [ ] service_type_id: exists and matches package
  - [ ] package_id: exists, belongs to account
  - [ ] billing_cycle: 1month|3months|6months|1year
  - [ ] original_price: positive number
  - [ ] final_price: positive number
  - [ ] start_date: auto-set to today if missing
  - [ ] expiry_date: auto-calculated if missing

**Test Cases:**
- [ ] ✅ Valid subscription creation
- [ ] ❌ Missing required fields → 400 error
- [ ] ❌ Invalid billing_cycle → 422 error
- [ ] ❌ Premium account with no slots → 409 error
- [ ] ❌ Non-existent premium account → 404 error

---

### **Test 3: GET /api/premium/subscriptions/[id] - Get Single**
- [ ] Request: GET with subscription ID in path
- [ ] Status: 200 OK
- [ ] Response: Single subscription object
- [ ] Relationships: All related data included
- [ ] Computed-fields: days_remaining, is_expiring_soon
- [ ] Complete info: All subscription details

**Test Cases:**
- [ ] ✅ Valid ID → 200, subscription data
- [ ] ❌ Invalid ID → 404 Not Found
- [ ] ❌ Deleted subscription → 404 Not Found
- [ ] ❌ Wrong account ID → 404 Not Found

---

### **Test 4: PUT /api/premium/subscriptions/[id]/renew - Request Renewal**
- [ ] Request: PUT to /renew endpoint
- [ ] Status: 200 OK
- [ ] Response: Renewal request object created
- [ ] Renewal object fields:
  - [ ] id: renewal UUID
  - [ ] status: pending
  - [ ] renewal_requested_date: now
  - [ ] refund_calculated: false
  - [ ] migrate_to_new_account: false
- [ ] Side-effects:
  - [ ] subscription renewal_status → pending
  - [ ] subscription renewal_asked_at → now
- [ ] Relationships: original subscription referenced

**Test Cases:**
- [ ] ✅ Valid subscription → 200, renewal created
- [ ] ❌ Non-active subscription → 400 error
- [ ] ❌ Already pending renewal → 400 error
- [ ] ❌ Non-existent subscription → 404 error

---

### **Test 5: DELETE /api/premium/subscriptions/[id] - Soft Delete**
- [ ] Request: DELETE subscription
- [ ] Status: 200 OK
- [ ] Response: Empty data, success message
- [ ] Side-effects:
  - [ ] deleted_at timestamp set
  - [ ] status set to cancelled
  - [ ] used_slots decremented in premium_account
- [ ] Verification: GET same ID → 404

**Test Cases:**
- [ ] ✅ Valid subscription → 200, deleted safely
- [ ] ✅ Subsequent GET → 404 Not Found
- [ ] ❌ Non-existent ID → 404 error

---

### **Test 6: POST /api/premium/subscriptions/[id]/refund - Calculate Refund**
- [ ] Request: POST with refund method
- [ ] Status: 200 OK
- [ ] Response: Contains subscription + refund_calculation
- [ ] Refund calculation fields:
  - [ ] method: prorated|full|partial
  - [ ] refund_amount: calculated correctly
  - [ ] currency: USD
  - [ ] original_price: from subscription
  - [ ] days_remaining: calculated correctly
  - [ ] calculation_date: now

**Refund Methods:**
- [ ] **Prorated**: (days_remaining / total_days) × original_price
  - Example: 10 days left of 30-day cycle, $30 price → $10 refund
- [ ] **Full**: original_price
  - Example: $30 price → $30 refund
- [ ] **Partial**: custom_amount (max = original_price)
  - Example: custom_amount $15 → $15 refund

**Test Cases:**
- [ ] ✅ Prorated calculation correct
- [ ] ✅ Full refund = original price
- [ ] ✅ Partial with custom amount
- [ ] ✅ Custom amount capped at original
- [ ] ❌ Missing method → use prorated

---

### **Test 7: GET /api/premium/subscriptions/expiring - Expiring Soon**
- [ ] Request: GET with days_threshold parameter
- [ ] Status: 200 OK
- [ ] Response: Paginated list of expiring subscriptions
- [ ] Filtering criteria: only active subscriptions expiring within N days
- [ ] Sorting: by days_remaining (ascending)
- [ ] Each item includes: days_remaining field
- [ ] Maximum threshold: 30 days

**Test Cases:**
- [ ] ✅ Get subscriptions expiring in 7 days
- [ ] ✅ Get subscriptions expiring in 30 days
- [ ] ✅ Sorted by days_remaining (ascending)
- [ ] ✅ Only active subscriptions included
- [ ] ✅ days_remaining > 0 and <= threshold

---

### **Test 8a: GET /api/premium/renewals - List Renewals**
- [ ] Request: GET with optional filters
- [ ] Status: 200 OK
- [ ] Response: Paginated list of renewals
- [ ] Filters supported:
  - [ ] status: pending|confirmed|denied|completed|failed|refunded
  - [ ] customer_id: filter by customer
  - [ ] page, limit: pagination
  - [ ] sort, order: sorting
- [ ] Each item includes: full renewal details + subscription reference

**Test Cases:**
- [ ] ✅ List all renewals
- [ ] ✅ Filter by status=pending
- [ ] ✅ Filter by customer_id
- [ ] ✅ Pagination working
- [ ] ✅ Sorting working

---

### **Test 8b: POST /api/premium/renewals - Confirm Renewal**
- [ ] Request: POST with action=confirm, renewal_id
- [ ] Status: 200 OK
- [ ] Response: Updated renewal object
- [ ] Fields updated:
  - [ ] status: confirmed
  - [ ] renewal_confirmed_date: now
  - [ ] renewal_price: new price (if provided)
  - [ ] new_billing_cycle: new cycle (if provided)
  - [ ] total_price: calculated
- [ ] Side-effects:
  - [ ] subscription renewal_status → confirmed
  - [ ] subscription renewal_confirmed_at → now
- [ ] Optional params: renewal_price, new_billing_cycle

**Test Cases:**
- [ ] ✅ Confirm pending renewal
- [ ] ✅ With new price provided
- [ ] ✅ With new billing cycle provided
- [ ] ✅ Both optional fields provided
- [ ] ❌ Non-pending renewal → 400 error
- [ ] ❌ Non-existent renewal → 404 error

---

### **Test 8c: POST /api/premium/renewals - Deny Renewal**
- [ ] Request: POST with action=deny, renewal_id, reason (optional)
- [ ] Status: 200 OK
- [ ] Response: Updated renewal object
- [ ] Fields updated:
  - [ ] status: denied
  - [ ] customer_response_date: now
  - [ ] customer_response: decline
  - [ ] decline_reason: reason provided
- [ ] Side-effects:
  - [ ] subscription renewal_status → denied
  - [ ] subscription renewal_denied_at → now
  - [ ] subscription renewal_denied_reason → reason
- [ ] Optional: reason field

**Test Cases:**
- [ ] ✅ Deny pending renewal with reason
- [ ] ✅ Deny without reason (defaults to null)
- [ ] ✅ Reason recorded
- [ ] ❌ Non-pending renewal → 400 error
- [ ] ❌ Non-existent renewal → 404 error

---

### **Test 9: Complete Workflow - Create → Renew → Deny → Refund → Delete**

1. **Create subscription**
   - [ ] POST /subscriptions
   - [ ] Status: 201
   - Save: subscription_id

2. **Request renewal**
   - [ ] PUT /subscriptions/{id}/renew
   - [ ] Status: 200
   - Save: renewal_id

3. **Deny renewal**
   - [ ] POST /renewals (action: deny)
   - [ ] Status: 200
   - Verify: subscription renewal_status = denied

4. **Calculate refund**
   - [ ] POST /subscriptions/{id}/refund (method: prorated)
   - [ ] Status: 200
   - Verify: refund_amount calculated

5. **Delete subscription**
   - [ ] DELETE /subscriptions/{id}
   - [ ] Status: 200
   - Verify: subscription not found (404)

---

## 🔍 VALIDATION CHECKLIST

### **Input Validation:**
- [ ] Required fields enforced
- [ ] Email format validated (if used)
- [ ] Pricing must be positive
- [ ] Dates must be valid format (YYYY-MM-DD)
- [ ] Dates: expiry > start
- [ ] Billing cycle: valid enum
- [ ] Status: valid enum
- [ ] Foreign keys: must exist in DB

### **Business Logic:**
- [ ] Auto-increment used_slots on create
- [ ] Auto-decrement used_slots on delete
- [ ] Auto-calculate expiry_date
- [ ] Prorated refund calculation correct
- [ ] Renewal workflow states correct
- [ ] Soft delete: data not permanently removed
- [ ] Multi-tenant: can't see other accounts' data

### **Response Format:**
- [ ] Success responses: {"success": true, "data": ...}
- [ ] Error responses: {"success": false, "error": "..."}
- [ ] Paginated: {"success": true, "data": [], "pagination": {...}}
- [ ] Timestamps: ISO format
- [ ] HTTP codes: correct (200, 201, 400, 404, etc.)

### **Performance:**
- [ ] Pagination works (limit max 100)
- [ ] Sorting works (asc/desc)
- [ ] Filtering works (multiple filters)
- [ ] Response time acceptable (< 500ms)

---

## 📊 STATUS TRACKING

| Test | Endpoint | Status | Notes |
|------|----------|--------|-------|
| 1 | GET /subscriptions | ⬜ | List endpoint |
| 2 | POST /subscriptions | ⬜ | Create endpoint |
| 3 | GET /subscriptions/[id] | ⬜ | Get single |
| 4 | DELETE /subscriptions/[id] | ⬜ | Soft delete |
| 5 | PUT /subscriptions/[id]/renew | ⬜ | Renewal request |
| 6 | POST /subscriptions/[id]/refund | ⬜ | Refund calc |
| 7 | GET /subscriptions/expiring | ⬜ | Expiring list |
| 8a | GET /renewals | ⬜ | Renewals list |
| 8b | POST /renewals (confirm) | ⬜ | Confirm renewal |
| 8c | POST /renewals (deny) | ⬜ | Deny renewal |
| 9 | Complete workflow | ⬜ | Full cycle |

---

## 🚀 HOW TO RUN TESTS

### **Option 1: PowerShell (Windows)**
```powershell
cd d:\GITHUB\managerorder\premium-admin-web
powershell -ExecutionPolicy Bypass -File test-phase3.ps1
```

### **Option 2: Bash (Linux/Mac/WSL)**
```bash
cd /path/to/premium-admin-web
bash test-phase3.sh
```

### **Option 3: Manual Curl**
See `PHASE3_CURL_EXAMPLES.sh` for copy-paste commands

### **Option 4: Postman**
1. Import `Phase3-Subscriptions.json`
2. Set variables in pre-request scripts
3. Run collection

---

## 📝 TEST LOG

Date: _______________
Tester: _______________
Environment: _______________

### Test Results:

```
Total Tests: ___
Passed: ___  ✅
Failed: ___  ❌
Skipped: ___ ⏭️

Issues Found:
1. ___________________
2. ___________________
3. ___________________

Notes:
_______________________
_______________________
```

---

## ✅ QUICK PASS/FAIL CRITERIA

**All tests PASS if:**
- [ ] All 9 endpoints return correct status codes
- [ ] All responses have correct structure
- [ ] All validations working
- [ ] Business logic correct
- [ ] No errors in console
- [ ] used_slots updated correctly
- [ ] Soft delete working

**ANY test FAILS if:**
- [ ] Wrong HTTP status code
- [ ] Missing fields in response
- [ ] Validation not working
- [ ] Side-effects not happening
- [ ] Data inconsistencies
- [ ] Errors not handled properly

---

**Status:** Ready to test! 🚀

Choose your testing method above and begin! 🧪
