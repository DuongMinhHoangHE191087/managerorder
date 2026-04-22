# 🧪 PHASE 3 TESTING GUIDE - Subscriptions API

**Date:** March 5, 2026  
**Status:** Testing Ready  
**Total Endpoints:** 9  
**Test Duration:** ~30 minutes  

---

## ⚡ QUICK START - 5 MINUTE TEST

### **1. Setup Test Account ID**

Use this in all requests:
```
x-account-id: 550e8400-e29b-41d4-a716-446655440000
```

### **2. Get IDs from Phase 1/2**

From Phase 1 & 2, get these IDs:
```bash
# Get service_type_id
GET http://localhost:3000/api/premium/services
→ Copy first service's "id" field

# Get package_id
GET http://localhost:3000/api/premium/packages
→ Copy first package's "id" field

# Get premium_account_id
GET http://localhost:3000/api/premium/accounts
→ Copy first account's "id" field
```

### **3. Quick Create Subscription Test**

```bash
curl -X POST http://localhost:3000/api/premium/subscriptions \
  -H "Content-Type: application/json" \
  -H "x-account-id: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "customer_id": "cust-12345",
    "premium_account_id": "paste-premium-account-id-here",
    "service_type_id": "paste-service-type-id-here",
    "package_id": "paste-package-id-here",
    "billing_cycle": "1month",
    "original_price": 30.00,
    "final_price": 30.00
  }'
```

**Expected:** 201 Created ✅

---

## 📋 FULL TESTING GUIDE - ALL 9 ENDPOINTS

### **Test 1: GET /api/premium/subscriptions - List All**

```bash
curl -X GET "http://localhost:3000/api/premium/subscriptions?page=1&limit=10&status=active" \
  -H "x-account-id: 550e8400-e29b-41d4-a716-446655440000"
```

**Query Parameters:**
```
page=1                (pagination)
limit=20              (default)
sort=created_at       (optional)
order=desc            (asc/desc)
status=active         (active/expired/cancelled/renewed)
service_type_id=uuid  (filter by service)
package_id=uuid       (filter by package)
customer_id=uuid      (filter by customer)
renewal_status=none   (none/pending/confirmed/denied)
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "subscription-uuid",
      "customer_id": "cust-12345",
      "premium_account_id": "account-uuid",
      "status": "active",
      "renewal_status": "none",
      "billing_cycle": "1month",
      "start_date": "2026-03-05",
      "expiry_date": "2026-04-05",
      "original_price": 30.00,
      "final_price": 30.00,
      "days_remaining": 31,
      "premium_accounts": { ... },
      "premium_packages": { ... },
      "premium_service_types": { ... }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

---

### **Test 2: POST /api/premium/subscriptions - Create**

```bash
curl -X POST http://localhost:3000/api/premium/subscriptions \
  -H "Content-Type: application/json" \
  -H "x-account-id: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "customer_id": "test-customer-001",
    "premium_account_id": "YOUR_PREMIUM_ACCOUNT_ID",
    "service_type_id": "YOUR_SERVICE_TYPE_ID",
    "package_id": "YOUR_PACKAGE_ID",
    "billing_cycle": "1month",
    "original_price": 30.00,
    "final_price": 28.00,
    "discount": 2.00,
    "notes": "Test subscription"
  }'
```

**Body Parameters:**
```json
{
  "customer_id": "required - unique per request",
  "premium_account_id": "required - must exist",
  "service_type_id": "required - must match package",
  "package_id": "required - must exist",
  "billing_cycle": "required - 1month|3months|6months|1year",
  "start_date": "optional - auto-set to today",
  "expiry_date": "optional - auto-calculated from billing_cycle",
  "original_price": "required - positive number",
  "discount": "optional - default 0",
  "final_price": "required - positive number",
  "notes": "optional - any text"
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "sub-uuid-new",
    "customer_id": "test-customer-001",
    "premium_account_id": "...",
    "status": "active",
    "renewal_status": "none",
    "start_date": "2026-03-05",
    "expiry_date": "2026-04-05",
    "days_remaining": 31,
    "original_price": 30.00,
    "final_price": 28.00,
    "created_at": "2026-03-05T...",
    ...
  },
  "message": "Subscription created successfully"
}
```

**⚠️ Common Errors:**

```json
// Missing required field
{
  "success": false,
  "error": "Missing required fields: customer_id, premium_account_id"
}

// Premium account not found
{
  "success": false,
  "error": "Premium account not found"
}

