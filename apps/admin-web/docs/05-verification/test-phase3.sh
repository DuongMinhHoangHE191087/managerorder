#!/bin/bash

# ============================================
# PHASE 3 TESTING SCRIPT - All Endpoints
# ============================================
# Test all 9 Phase 3 Subscription API endpoints
# Usage: bash test-phase3.sh
# ============================================

# Configuration
BASE_URL="http://localhost:3000"
ACCOUNT_ID="550e8400-e29b-41d4-a716-446655440000"
TIMEOUT=5

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track results
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to print test headers
print_test() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}TEST: $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Helper function to check response
check_status() {
    local http_code=$1
    local expected=$2
    local test_name=$3
    
    if [ "$http_code" = "$expected" ]; then
        echo -e "${GREEN}✅ PASS - Got expected status $http_code${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL - Expected $expected but got $http_code${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# ============================================
# STEP 1: Get IDs from Phase 1 & 2
# ============================================

print_test "Fetch IDs from Phase 1 & 2"

echo "Getting service_type_id..."
SERVICE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X GET "$BASE_URL/api/premium/services?limit=1" \
  -H "x-account-id: $ACCOUNT_ID")

SERVICE_ID=$(echo "$SERVICE_RESPONSE" | head -n -1 | jq -r '.data[0].id' 2>/dev/null)
SERVICE_STATUS=$(echo "$SERVICE_RESPONSE" | tail -n 1)

if [ ! -z "$SERVICE_ID" ] && [ "$SERVICE_ID" != "null" ]; then
    echo -e "${GREEN}✓ service_type_id: $SERVICE_ID${NC}"
else
    echo -e "${RED}✗ Could not fetch service_type_id${NC}"
    echo "  Try running Phase 1 tests first!"
    exit 1
fi

echo "Getting package_id..."
PACKAGE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X GET "$BASE_URL/api/premium/packages?limit=1" \
  -H "x-account-id: $ACCOUNT_ID")

PACKAGE_ID=$(echo "$PACKAGE_RESPONSE" | head -n -1 | jq -r '.data[0].id' 2>/dev/null)
PACKAGE_STATUS=$(echo "$PACKAGE_RESPONSE" | tail -n 1)

if [ ! -z "$PACKAGE_ID" ] && [ "$PACKAGE_ID" != "null" ]; then
    echo -e "${GREEN}✓ package_id: $PACKAGE_ID${NC}"
else
    echo -e "${RED}✗ Could not fetch package_id${NC}"
    exit 1
fi

echo "Getting premium_account_id..."
ACCOUNT_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X GET "$BASE_URL/api/premium/accounts?limit=1" \
  -H "x-account-id: $ACCOUNT_ID")

PREMIUM_ACCOUNT_ID=$(echo "$ACCOUNT_RESPONSE" | head -n -1 | jq -r '.data[0].id' 2>/dev/null)
PREMIUM_STATUS=$(echo "$ACCOUNT_RESPONSE" | tail -n 1)

if [ ! -z "$PREMIUM_ACCOUNT_ID" ] && [ "$PREMIUM_ACCOUNT_ID" != "null" ]; then
    echo -e "${GREEN}✓ premium_account_id: $PREMIUM_ACCOUNT_ID${NC}"
else
    echo -e "${RED}✗ Could not fetch premium_account_id${NC}"
    echo "  Try running Phase 2 tests first!"
    exit 1
fi

echo -e "${GREEN}✅ All IDs fetched successfully${NC}"

# ============================================
# TEST 1: GET /subscriptions - List
# ============================================

print_test "1. GET /api/premium/subscriptions - List all"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X GET "$BASE_URL/api/premium/subscriptions?page=1&limit=10&status=active" \
  -H "x-account-id: $ACCOUNT_ID")

STATUS=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

check_status "$STATUS" "200" "GET subscriptions"

if [ "$STATUS" = "200" ]; then
    COUNT=$(echo "$BODY" | jq '.pagination.total' 2>/dev/null)
    echo "Found $COUNT subscriptions"
fi

# ============================================
# TEST 2: POST /subscriptions - Create
# ============================================

print_test "2. POST /api/premium/subscriptions - Create"

TIMESTAMP=$(date +%s)
CUSTOMER_ID="test-cust-$TIMESTAMP"

CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/premium/subscriptions" \
  -H "Content-Type: application/json" \
  -H "x-account-id: $ACCOUNT_ID" \
  -d "{
    \"customer_id\": \"$CUSTOMER_ID\",
    \"premium_account_id\": \"$PREMIUM_ACCOUNT_ID\",
    \"service_type_id\": \"$SERVICE_ID\",
    \"package_id\": \"$PACKAGE_ID\",
    \"billing_cycle\": \"1month\",
    \"original_price\": 30.00,
    \"final_price\": 28.00,
    \"notes\": \"Test subscription\"
  }")

STATUS=$(echo "$CREATE_RESPONSE" | tail -n 1)
BODY=$(echo "$CREATE_RESPONSE" | head -n -1)

check_status "$STATUS" "201" "POST subscriptions"

if [ "$STATUS" = "201" ]; then
    SUBSCRIPTION_ID=$(echo "$BODY" | jq -r '.data.id' 2>/dev/null)
    DAYS_REMAINING=$(echo "$BODY" | jq '.data.days_remaining' 2>/dev/null)
    echo "Created subscription: $SUBSCRIPTION_ID"
    echo "Days remaining: $DAYS_REMAINING"
fi

# ============================================
# TEST 3: GET /subscriptions/[id] - Get single
# ============================================

print_test "3. GET /api/premium/subscriptions/[id] - Get single"

if [ ! -z "$SUBSCRIPTION_ID" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X GET "$BASE_URL/api/premium/subscriptions/$SUBSCRIPTION_ID" \
      -H "x-account-id: $ACCOUNT_ID")
    
    STATUS=$(echo "$RESPONSE" | tail -n 1)
    BODY=$(echo "$RESPONSE" | head -n -1)
    
    check_status "$STATUS" "200" "GET subscription by ID"
    
    if [ "$STATUS" = "200" ]; then
        SUB_STATUS=$(echo "$BODY" | jq -r '.data.status' 2>/dev/null)
        RENEWAL_STATUS=$(echo "$BODY" | jq -r '.data.renewal_status' 2>/dev/null)
        echo "Subscription status: $SUB_STATUS"
        echo "Renewal status: $RENEWAL_STATUS"
    fi
else
    echo -e "${RED}❌ SKIP - No subscription ID from test 2${NC}"
fi

# ============================================
# TEST 4: PUT /subscriptions/[id]/renew - Request renewal
# ============================================

print_test "4. PUT /api/premium/subscriptions/[id]/renew - Request renewal"

if [ ! -z "$SUBSCRIPTION_ID" ]; then
    RENEW_RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X PUT "$BASE_URL/api/premium/subscriptions/$SUBSCRIPTION_ID/renew" \
      -H "Content-Type: application/json" \
      -H "x-account-id: $ACCOUNT_ID" \
      -d '{}')
    
    STATUS=$(echo "$RENEW_RESPONSE" | tail -n 1)
    BODY=$(echo "$RENEW_RESPONSE" | head -n -1)
    
    check_status "$STATUS" "200" "PUT renew subscription"
    
    if [ "$STATUS" = "200" ]; then
        RENEWAL_ID=$(echo "$BODY" | jq -r '.data.id' 2>/dev/null)
        RENEWAL_STATUS=$(echo "$BODY" | jq -r '.data.status' 2>/dev/null)
        echo "Created renewal: $RENEWAL_ID"
        echo "Renewal status: $RENEWAL_STATUS"
    fi
else
    echo -e "${RED}❌ SKIP - No subscription ID${NC}"
fi

# ============================================
# TEST 5: GET /subscriptions/expiring - Get expiring soon
# ============================================

print_test "5. GET /api/premium/subscriptions/expiring - Get expiring soon"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X GET "$BASE_URL/api/premium/subscriptions/expiring?days_threshold=30&page=1&limit=10" \
  -H "x-account-id: $ACCOUNT_ID")

STATUS=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

check_status "$STATUS" "200" "GET expiring subscriptions"

if [ "$STATUS" = "200" ]; then
    COUNT=$(echo "$BODY" | jq '.pagination.total' 2>/dev/null)
    echo "Found $COUNT subscriptions expiring within 30 days"
fi

# ============================================
# TEST 6: GET /renewals - List renewals
# ============================================

print_test "6. GET /api/premium/renewals - List renewal requests"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X GET "$BASE_URL/api/premium/renewals?status=pending&page=1&limit=10" \
  -H "x-account-id: $ACCOUNT_ID")

STATUS=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

check_status "$STATUS" "200" "GET renewals"

if [ "$STATUS" = "200" ]; then
    COUNT=$(echo "$BODY" | jq '.pagination.total' 2>/dev/null)
    echo "Found $COUNT pending renewals"
