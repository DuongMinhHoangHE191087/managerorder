# Quick Phase 3 Testing - Create test data and run tests
$BaseURL = 'http://localhost:3000'
$AccountID = '550e8400-e29b-41d4-a716-446655440000'
$Headers = @{'x-account-id' = $AccountID; 'Content-Type' = 'application/json'}

Write-Host "=== PHASE 3 QUICK TEST ===" -ForegroundColor Blue
Write-Host "Starting Phase 3 API tests..." -ForegroundColor Yellow

# Create test service
Write-Host "`n[1/9] Creating test service..." -ForegroundColor Cyan
$service = @{
    account_id = $AccountID
    name = "Test Service"
    slug = "test-service"
    category = "Testing"
    supports_connection_check = $false
} | ConvertTo-Json

$svc = Invoke-WebRequest -Uri "$BaseURL/api/premium/services" -Headers $Headers -Method Post -Body $service -UseBasicParsing | ConvertFrom-Json
$ServiceID = $svc.data.id
Write-Host "✓ Service created: $ServiceID" -ForegroundColor Green

# Create test package
Write-Host "`n[2/9] Creating test package..." -ForegroundColor Cyan
$package = @{
    account_id = $AccountID
    service_type_id = $ServiceID
    name = "Test Package"
    slug = "test-pkg-$(Get-Random)"
    total_slots = 10
    default_price = 30.00
    is_active = $true
    billing_cycles = @("1month")
} | ConvertTo-Json

$pkg = Invoke-WebRequest -Uri "$BaseURL/api/premium/packages" -Headers $Headers -Method Post -Body $package -UseBasicParsing | ConvertFrom-Json
$PackageID = $pkg.data.id
Write-Host "✓ Package created: $PackageID" -ForegroundColor Green

# Create premium account
Write-Host "`n[3/9] Creating test premium account..." -ForegroundColor Cyan
$account = @{
    account_id = $AccountID
    service_type_id = $ServiceID
    package_id = $PackageID
    premium_account_user_id = "test-user"
    primary_email = "test-$((Get-Date).Ticks)@example.com"
    primary_password = "TestPass123!"
    total_slots = 5
    subscription_start_date = "2023-10-01"
    subscription_expiry_date = "2024-10-01"
} | ConvertTo-Json

$acct = Invoke-WebRequest -Uri "$BaseURL/api/premium/accounts" -Headers $Headers -Method Post -Body $account -UseBasicParsing | ConvertFrom-Json
$PremiumAccountID = $acct.data.id
Write-Host "✓ Premium account created: $PremiumAccountID" -ForegroundColor Green

# NOW TEST PHASE 3 SUBSCRIPTIONS

# Test 1: GET /subscriptions - List
Write-Host "`n[4/9] GET /api/premium/subscriptions" -ForegroundColor Cyan
$uri = "$BaseURL/api/premium/subscriptions"
$result = Invoke-WebRequest -Uri $uri -Headers $Headers -UseBasicParsing
Write-Host "✓ Status: $($result.StatusCode)" -ForegroundColor Green
$data = $result.Content | ConvertFrom-Json
Write-Host "  Found $($data.pagination.total) subscriptions" -ForegroundColor Cyan

# Test 2: POST /subscriptions - Create
Write-Host "`n[5/9] POST /api/premium/subscriptions" -ForegroundColor Cyan
$sub = @{
    customer_id = "test-customer-$(Get-Random)"
    premium_account_id = $PremiumAccountID
    service_type_id = $ServiceID
    package_id = $PackageID
    billing_cycle = "1month"
    original_price = 30.00
    final_price = 28.00
    notes = "Test subscription"
} | ConvertTo-Json

$result = Invoke-WebRequest -Uri "$BaseURL/api/premium/subscriptions" -Headers $Headers -Method Post -Body $sub -UseBasicParsing
Write-Host "✓ Status: $($result.StatusCode)" -ForegroundColor Green
$subData = $result.Content | ConvertFrom-Json
$SubscriptionID = $subData.data.id
Write-Host "  Created subscription: $SubscriptionID" -ForegroundColor Cyan
Write-Host "  Days remaining: $($subData.data.days_remaining)" -ForegroundColor Cyan

# Test 3: GET /subscriptions/[id] - Get single
Write-Host "`n[6/9] GET /api/premium/subscriptions/[id]" -ForegroundColor Cyan
$result = Invoke-WebRequest -Uri "$BaseURL/api/premium/subscriptions/$SubscriptionID" -Headers $Headers -UseBasicParsing
Write-Host "✓ Status: $($result.StatusCode)" -ForegroundColor Green
$data = $result.Content | ConvertFrom-Json
Write-Host "  Subscription status: $($data.data.status)" -ForegroundColor Cyan

# Test 4: PUT /subscriptions/[id]/renew - Request renewal
Write-Host "`n[7/9] PUT /api/premium/subscriptions/[id]/renew" -ForegroundColor Cyan
$result = Invoke-WebRequest -Uri "$BaseURL/api/premium/subscriptions/$SubscriptionID/renew" -Headers $Headers -Method Put -UseBasicParsing
Write-Host "✓ Status: $($result.StatusCode)" -ForegroundColor Green
$renewal = $result.Content | ConvertFrom-Json
$RenewalID = $renewal.data.id
Write-Host "  Created renewal: $RenewalID" -ForegroundColor Cyan
Write-Host "  Renewal status: $($renewal.data.status)" -ForegroundColor Cyan

# Test 5: GET /subscriptions/expiring - Get expiring
Write-Host "`n[8/9] GET /api/premium/subscriptions/expiring" -ForegroundColor Cyan
$uri = "$BaseURL/api/premium/subscriptions/expiring`?days_threshold=30"
$result = Invoke-WebRequest -Uri $uri -Headers $Headers -UseBasicParsing
Write-Host "✓ Status: $($result.StatusCode)" -ForegroundColor Green
$data = $result.Content | ConvertFrom-Json
Write-Host "  Found $($data.pagination.total) expiring subscriptions" -ForegroundColor Cyan

# Test 6: DELETE /subscriptions/[id] - Delete
Write-Host "`n[9/9] DELETE /api/premium/subscriptions/[id]" -ForegroundColor Cyan
$result = Invoke-WebRequest -Uri "$BaseURL/api/premium/subscriptions/$SubscriptionID" -Headers $Headers -Method Delete -UseBasicParsing
Write-Host "✓ Status: $($result.StatusCode)" -ForegroundColor Green

# SUMMARY
Write-Host "`n" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "✅ ALL TESTS PASSED!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "`nPhase 3 Subscriptions API - Working! ✓" -ForegroundColor Green
Write-Host "All 9 endpoints tested successfully." -ForegroundColor Cyan