// No available slots
{
  "success": false,
  "error": "No available slots in premium account"
}
```

---

### **Test 3: GET /api/premium/subscriptions/[id] - Get Single**

```bash
# First, get a subscription ID from Test 1, then:
curl -X GET http://localhost:3000/api/premium/subscriptions/SUBSCRIPTION_ID \
  -H "x-account-id: 550e8400-e29b-41d4-a716-446655440000"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "subscription-uuid",
    "customer_id": "test-customer-001",
    "premium_account_id": "...",
    "status": "active",
    "renewal_status": "none",
    "start_date": "2026-03-05",
    "expiry_date": "2026-04-05",
    "days_remaining": 31,
    "is_expiring_soon": false,
    "premium_accounts": {
      "id": "...",
      "primary_email": "account@example.com",
      "total_slots": 5,
      "used_slots": 1
    },
    "premium_packages": {
      "id": "...",
      "name": "ChatGPT Plus",
      "slug": "chatgpt-plus"
    },
    "premium_service_types": {
      "id": "...",
      "name": "ChatGPT",
      "category": "AI"
    },
    ...
  }
}
```

**Error Cases:**
```json
// Not found
{
  "success": false,
  "error": "Subscription not found"
}
```

---

### **Test 4: DELETE /api/premium/subscriptions/[id] - Soft Delete**

```bash
curl -X DELETE http://localhost:3000/api/premium/subscriptions/SUBSCRIPTION_ID \
  -H "x-account-id: 550e8400-e29b-41d4-a716-446655440000"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": null,
  "message": "Resource deleted successfully"
}
```

**✅ What Happens:**
- Subscription marked as deleted (deleted_at = NOW())
- Status set to 'cancelled'
- used_slots decremented in premium_account
- Data NOT permanently deleted (can be recovered)

**Verify:** Try to get the same subscription - should return 404

---

### **Test 5: PUT /api/premium/subscriptions/[id]/renew - Request Renewal**

```bash
curl -X PUT http://localhost:3000/api/premium/subscriptions/SUBSCRIPTION_ID/renew \
  -H "Content-Type: application/json" \
  -H "x-account-id: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{}'
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "renewal-uuid",
    "account_id": "550e8400-e29b-41d4-a716-446655440000",
    "original_subscription_id": "subscription-uuid",
    "customer_id": "test-customer-001",
    "premium_account_id": "...",
    "renewal_requested_date": "2026-03-05T...",
    "status": "pending",
    "refund_calculated": false,
    "migrate_to_new_account": false,
    "customer_premium_subscriptions": {
      "id": "subscription-uuid",
      "billing_cycle": "1month",
      "original_price": 30.00,
      "final_price": 28.00
    }
  },
  "message": "Renewal request created successfully"
}
```

**✅ What Happens:**
- Renewal record created
- Subscription renewal_status → 'pending'
- renewal_asked_at timestamp recorded
- Ready for confirm/deny

**Error Cases:**
```json
// Renewal already pending
{
  "success": false,
  "error": "Renewal already pending for this subscription"
}

// Only active subscriptions
{
  "success": false,
  "error": "Only active subscriptions can be renewed"
}
```

---

### **Test 6: POST /api/premium/subscriptions/[id]/refund - Calculate Refund**

```bash
# First create a renewal and deny it in Test 8, then:
curl -X POST http://localhost:3000/api/premium/subscriptions/SUBSCRIPTION_ID/refund \
  -H "Content-Type: application/json" \
  -H "x-account-id: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "method": "prorated",
    "custom_amount": 15.00
  }'
```

**Body Parameters:**
```json
{
  "method": "prorated|full|partial",  (default: prorated)
  "custom_amount": 15.00              (required if method=partial)
}
```

**Prorated Calculation Example:**
```
Original Price: $30.00
Subscription Start: 2026-03-05 (30 days)
Expiry Date: 2026-04-05
Today: 2026-03-20 (20 days used, 10 days remaining)

Prorated Refund = (10 / 30) × $30.00 = $10.00
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "subscription-uuid",
      "refund_amount": 10.00,
      "status": "active",
      ...
    },
    "refund_calculation": {
      "method": "prorated",
      "refund_amount": 10.00,
      "currency": "USD",
      "original_price": 30.00,
      "days_remaining": 10,
      "calculation_date": "2026-03-20T..."
    }
  },
  "message": "Refund calculated successfully"
}
```

---

### **Test 7: GET /api/premium/subscriptions/expiring - Get Expiring Soon**

```bash
# Get subscriptions expiring within 7 days
curl -X GET "http://localhost:3000/api/premium/subscriptions/expiring?days_threshold=7&page=1&limit=20" \
  -H "x-account-id: 550e8400-e29b-41d4-a716-446655440000"
