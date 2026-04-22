# 🎯 PHASE 3 QUICK REFERENCE CARD

**9 Endpoints | 30-minute Test | All Features**

---

## 📍 ENDPOINT SUMMARY

| # | Method | Endpoint | Purpose | Status |
|---|--------|----------|---------|--------|
| 1 | GET | `/api/premium/subscriptions` | List all | 200 |
| 2 | POST | `/api/premium/subscriptions` | Create | 201 |
| 3 | GET | `/api/premium/subscriptions/[id]` | Get single | 200 |
| 4 | DELETE | `/api/premium/subscriptions/[id]` | Delete | 200 |
| 5 | PUT | `/api/premium/subscriptions/[id]/renew` | Request renewal | 200 |
| 6 | POST | `/api/premium/subscriptions/[id]/refund` | Calc refund | 200 |
| 7 | GET | `/api/premium/subscriptions/expiring` | Expiring soon | 200 |
| 8a | GET | `/api/premium/renewals` | List renewals | 200 |
| 8b | POST | `/api/premium/renewals` (confirm) | Confirm renewal | 200 |
| 8c | POST | `/api/premium/renewals` (deny) | Deny renewal | 200 |

---

## 🔧 SETUP

```bash
# PowerShell (Windows)
powershell -ExecutionPolicy Bypass -File test-phase3.ps1

# Bash (Linux/Mac/WSL)
bash test-phase3.sh

# Manual with curl
curl http://localhost:3000/api/premium/subscriptions \
  -H "x-account-id: 550e8400-e29b-41d4-a716-446655440000"
```

---

## 📋 REQUIRED IDs

Get these from Phase 1 & 2 before testing:

```
account_id = "550e8400-e29b-41d4-a716-446655440000"
service_type_id = "GET /api/premium/services" → copy id
package_id = "GET /api/premium/packages" → copy id
premium_account_id = "GET /api/premium/accounts" → copy id
```

---

## 📍 ENDPOINT #1: List Subscriptions

```bash
GET /api/premium/subscriptions?page=1&limit=20&status=active
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": [
    {
      "id": "sub-uuid",
      "customer_id": "cust-123",
      "status": "active",
      "billing_cycle": "1month",
      "expiry_date": "2026-04-05",
      "days_remaining": 31,
      ...
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

## 📍 ENDPOINT #2: Create Subscription

```bash
POST /api/premium/subscriptions

{
  "customer_id": "test-customer",
  "premium_account_id": "YOUR_ID",
  "service_type_id": "YOUR_ID",
  "package_id": "YOUR_ID",
  "billing_cycle": "1month",
  "original_price": 30.00,
  "final_price": 28.00
}
```

**Response:** 201 Created
```json
{
  "success": true,
  "data": {
    "id": "new-sub-id",
    "status": "active",
    "renewal_status": "none",
    "start_date": "2026-03-05",
    "expiry_date": "2026-04-05",
    "days_remaining": 31,
    ...
  }
}
```

---

## 📍 ENDPOINT #3: Get Single Subscription

```bash
GET /api/premium/subscriptions/{subscription_id}
```

**Response:** 200 OK - Full subscription object with relationships

---

## 📍 ENDPOINT #4: Delete Subscription

```bash
DELETE /api/premium/subscriptions/{subscription_id}
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": null,
  "message": "Resource deleted successfully"
}
```

**What happens:**
- ✅ Soft delete (deleted_at set)
- ✅ Status → cancelled
- ✅ used_slots decremented
- ✅ Data NOT actually deleted

---

## 📍 ENDPOINT #5: Request Renewal

```bash
PUT /api/premium/subscriptions/{subscription_id}/renew
```

**Response:** 200 OK - Renewal object created
```json
{
  "success": true,
  "data": {
    "id": "renewal-id",
    "status": "pending",
    "renewal_requested_date": "2026-03-05T...",
    ...
  }
}
```

---

## 📍 ENDPOINT #6: Calculate Refund

```bash
POST /api/premium/subscriptions/{subscription_id}/refund

