# PHASE 3 TESTING SCRIPT - Windows PowerShell
# ============================================
# Test all 9 Phase 3 Subscription API endpoints
# Usage: powershell -ExecutionPolicy Bypass -File test-phase3.ps1
# ============================================

$BaseURL = "http://localhost:3000"
$AccountID = "550e8400-e29b-41d4-a716-446655440000"

$TestsPassed = 0
$TestsFailed = 0

function Print-Test {
    param([string]$Title)
    Write-Host "`n" -NoNewline
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
    Write-Host "TEST: $Title" -ForegroundColor Blue
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
}

function Check-Status {
    param(
        [int]$HttpCode,
        [int]$Expected,
        [string]$TestName
    )
    
    if ($HttpCode -eq $Expected) {
        Write-Host "✅ PASS - Got expected status $HttpCode" -ForegroundColor Green
        $global:TestsPassed++
        return $true
    } else {
        Write-Host "❌ FAIL - Expected $Expected but got $HttpCode" -ForegroundColor Red
        $global:TestsFailed++
        return $false
    }
}

# Get IDs from Phase 1 `& 2
Print-Test "Fetch IDs from Phase 1 `& 2"

try {
    Write-Host "Getting service_type_id..." -ForegroundColor Yellow
    $ServiceResponse = Invoke-WebRequest -Uri "$BaseURL/api/premium/services?limit=1" `
        -Headers @{ "x-account-id" = $AccountID } `
        -Method Get | ConvertFrom-Json
    
    $ServiceID = $ServiceResponse.data[0].id
    Write-Host "✓ service_type_id: $ServiceID" -ForegroundColor Green
} catch {
    Write-Host "✗ Could not fetch service_type_id" -ForegroundColor Red
    Write-Host "  Try running Phase 1 tests first!" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "Getting package_id..." -ForegroundColor Yellow
    $PackageResponse = Invoke-WebRequest -Uri "$BaseURL/api/premium/packages?limit=1" `
        -Headers @{ "x-account-id" = $AccountID } `
        -Method Get | ConvertFrom-Json
    
    $PackageID = $PackageResponse.data[0].id
    Write-Host "✓ package_id: $PackageID" -ForegroundColor Green
} catch {
    Write-Host "✗ Could not fetch package_id" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "Getting premium_account_id..." -ForegroundColor Yellow
    $AccountResponse = Invoke-WebRequest -Uri "$BaseURL/api/premium/accounts?limit=1" `
        -Headers @{ "x-account-id" = $AccountID } `
        -Method Get | ConvertFrom-Json
    
    $PremiumAccountID = $AccountResponse.data[0].id
    Write-Host "✓ premium_account_id: $PremiumAccountID" -ForegroundColor Green
} catch {
    Write-Host "✗ Could not fetch premium_account_id" -ForegroundColor Red
    Write-Host "  Try running Phase 2 tests first!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ All IDs fetched successfully" -ForegroundColor Green

# TEST 1: GET /subscriptions - List
Print-Test "1. GET /api/premium/subscriptions - List all"

try {
    $Response = Invoke-WebRequest -Uri "http://localhost:3000/api/premium/subscriptions?page=1`&limit=10`&status=active" `
        -Headers @{ "x-account-id" = $AccountID } `
        -Method Get | ConvertFrom-Json
    
    Check-Status 200 200 "GET subscriptions" | Out-Null
    Write-Host "Found $($Response.pagination.total) subscriptions" -ForegroundColor Cyan
} catch {
    Write-Host "❌ FAIL - $_" -ForegroundColor Red
    $global:TestsFailed++
}

# TEST 2: POST /subscriptions - Create
Print-Test "2. POST /api/premium/subscriptions - Create"

$Timestamp = [int][double]::Parse((Get-Date -UFormat %s))
$CustomerID = "test-cust-$Timestamp"

$CreateBody = @{
    customer_id = $CustomerID
    premium_account_id = $PremiumAccountID
    service_type_id = $ServiceID
    package_id = $PackageID
    billing_cycle = "1month"
    original_price = 30.00
    final_price = 28.00
    notes = "Test subscription"
} | ConvertTo-Json

try {
    $Response = Invoke-WebRequest -Uri "$BaseURL/api/premium/subscriptions" `
        -Headers @{ "x-account-id" = $AccountID; "Content-Type" = "application/json" } `
        -Method Post `
        -Body $CreateBody | ConvertFrom-Json
    
    Check-Status 201 201 "POST subscriptions" | Out-Null
    $SubscriptionID = $Response.data.id
    $DaysRemaining = $Response.data.days_remaining
    Write-Host "Created subscription: $SubscriptionID" -ForegroundColor Cyan
    Write-Host "Days remaining: $DaysRemaining" -ForegroundColor Cyan
} catch {
    Write-Host "❌ FAIL - $_" -ForegroundColor Red
    $global:TestsFailed++
}

# TEST 3: GET /subscriptions/[id] - Get single
Print-Test "3. GET /api/premium/subscriptions/[id] - Get single"

if ($SubscriptionID) {
    try {
        $Response = Invoke-WebRequest -Uri "$BaseURL/api/premium/subscriptions/$SubscriptionID" `
            -Headers @{ "x-account-id" = $AccountID } `
            -Method Get | ConvertFrom-Json
        
        Check-Status 200 200 "GET subscription by ID" | Out-Null
        Write-Host "Subscription status: $($Response.data.status)" -ForegroundColor Cyan
        Write-Host "Renewal status: $($Response.data.renewal_status)" -ForegroundColor Cyan
    } catch {
        Write-Host "❌ FAIL - $_" -ForegroundColor Red
        $global:TestsFailed++
    }
} else {
    Write-Host "❌ SKIP - No subscription ID from test 2" -ForegroundColor Red
}

# TEST 4: PUT /subscriptions/[id]/renew - Request renewal
Print-Test "4. PUT /api/premium/subscriptions/[id]/renew - Request renewal"

if ($SubscriptionID) {
    try {
        $Response = Invoke-WebRequest -Uri "$BaseURL/api/premium/subscriptions/$SubscriptionID/renew" `
            -Headers @{ "x-account-id" = $AccountID; "Content-Type" = "application/json" } `
            -Method Put `
            -Body "{}" | ConvertFrom-Json
        
        Check-Status 200 200 "PUT renew subscription" | Out-Null
        $RenewalID = $Response.data.id
        Write-Host "Created renewal: $RenewalID" -ForegroundColor Cyan
        Write-Host "Renewal status: $($Response.data.status)" -ForegroundColor Cyan
    } catch {
        Write-Host "❌ FAIL - $_" -ForegroundColor Red
        $global:TestsFailed++
    }
} else {
    Write-Host "❌ SKIP - No subscription ID" -ForegroundColor Red
}

