# 🧪 API TESTING GUIDE - Premium System

**Date:** March 5, 2026  
**Purpose:** Quick reference for testing APIs  
**Tool:** Postman, Thunder Client, or cURL  

---

## 🚀 QUICK START

### **1. Setup Headers (Required for ALL requests)**

```
Content-Type: application/json
x-account-id: <your-account-uuid>
```

**Note:** Replace `<your-account-uuid>` với UUID từ accounts table của bạn.

---

## 📋 SERVICE TYPES API

### **1. Create Service Type**

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
  "website": "https://chat.openai.com",
  "logo_url": "https://cdn.openai.com/logo.png",
  "supports_connection_check": false,
  "is_active": true
}

Expected: 201 Created
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "account_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "ChatGPT Plus",
    "slug": "chatgpt-plus",
    ...
  },
  "message": "Service created successfully"
}
```

### **2. List All Services**

```http
GET http://localhost:3000/api/premium/services?page=1&limit=20

Headers:
x-account-id: 550e8400-e29b-41d4-a716-446655440000

Expected: 200 OK
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

### **3. Search Services**

```http
GET http://localhost:3000/api/premium/services?search=chat

Headers:
x-account-id: 550e8400-e29b-41d4-a716-446655440000
```

### **4. Filter by Category**

```http
GET http://localhost:3000/api/premium/services?category=AI&is_active=true

Headers:
x-account-id: 550e8400-e29b-41d4-a716-446655440000
```

### **5. Get Specific Service**

```http
GET http://localhost:3000/api/premium/services/<service-id>

Headers:
x-account-id: 550e8400-e29b-41d4-a716-446655440000
```

### **6. Update Service**

```http
PUT http://localhost:3000/api/premium/services/<service-id>

Headers:
Content-Type: application/json
x-account-id: 550e8400-e29b-41d4-a716-446655440000

Body:
{
  "name": "ChatGPT Plus Updated",
  "description": "New description"
}

Expected: 200 OK
```

### **7. Delete Service (Soft)**

```http
DELETE http://localhost:3000/api/premium/services/<service-id>

Headers:
x-account-id: 550e8400-e29b-41d4-a716-446655440000

Expected: 200 OK
{
  "success": true,
  "data": null,
  "message": "Service deleted successfully"
}
```

---

## 📦 PACKAGES API

### **1. Create Package**

```http
POST http://localhost:3000/api/premium/packages

Headers:
Content-Type: application/json
x-account-id: 550e8400-e29b-41d4-a716-446655440000

Body:
{
  "service_type_id": "<service-uuid-from-previous-step>",
  "name": "ChatGPT Family Plan",
  "slug": "chatgpt-family",
  "description": "Share with up to 5 users",
  "total_slots": 5,
  "default_price": 30.00,
  "billing_cycles": ["1month", "3months", "6months", "1year"],
  "allow_flexible_renewal_pricing": true,
  "renewal_price_factor": 0.95,
  "features": {
    "includes": [
      "GPT-4 access",
      "Priority responses",
      "Early access to features"
    ]
  },
  "is_active": true,
  "sort_order": 1
}

Expected: 201 Created
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "name": "ChatGPT Family Plan",
    "total_slots": 5,
    "default_price": 30.00,
    ...
  },
  "message": "Package created successfully"
}
```

### **2. List All Packages**

```http
GET http://localhost:3000/api/premium/packages?page=1&limit=20

Headers:
x-account-id: 550e8400-e29b-41d4-a716-446655440000

Expected: 200 OK
```

### **3. Filter by Service Type**

```http
GET http://localhost:3000/api/premium/packages?service_type_id=<service-uuid>

Headers:
x-account-id: 550e8400-e29b-41d4-a716-446655440000
```

### **4. Get Specific Package**

```http
GET http://localhost:3000/api/premium/packages/<package-id>

Headers:
x-account-id: 550e8400-e29b-41d4-a716-446655440000

Expected: 200 OK
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "ChatGPT Family Plan",
    "premium_service_types": {
      "name": "ChatGPT Plus",
      "slug": "chatgpt-plus"
    },
    ...
  }
}
```

### **5. Update Package**

```http
PUT http://localhost:3000/api/premium/packages/<package-id>

Headers:
Content-Type: application/json
x-account-id: 550e8400-e29b-41d4-a716-446655440000

Body:
{
  "default_price": 25.00,
  "renewal_price_factor": 0.90
}
```

### **6. Delete Package**

```http
DELETE http://localhost:3000/api/premium/packages/<package-id>

Headers:
x-account-id: 550e8400-e29b-41d4-a716-446655440000
```

---

## 🧪 TESTING WORKFLOWS

### **Workflow 1: Setup Complete Service**

```bash
Step 1: Create Service Type (ChatGPT)
POST /api/premium/services
→ Save returned ID

Step 2: Create Multiple Packages
POST /api/premium/packages (Family plan)
POST /api/premium/packages (Individual plan)
POST /api/premium/packages (Team plan)

Step 3: Verify Setup
GET /api/premium/services
GET /api/premium/packages
```

### **Workflow 2: Test Pagination**