Body:
{
  "method": "prorated"  // or "full" or "partial"
}
```

**Calculation Examples:**
```
Prorated: (10 days left / 30 total) × $30 = $10 refund
Full: $30.00 (100%)
Partial: Custom amount (max = original)
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "subscription": { ... },
    "refund_calculation": {
      "method": "prorated",
      "refund_amount": 10.00,
      "original_price": 30.00,
      "days_remaining": 10
    }
  }
}
```

---

## 📍 ENDPOINT #7: Get Expiring Subscriptions

```bash
GET /api/premium/subscriptions/expiring?days_threshold=7
```

**Response:** 200 OK - List of subscriptions expiring within N days

---

## 📍 ENDPOINT #8a: List Renewal Requests

```bash
GET /api/premium/renewals?status=pending&page=1&limit=20
```

**Status Filters:**
- pending
- confirmed
- denied
- completed
- failed
- refunded

---

## 📍 ENDPOINT #8b: Confirm Renewal

```bash
POST /api/premium/renewals

{
  "action": "confirm",
  "renewal_id": "renewal-id",
  "renewal_price": 28.00,
  "new_billing_cycle": "3months"
}
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "id": "renewal-id",
    "status": "confirmed",
    "renewal_confirmed_date": "2026-03-05T...",
    "renewal_price": 28.00
  }
}
```

---

## 📍 ENDPOINT #8c: Deny Renewal

```bash
POST /api/premium/renewals

{
  "action": "deny",
  "renewal_id": "renewal-id",
  "reason": "Customer not interested"
}
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "id": "renewal-id",
    "status": "denied",
    "customer_response": "decline",
    "decline_reason": "Customer not interested"
  }
}
```

---

## ⚡ COMPLETE TESTING WORKFLOW

**5-minute complete test:**

```bash
# 1. Create subscription
POST /api/premium/subscriptions
→ Save subscription_id

# 2. Request renewal
PUT /api/premium/subscriptions/{id}/renew
→ Save renewal_id

# 3. List renewals
GET /api/premium/renewals?status=pending

# 4. Confirm renewal
POST /api/premium/renewals (action: confirm)

# 5. Calculate refund
POST /api/premium/subscriptions/{id}/refund (method: prorated)

# 6. List expiring
GET /api/premium/subscriptions/expiring

# 7. Delete subscription
DELETE /api/premium/subscriptions/{id}

# 8. Verify deleted (404)
GET /api/premium/subscriptions/{id}
```

---

## 🔴 COMMON ERRORS

| Error | Cause | Fix |
|-------|-------|-----|
| 400 Bad Request | Missing required fields | Provide: customer_id, premium_account_id, service_type_id, package_id, billing_cycle, original_price, final_price |
| 403 Forbidden | Missing x-account-id header | Add: `x-account-id: 550e8400-e29b-41d4-a716-446655440000` |
| 404 Not Found | ID doesn't exist | Verify ID in correct format, subscription not deleted |
| 409 Conflict | No available slots | Create Premium Account with slots first |
| 422 Unprocessable | Invalid data format | Check: pricing positive, dates valid, billing_cycle valid |

---

## ✅ SUCCESS CRITERIA

All tests PASS when:

- [ ] Status codes correct (200, 201, 400, 404, 409, 422)
- [ ] All required fields in responses
- [ ] Relationships populated
- [ ] Computed fields present (days_remaining, is_expiring_soon)
- [ ] Side-effects working (used_slots, renewal_status)
- [ ] Validation working (required fields, formats)
- [ ] Soft delete working (data not permanently deleted)
- [ ] Pagination working (page, limit, total, totalPages)

---

## 📚 FULL DOCUMENTATION

- **Testing Guide:** [PHASE3_TESTING_GUIDE.md](docs/04-implementation/PHASE3_TESTING_GUIDE.md)
- **Checklist:** [PHASE3_TESTING_CHECKLIST.md](PHASE3_TESTING_CHECKLIST.md)
- **Curl Examples:** [PHASE3_CURL_EXAMPLES.sh](PHASE3_CURL_EXAMPLES.sh)
- **PowerShell Script:** [test-phase3.ps1](test-phase3.ps1)
- **Bash Script:** [test-phase3.sh](test-phase3.sh)

---

## 🚀 READY TO TEST?

**Start here:**

1. ✅ Verify IDs (Phase 1 & 2 complete)
2. ✅ Open terminal
3. ✅ Run: `powershell -ExecutionPolicy Bypass -File test-phase3.ps1`
4. ✅ Check results

**Or manually test:**

1. Copy curl from [PHASE3_CURL_EXAMPLES.sh](PHASE3_CURL_EXAMPLES.sh)
2. Update IDs
3. Paste in terminal
4. Verify response

**Expected Time:** 30 minutes ⏱️

**All endpoints working?** → Proceed to Phase 4! 🎉

---

**Questions?** Check testing guide or see examples in PHASE3_CURL_EXAMPLES.sh

**Ready!** 🚀
