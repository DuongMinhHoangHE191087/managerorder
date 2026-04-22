#!/bin/bash

# ============================================
# PHASE 3 - MANUAL CURL TESTING EXAMPLES
# ============================================
# Copy and paste these commands to test Phase 3 endpoints
# ============================================

# Configuration - UPDATE THESE WITH YOUR IDs
ACCOUNT_ID="550e8400-e29b-41d4-a716-446655440000"
BASE_URL="http://localhost:3000"
SERVICE_TYPE_ID="paste-your-service-id-here"
PACKAGE_ID="paste-your-package-id-here"
PREMIUM_ACCOUNT_ID="paste-your-premium-account-id-here"
CUSTOMER_ID="test-customer-$(date +%s)"

# ============================================
# 1. LIST SUBSCRIPTIONS
# ============================================

echo "TEST 1: List all subscriptions"
curl -X GET "${BASE_URL}/api/premium/subscriptions?page=1&limit=20&status=active" \
  -H "x-account-id: ${ACCOUNT_ID}" \
  -H "Content-Type: application/json" | jq .


# ============================================
# 2. CREATE SUBSCRIPTION
# ============================================

echo -e "\nTEST 2: Create subscription"
curl -X POST "${BASE_URL}/api/premium/subscriptions" \
  -H "x-account-id: ${ACCOUNT_ID}" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"${CUSTOMER_ID}\",
    \"premium_account_id\": \"${PREMIUM_ACCOUNT_ID}\",
    \"service_type_id\": \"${SERVICE_TYPE_ID}\",
    \"package_id\": \"${PACKAGE_ID}\",
    \"billing_cycle\": \"1month\",
    \"original_price\": 30.00,
    \"final_price\": 28.00,
    \"discount\": 2.00,
    \"notes\": \"Test subscription from curl\"
  }" | jq .

# SAVE: Copy the 'id' from response as SUBSCRIPTION_ID


# ============================================
# 3. GET SINGLE SUBSCRIPTION
# ============================================

echo -e "\nTEST 3: Get single subscription"
SUBSCRIPTION_ID="paste-subscription-id-from-test-2"

curl -X GET "${BASE_URL}/api/premium/subscriptions/${SUBSCRIPTION_ID}" \
  -H "x-account-id: ${ACCOUNT_ID}" \
  -H "Content-Type: application/json" | jq .


# ============================================
# 4. REQUEST RENEWAL
# ============================================

echo -e "\nTEST 4: Request renewal"
curl -X PUT "${BASE_URL}/api/premium/subscriptions/${SUBSCRIPTION_ID}/renew" \
  -H "x-account-id: ${ACCOUNT_ID}" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .

# SAVE: Copy the 'id' from response as RENEWAL_ID


# ============================================
# 5. GET EXPIRING SUBSCRIPTIONS
# ============================================

echo -e "\nTEST 5: Get subscriptions expiring within 7 days"
curl -X GET "${BASE_URL}/api/premium/subscriptions/expiring?days_threshold=7&page=1&limit=20" \
  -H "x-account-id: ${ACCOUNT_ID}" \
  -H "Content-Type: application/json" | jq .


# ============================================
# 6. LIST RENEWAL REQUESTS
# ============================================

echo -e "\nTEST 6: List renewal requests"
curl -X GET "${BASE_URL}/api/premium/renewals?status=pending&page=1&limit=20" \
  -H "x-account-id: ${ACCOUNT_ID}" \
  -H "Content-Type: application/json" | jq .


# ============================================
# 7. CONFIRM RENEWAL
# ============================================

echo -e "\nTEST 7: Confirm renewal"
RENEWAL_ID="paste-renewal-id-from-test-4"

curl -X POST "${BASE_URL}/api/premium/renewals" \
  -H "x-account-id: ${ACCOUNT_ID}" \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"confirm\",
    \"renewal_id\": \"${RENEWAL_ID}\",
    \"renewal_price\": 28.00,
    \"new_billing_cycle\": \"3months\"
  }" | jq .


# ============================================
# 8. DENY RENEWAL (ALTERNATE - use for another renewal)
# ============================================

echo -e "\nTEST 8: Deny renewal (for different renewal)"
# First create another subscription and renewal...
# RENEWAL_ID_2="paste-another-renewal-id"

curl -X POST "${BASE_URL}/api/premium/renewals" \
  -H "x-account-id: ${ACCOUNT_ID}" \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"deny\",
    \"renewal_id\": \"RENEWAL_ID_2\",
    \"reason\": \"Customer not interested\"
  }" | jq .


# ============================================
# 9. CALCULATE REFUND
# ============================================

echo -e "\nTEST 9: Calculate refund (prorated)"
curl -X POST "${BASE_URL}/api/premium/subscriptions/${SUBSCRIPTION_ID}/refund" \
  -H "x-account-id: ${ACCOUNT_ID}" \
  -H "Content-Type: application/json" \
  -d "{
    \"method\": \"prorated\"
  }" | jq .

# Other methods:
# "method": "full"       (full refund)
# "method": "partial", "custom_amount": 15.00


# ============================================
# 10. DELETE SUBSCRIPTION
# ============================================

echo -e "\nTEST 10: Delete subscription"
curl -X DELETE "${BASE_URL}/api/premium/subscriptions/${SUBSCRIPTION_ID}" \
  -H "x-account-id: ${ACCOUNT_ID}" \
  -H "Content-Type: application/json" | jq .

# Verify deletion
echo -e "\nVerify deletion (should return 404):"
curl -X GET "${BASE_URL}/api/premium/subscriptions/${SUBSCRIPTION_ID}" \
  -H "x-account-id: ${ACCOUNT_ID}" \
  -H "Content-Type: application/json" | jq .


# ============================================
# FILTERING & SORTING EXAMPLES
# ============================================

echo -e "\n\n=== FILTERING & SORTING EXAMPLES ==="

echo -e "\nFiltered by status:"
curl -X GET "${BASE_URL}/api/premium/subscriptions?status=active&limit=5" \
  -H "x-account-id: ${ACCOUNT_ID}" | jq .

echo -e "\nFiltered by customer:"
curl -X GET "${BASE_URL}/api/premium/subscriptions?customer_id=cust-123&limit=5" \
  -H "x-account-id: ${ACCOUNT_ID}" | jq .

echo -e "\nSorted by expiry date (descending):"
curl -X GET "${BASE_URL}/api/premium/subscriptions?sort=expiry_date&order=desc&limit=5" \
  -H "x-account-id: ${ACCOUNT_ID}" | jq .

echo -e "\nExpiring within 30 days:"
curl -X GET "${BASE_URL}/api/premium/subscriptions/expiring?days_threshold=30&limit=10" \
  -H "x-account-id: ${ACCOUNT_ID}" | jq .


# ============================================
# ERROR HANDLING EXAMPLES
# ============================================

echo -e "\n\n=== ERROR HANDLING EXAMPLES ==="

echo -e "\n❌ Missing account ID (should return 403):"
curl -X GET "${BASE_URL}/api/premium/subscriptions" \
  -H "Content-Type: application/json" | jq .

echo -e "\n❌ Invalid subscription ID (should return 404):"
curl -X GET "${BASE_URL}/api/premium/subscriptions/invalid-uuid" \
  -H "x-account-id: ${ACCOUNT_ID}" | jq .

echo -e "\n❌ Missing required fields (should return 400):"
curl -X POST "${BASE_URL}/api/premium/subscriptions" \
  -H "x-account-id: ${ACCOUNT_ID}" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"test\"
  }" | jq .