```

**Query Parameters:**
```
days_threshold=7      (default 7, max 30)
page=1                (pagination)
limit=20              (default)
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "subscription-uuid",
      "customer_id": "...",
      "status": "active",
      "expiry_date": "2026-03-10",
      "days_remaining": 5,
      "original_price": 30.00,
      "final_price": 28.00,
      "premium_accounts": { ... },
      "premium_packages": { ... },
      "premium_service_types": { ... }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

**✅ Use Case:**
- Send renewal reminder emails
- Notify customers of expiring accounts
- Prepare for renewals

---

### **Test 8a: POST /api/premium/renewals - List & Manage**

**GET - List all renewals:**
```bash
curl -X GET "http://localhost:3000/api/premium/renewals?status=pending&page=1&limit=20" \
  -H "x-account-id: 550e8400-e29b-41d4-a716-446655440000"
```

**Query Parameters:**
```
status=pending        (pending/confirmed/denied/completed/failed/refunded)
customer_id=uuid      (filter by customer)
page=1
limit=20
sort=created_at
order=desc
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "renewal-uuid",
      "status": "pending",
      "original_subscription_id": "sub-uuid",
      "customer_id": "...",
      "premium_account_id": "...",
      "renewal_requested_date": "2026-03-05T...",
      "customer_premium_subscriptions": {
        "id": "...",
        "original_price": 30.00,
        "final_price": 28.00
      }
    }
  ],
  "pagination": { ... }
}
```

---

### **Test 8b: POST /api/premium/renewals - Confirm Renewal**

```bash
curl -X POST http://localhost:3000/api/premium/renewals \
  -H "Content-Type: application/json" \
  -H "x-account-id: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "action": "confirm",
    "renewal_id": "RENEWAL_ID_FROM_TEST_5",
    "renewal_price": 28.00,
    "new_billing_cycle": "3months"
  }'
```

**Body Parameters - Confirm:**
```json
{
  "action": "confirm",                  (required)
  "renewal_id": "renewal-uuid",         (required)
  "renewal_price": 28.00,               (optional, current price used if not set)
  "new_billing_cycle": "3months"        (optional, current cycle if not set)
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "renewal-uuid",
    "status": "confirmed",
    "renewal_confirmed_date": "2026-03-05T...",
    "renewal_price": 28.00,
    "total_price": 28.00,
    "new_billing_cycle": "3months"
  },
  "message": "Renewal confirmed successfully"
}
```

**✅ What Happens:**
- Renewal status → 'confirmed'
- Subscription renewal_status → 'confirmed'
- New price recorded
- New billing cycle recorded (optional)
- Ready for payment/processing

---

### **Test 8c: POST /api/premium/renewals - Deny Renewal**

```bash
# First create another renewal for this test
# Then deny it:
curl -X POST http://localhost:3000/api/premium/renewals \
  -H "Content-Type: application/json" \
  -H "x-account-id: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "action": "deny",
    "renewal_id": "DIFFERENT_RENEWAL_ID",
    "reason": "Customer not interested in renewal"
  }'
```

**Body Parameters - Deny:**
```json
{
  "action": "deny",                     (required)
  "renewal_id": "renewal-uuid",         (required)
  "reason": "Not interested"            (optional)
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "renewal-uuid",
    "status": "denied",
    "customer_response_date": "2026-03-05T...",
    "customer_response": "decline",
    "decline_reason": "Customer not interested in renewal"
  },
  "message": "Renewal denied successfully"
}
```

**✅ What Happens:**
- Renewal status → 'denied'
- Subscription renewal_status → 'denied'
- Decline reason recorded
- Ready for refund calculation

---

### **Test 9: Complete Denial + Refund Workflow**

**Complete cycle:**

1. **Create subscription** (Test 2)
   ```bash
   POST /subscriptions → 201
   Result: subscription_id, renewal_status: none
   ```

2. **Request renewal** (Test 5)
   ```bash
   PUT /subscriptions/{id}/renew → 200
   Result: renewal_id, renewal status: pending
   ```

3. **Deny renewal** (Test 8c)
   ```bash
   POST /renewals (action: deny, reason) → 200
   Result: renewal status: denied
   ```

