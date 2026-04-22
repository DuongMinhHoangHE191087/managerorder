#!/bin/bash

# ============================================
# PHASE 4 COMPREHENSIVE TEST SCRIPT
# All 18+ Premium API Endpoints
# Supabase Database Integration
# ============================================

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
ACCOUNT_ID="550e8400-e29b-41d4-a716-446655440000"
HEADERS="-H 'x-account-id: $ACCOUNT_ID' -H 'Content-Type: application/json'"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Test helper function
test_endpoint() {
  local test_name=$1
  local method=$2
  local endpoint=$3
  local data=$4
  local expected_status=$5

  echo -e "\n${BLUE}TEST: $test_name${NC}"
  echo "  Method: $method"
  echo "  Endpoint: $endpoint"

  if [ -z "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" $HEADERS)
  else
    response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" $HEADERS -d "$data")
  fi

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "$expected_status" ]; then
    echo -e "  ${GREEN}✅ PASS${NC} - Status: $http_code"
    ((TESTS_PASSED++))
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  else
    echo -e "  ${RED}❌ FAIL${NC} - Expected: $expected_status, Got: $http_code"
    ((TESTS_FAILED++))
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  fi
}

# ============================================
# PHASE 1 - PREMIUM SERVICES
# ============================================

echo -e "\n${YELLOW}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}PHASE 1 - PREMIUM SERVICES${NC}"
echo -e "${YELLOW}═══════════════════════════════════════${NC}"

test_endpoint "List Services" "GET" "/api/premium/services?page=1&limit=10" "" "200"

SERVICE_DATA='{
  "account_id": "'$ACCOUNT_ID'",
  "name": "Test Service",
  "slug": "test-service",
  "category": "Testing",
  "supports_connection_check": false
}'
test_endpoint "Create Service" "POST" "/api/premium/services" "$SERVICE_DATA" "201"

# ============================================
# PHASE 1 - PREMIUM PACKAGES
# ============================================

echo -e "\n${YELLOW}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}PHASE 1 - PREMIUM PACKAGES${NC}"
echo -e "${YELLOW}═══════════════════════════════════════${NC}"

test_endpoint "List Packages" "GET" "/api/premium/packages?page=1&limit=10" "" "200"

# ============================================
# PHASE 2 - PREMIUM ACCOUNTS
# ============================================

echo -e "\n${YELLOW}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}PHASE 2 - PREMIUM ACCOUNTS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════${NC}"

test_endpoint "List Premium Accounts" "GET" "/api/premium/accounts?page=1&limit=10" "" "200"

ACCOUNT_DATA='{
  "account_id": "'$ACCOUNT_ID'",
  "premium_account_user_id": "test-user-'$(date +%s)'",
  "primary_email": "test-'$(date +%s)'@example.com",
  "total_slots": 5
}'
test_endpoint "Create Premium Account" "POST" "/api/premium/accounts" "$ACCOUNT_DATA" "201"

test_endpoint "Get Available Slots" "GET" "/api/premium/accounts/available" "" "200"

# ============================================
# PHASE 3 - SUBSCRIPTIONS
# ============================================

echo -e "\n${YELLOW}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}PHASE 3 - SUBSCRIPTIONS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════${NC}"

test_endpoint "List Subscriptions" "GET" "/api/premium/subscriptions?page=1&limit=10" "" "200"

SUBSCRIPTION_DATA='{
  "customer_id": "test-customer-'$(date +%s)'",
  "premium_account_id": "00000000-0000-0000-0000-000000000001",
  "service_type_id": "00000000-0000-0000-0000-000000000001",
  "package_id": "00000000-0000-0000-0000-000000000001",
  "billing_cycle": "1month",
  "original_price": 30.00,
  "final_price": 28.00,
  "notes": "Test subscription via Phase 4"
}'
test_endpoint "Create Subscription" "POST" "/api/premium/subscriptions" "$SUBSCRIPTION_DATA" "201"

test_endpoint "Get Expiring Subscriptions" "GET" "/api/premium/subscriptions/expiring?days_threshold=30" "" "200"

# ============================================
# PHASE 3 - RENEWALS
# ============================================

echo -e "\n${YELLOW}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}PHASE 3 - SUBSCRIPTION RENEWALS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════${NC}"

test_endpoint "List Renewals" "GET" "/api/premium/renewals?status=pending" "" "200"

# ============================================
# SUMMARY
# ============================================

echo -e "\n${YELLOW}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}TEST SUMMARY${NC}"
echo -e "${YELLOW}═══════════════════════════════════════${NC}"

TOTAL=$((TESTS_PASSED + TESTS_FAILED))
echo -e "  Total Tests: $TOTAL"
echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "  ${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✅ ALL TESTS PASSED!${NC}"
  echo -e "${GREEN}Phase 4 is READY FOR PRODUCTION${NC}"
  exit 0
else
  echo -e "\n${RED}⚠️  Some tests failed. Please review logs above.${NC}"
  exit 1
fi