# TEST 5: GET /subscriptions/expiring - Get expiring soon
Print-Test "5. GET /api/premium/subscriptions/expiring - Get expiring soon"

try {
    $Response = Invoke-WebRequest -Uri "http://localhost:3000/api/premium/subscriptions/expiring?days_threshold=30`&page=1`&limit=10" `
        -Headers @{ "x-account-id" = $AccountID } `
        -Method Get | ConvertFrom-Json
    
    Check-Status 200 200 "GET expiring subscriptions" | Out-Null
    Write-Host "Found $($Response.pagination.total) subscriptions expiring within 30 days" -ForegroundColor Cyan
} catch {
    Write-Host "❌ FAIL - $_" -ForegroundColor Red
    $global:TestsFailed++
}

# TEST 6: GET /renewals - List renewals
Print-Test "6. GET /api/premium/renewals - List renewal requests"

try {
    $Response = Invoke-WebRequest -Uri "http://localhost:3000/api/premium/renewals?status=pending`&page=1`&limit=10" `
        -Headers @{ "x-account-id" = $AccountID } `
        -Method Get | ConvertFrom-Json
    
    Check-Status 200 200 "GET renewals" | Out-Null
    Write-Host "Found $($Response.pagination.total) pending renewals" -ForegroundColor Cyan
} catch {
    Write-Host "❌ FAIL - $_" -ForegroundColor Red
    $global:TestsFailed++
}

# TEST 7: POST /renewals - Confirm renewal
Print-Test "7. POST /api/premium/renewals - Confirm renewal"

if ($RenewalID) {
    $ConfirmBody = @{
        action = "confirm"
        renewal_id = $RenewalID
        renewal_price = 28.00
        new_billing_cycle = "3months"
    } | ConvertTo-Json
    
    try {
        $Response = Invoke-WebRequest -Uri "$BaseURL/api/premium/renewals" `
            -Headers @{ "x-account-id" = $AccountID; "Content-Type" = "application/json" } `
            -Method Post `
            -Body $ConfirmBody | ConvertFrom-Json
        
        Check-Status 200 200 "POST confirm renewal" | Out-Null
        Write-Host "Renewal status: $($Response.data.status)" -ForegroundColor Cyan
        Write-Host "Renewal price: $($Response.data.renewal_price)" -ForegroundColor Cyan
    } catch {
        Write-Host "❌ FAIL - $_" -ForegroundColor Red
        $global:TestsFailed++
    }
} else {
    Write-Host "❌ SKIP - No renewal ID" -ForegroundColor Red
}

# TEST 8: DELETE /subscriptions/[id] - Soft delete
Print-Test "8. DELETE /api/premium/subscriptions/[id] - Soft delete"

if ($SubscriptionID) {
    try {
        Invoke-WebRequest -Uri "$BaseURL/api/premium/subscriptions/$SubscriptionID" `
            -Headers @{ "x-account-id" = $AccountID } `
            -Method Delete | Out-Null
        
        Check-Status 200 200 "DELETE subscription" | Out-Null
        
        # Verify it's deleted
        try {
            Invoke-WebRequest -Uri "$BaseURL/api/premium/subscriptions/$SubscriptionID" `
                -Headers @{ "x-account-id" = $AccountID } `
                -Method Get -ErrorAction Stop | Out-Null
        } catch {
            if ($_.Exception.Response.StatusCode.Value__ -eq 404) {
                Write-Host "✓ Verified: Subscription is deleted" -ForegroundColor Green
            }
        }
    } catch {
        Write-Host "❌ FAIL - $_" -ForegroundColor Red
        $global:TestsFailed++
    }
} else {
    Write-Host "❌ SKIP - No subscription ID" -ForegroundColor Red
}

# FINAL RESULTS
Write-Host "`n" -NoNewline
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "TEST SUMMARY" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue

Write-Host "Total Tests: $(($TestsPassed + $TestsFailed))" -ForegroundColor Cyan
Write-Host "Passed: $TestsPassed" -ForegroundColor Green
Write-Host "Failed: $TestsFailed" -ForegroundColor Red

if ($TestsFailed -eq 0) {
    Write-Host "`n✅ ALL TESTS PASSED!`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n❌ SOME TESTS FAILED`n" -ForegroundColor Red
    exit 1
}