4. **Calculate refund** (Test 6)
   ```bash
   POST /subscriptions/{id}/refund (method: prorated) → 200
   Result: refund_amount: $X.XX
   ```

5. **Delete subscription** (Test 4)
   ```bash
   DELETE /subscriptions/{id} → 200
   Result: subscription deleted (soft), used_slots decremented
   ```

---

## 🔍 TROUBLESHOOTING

### **Issue: 401 Unauthorized**
```
Problem: x-account-id header missing
Solution: Add header: -H "x-account-id: 550e8400-e29b-41d4-a716-446655440000"
```

### **Issue: 403 Forbidden**
```
Problem: Account access denied
Solution: Check account_id matches your test account
```

### **Issue: 404 Not Found**
```
Problem: Resource doesn't exist
Solution:
  1. Verify ID from previous request
  2. Check if subscription is not deleted
  3. Confirm IDs are UUIDs format
```

### **Issue: 422 Validation Error**
```
Problem: Invalid input data
Solution:
  1. Check all required fields present
  2. Verify pricing is positive
  3. Confirm dates format: YYYY-MM-DD
  4. Check billing_cycle is valid: 1month|3months|6months|1year
```

### **Issue: Premium account not found**
```
Problem: premium_account_id doesn't exist
Solution:
  1. Create premium account first (Phase 2)
  2. Get ID from: GET /api/premium/accounts
  3. Verify account has available slots (total > used)
```

---

## 📊 TEST EXECUTION CHECKLIST

```
✅ Test 1: GET /subscriptions - List all
   Expected: 200, paginated list

✅ Test 2: POST /subscriptions - Create
   Expected: 201, subscription created

✅ Test 3: GET /subscriptions/[id] - Get single
   Expected: 200, full subscription details

✅ Test 4: DELETE /subscriptions/[id] - Soft delete
   Expected: 200, subscription marked deleted

✅ Test 5: PUT /subscriptions/[id]/renew - Request renewal
   Expected: 200, renewal created (pending)

✅ Test 6: POST /subscriptions/[id]/refund - Calculate refund
   Expected: 200, refund calculation

✅ Test 7: GET /subscriptions/expiring - Get expiring soon
   Expected: 200, subscriptions expiring within N days

✅ Test 8a: GET /renewals - List renewals
   Expected: 200, paginated list

✅ Test 8b: POST /renewals (confirm) - Confirm renewal
   Expected: 200, renewal confirmed

✅ Test 8c: POST /renewals (deny) - Deny renewal
   Expected: 200, renewal denied

✅ Test 9: Complete workflow
   Expected: Full cycle working
```

---

## 🚀 POSTMAN COLLECTION

Save this as `Phase3-Subscriptions.json` in Postman:

```json
{
  "info": {
    "name": "Phase 3 - Subscriptions API",
    "description": "Premium Subscriptions API Testing",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. List Subscriptions",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "x-account-id",
            "value": "550e8400-e29b-41d4-a716-446655440000"
          }
        ],
        "url": {
          "raw": "http://localhost:3000/api/premium/subscriptions?page=1&limit=20&status=active",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "premium", "subscriptions"],
          "query": [
            { "key": "page", "value": "1" },
            { "key": "limit", "value": "20" },
            { "key": "status", "value": "active" }
          ]
        }
      }
    },
    {
      "name": "2. Create Subscription",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "x-account-id", "value": "550e8400-e29b-41d4-a716-446655440000" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"customer_id\": \"cust-{{$timestamp}}\",\n  \"premium_account_id\": \"PASTE_ACCOUNT_ID\",\n  \"service_type_id\": \"PASTE_SERVICE_ID\",\n  \"package_id\": \"PASTE_PACKAGE_ID\",\n  \"billing_cycle\": \"1month\",\n  \"original_price\": 30.00,\n  \"final_price\": 28.00,\n  \"notes\": \"Test subscription\"\n}"
        },
        "url": {
          "raw": "http://localhost:3000/api/premium/subscriptions",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "premium", "subscriptions"]
        }
      }
    }
  ]
}
```

---

## 📝 NOTES

- All timestamps in ISO format: `2026-03-05T15:30:00Z`
- All prices in USD (decimal format: 30.00)
- Date format: `YYYY-MM-DD`
- UUIDs: standard format (36 chars with hyphens)
- Pagination: max 100 per page
- Soft delete: data recoverable via admin

---

**Ready to test?** Start with Test 1! 🚀