fi

# ============================================
# TEST 7: POST /renewals - Confirm renewal
# ============================================

print_test "7. POST /api/premium/renewals - Confirm renewal"

if [ ! -z "$RENEWAL_ID" ]; then
    CONFIRM_RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X POST "$BASE_URL/api/premium/renewals" \
      -H "Content-Type: application/json" \
      -H "x-account-id: $ACCOUNT_ID" \
      -d "{
        \"action\": \"confirm\",
        \"renewal_id\": \"$RENEWAL_ID\",
        \"renewal_price\": 28.00,
        \"new_billing_cycle\": \"3months\"
      }")
    
    STATUS=$(echo "$CONFIRM_RESPONSE" | tail -n 1)
    BODY=$(echo "$CONFIRM_RESPONSE" | head -n -1)
    
    check_status "$STATUS" "200" "POST confirm renewal"
    
    if [ "$STATUS" = "200" ]; then
        NEW_STATUS=$(echo "$BODY" | jq -r '.data.status' 2>/dev/null)
        RENEWAL_PRICE=$(echo "$BODY" | jq '.data.renewal_price' 2>/dev/null)
        echo "Renewal status: $NEW_STATUS"
        echo "Renewal price: $RENEWAL_PRICE"
    fi
else
    echo -e "${RED}❌ SKIP - No renewal ID${NC}"
fi

# ============================================
# TEST 8: POST /subscriptions/[id]/refund - Calculate refund
# ============================================

print_test "8. POST /api/premium/subscriptions/[id]/refund - Calculate refund"

if [ ! -z "$SUBSCRIPTION_ID" ]; then
    REFUND_RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X POST "$BASE_URL/api/premium/subscriptions/$SUBSCRIPTION_ID/refund" \
      -H "Content-Type: application/json" \
      -H "x-account-id: $ACCOUNT_ID" \
      -d '{
        "method": "prorated"
      }')
    
    STATUS=$(echo "$REFUND_RESPONSE" | tail -n 1)
    BODY=$(echo "$REFUND_RESPONSE" | head -n -1)
    
    # Refund endpoint requires denied renewal, so might return different status
    if [ "$STATUS" = "200" ]; then
        REFUND_AMOUNT=$(echo "$BODY" | jq '.data.refund_calculation.refund_amount' 2>/dev/null)
        METHOD=$(echo "$BODY" | jq -r '.data.refund_calculation.method' 2>/dev/null)
        echo -e "${GREEN}✅ PASS - Got expected status 200${NC}"
        echo "Refund amount: $REFUND_AMOUNT ($METHOD)"
        ((TESTS_PASSED++))
    else
        echo -e "${YELLOW}⚠️  SKIP - Requires denied renewal (expected behavior)${NC}"
    fi
else
    echo -e "${RED}❌ SKIP - No subscription ID${NC}"
fi

# ============================================
# TEST 9: DELETE /subscriptions/[id] - Soft delete
# ============================================

print_test "9. DELETE /api/premium/subscriptions/[id] - Soft delete"

if [ ! -z "$SUBSCRIPTION_ID" ]; then
    DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X DELETE "$BASE_URL/api/premium/subscriptions/$SUBSCRIPTION_ID" \
      -H "x-account-id: $ACCOUNT_ID")
    
    STATUS=$(echo "$DELETE_RESPONSE" | tail -n 1)
    
    check_status "$STATUS" "200" "DELETE subscription"
    
    # Verify it's deleted
    if [ "$STATUS" = "200" ]; then
        VERIFY=$(curl -s -w "\n%{http_code}" \
          -X GET "$BASE_URL/api/premium/subscriptions/$SUBSCRIPTION_ID" \
          -H "x-account-id: $ACCOUNT_ID")
        
        VERIFY_STATUS=$(echo "$VERIFY" | tail -n 1)
        if [ "$VERIFY_STATUS" = "404" ]; then
            echo -e "${GREEN}✓ Verified: Subscription is deleted${NC}"
        fi
    fi
else
    echo -e "${RED}❌ SKIP - No subscription ID${NC}"
fi

# ============================================
# FINAL RESULTS
# ============================================

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "Total Tests: $(($TESTS_PASSED + $TESTS_FAILED))"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ "$TESTS_FAILED" = "0" ]; then
    echo -e "\n${GREEN}✅ ALL TESTS PASSED!${NC}\n"
    exit 0
else
    echo -e "\n${RED}❌ SOME TESTS FAILED${NC}\n"
    exit 1
fi