```bash
# Create 25 services
POST /api/premium/services (repeat 25 times)

# Test pagination
GET /api/premium/services?page=1&limit=10  → Should return 10
GET /api/premium/services?page=2&limit=10  → Should return 10
GET /api/premium/services?page=3&limit=10  → Should return 5

# Verify totalPages
Should be 3
```

### **Workflow 3: Test Search & Filter**

```bash
# Create diverse services
POST /api/premium/services (ChatGPT - AI - active)
POST /api/premium/services (Duolingo - Learning - active)
POST /api/premium/services (Netflix - Streaming - inactive)

# Test search
GET /api/premium/services?search=chat        → 1 result
GET /api/premium/services?search=learning    → 1 result

# Test filters
GET /api/premium/services?category=AI        → 1 result
GET /api/premium/services?is_active=true     → 2 results
GET /api/premium/services?category=AI&is_active=true → 1 result
```

### **Workflow 4: Test Validation**

```bash
# Missing required field
POST /api/premium/services
Body: { "name": "Test" }  // missing slug
Expected: 400 Bad Request

# Invalid slug format
POST /api/premium/services
Body: { "name": "Test", "slug": "Test With Spaces" }
Expected: 400 Bad Request

# Duplicate slug
POST /api/premium/services (slug: "chatgpt")
POST /api/premium/services (slug: "chatgpt")  // duplicate
Expected: 409 Conflict
```

### **Workflow 5: Test Multi-Tenant Isolation**

```bash
# Create with Account A
x-account-id: account-a-uuid
POST /api/premium/services
→ Service created

# Try to access from Account B
x-account-id: account-b-uuid
GET /api/premium/services/<service-id-from-account-a>
Expected: 404 Not Found (isolated!)
```

---

## 📊 EXPECTED RESPONSES

### **Success Responses:**

#### 200 OK
```json
{
  "success": true,
  "data": { ... }
}
```

#### 201 Created
```json
{
  "success": true,
  "data": { ... },
  "message": "Resource created successfully"
}
```

#### Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

### **Error Responses:**

#### 400 Bad Request
```json
{
  "success": false,
  "error": "Missing required fields"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "error": "Account ID is required (multi-tenant isolation)"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": "Service not found"
}
```

#### 409 Conflict
```json
{
  "success": false,
  "error": "Service with this slug already exists for your account"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## 🔍 DEBUGGING

### **Check Supabase Logs:**

```sql
-- View recent service types
SELECT * FROM premium_service_types 
WHERE deleted_at IS NULL 
ORDER BY created_at DESC 
LIMIT 10;

-- View with account info
SELECT 
  s.*,
  a.name as account_name
FROM premium_service_types s
JOIN accounts a ON s.account_id = a.id
WHERE s.deleted_at IS NULL;

-- Check soft deleted items
SELECT * FROM premium_service_types 
WHERE deleted_at IS NOT NULL;
```

### **Common Issues:**

**Issue:** "Account ID is required"  
```bash
# Solution: Add header
x-account-id: your-uuid-here
```

**Issue:** "Cannot find path"  
```bash
# Solution: Check URL typo
✅ /api/premium/services
❌ /api/premium/service (missing 's')
```

**Issue:** "Validation failed"  
```bash
# Solution: Check required fields
Required for Service: name, slug
Required for Package: service_type_id, name, slug, default_price, billing_cycles
```

---

## 🎯 TESTING CHECKLIST

### **Service Types API:**
```
☐ Create service (valid data)
☐ Create service (missing required field) → 400
☐ Create service (invalid slug) → 400
☐ Create service (duplicate slug) → 409
☐ List services (no pagination)
☐ List services (with pagination)
☐ List services (with search)
☐ List services (with filters)
☐ Get specific service
☐ Update service
☐ Delete service (soft delete)
☐ Try to access deleted service → 404
☐ Try to access from different account → 404
```

### **Packages API:**
```
☐ Create package (valid data)
☐ Create package (missing required field) → 400
☐ Create package (invalid service_type_id) → 400
☐ Create package (invalid billing_cycles) → 400
☐ Create package (renewal_price_factor < 0.9) → 400
☐ Create package (renewal_price_factor > 1.1) → 400
☐ List packages
☐ List packages (filter by service_type_id)
☐ Get specific package
☐ Update package
☐ Delete package
```

---

## 📝 cURL Examples

### **Create Service (cURL):**
```bash
curl -X POST http://localhost:3000/api/premium/services \
  -H "Content-Type: application/json" \
  -H "x-account-id: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "name": "ChatGPT Plus",
    "slug": "chatgpt-plus",
    "category": "AI"
  }'
```

### **List Services (cURL):**
```bash
curl -X GET "http://localhost:3000/api/premium/services?page=1&limit=20" \
  -H "x-account-id: 550e8400-e29b-41d4-a716-446655440000"
```

### **Update Service (cURL):**
```bash
curl -X PUT http://localhost:3000/api/premium/services/<id> \
  -H "Content-Type: application/json" \
  -H "x-account-id: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{"name": "ChatGPT Plus Updated"}'
```

---

**Created:** March 5, 2026  
**Status:** Ready for Testing  
**APIs:** 10 endpoints (Services + Packages)  

**Start testing!** 🚀
