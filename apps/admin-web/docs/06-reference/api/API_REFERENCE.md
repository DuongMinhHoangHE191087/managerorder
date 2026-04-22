# 📡 API Reference — Premium Accounts Management System

**Base URL:** `http://localhost:3000/api`  
**Auth:** Google OAuth via Supabase → Cookie-based session  
**Content-Type:** `application/json` (trừ `/api/upload` dùng `multipart/form-data`)  
**Last Updated:** 2026-04-21

---

## Mục Lục

1. [Authentication & Authorization](#1-authentication--authorization)
2. [Orders](#2-orders)
3. [Customers](#3-customers)
4. [Products](#4-products)
5. [Inventory (License Keys)](#5-inventory-license-keys)
6. [Inventory Allocation](#6-inventory-allocation)
7. [Source Accounts (Warehouse)](#7-source-accounts-warehouse)
8. [Providers](#8-providers)
9. [Calendar & Events](#9-calendar--events)
10. [Settings](#10-settings)
11. [Activity Logs](#11-activity-logs)
12. [Proxy APIs](#12-proxy-apis)
13. [Upload](#13-upload)
14. [Cron Jobs](#14-cron-jobs)
15. [Premium (Legacy)](#15-premium-legacy)

---

## Conventions Chung

### Response Format

```jsonc
// Thành công (single item)
{ "data": { ... } }

// Thành công (list with pagination)
{ "data": [...], "meta": { "count": 100, "page": 1, "limit": 10, "totalPages": 10 } }

// Thành công (action)
{ "success": true }

// Lỗi
{ "error": "Mô tả lỗi", "details": { ... } }
```

### HTTP Status Codes

| Code | Ý nghĩa |
|------|---------|
| `200` | Thành công |
| `201` | Tạo mới thành công |
| `400` | Request không hợp lệ (validation error) |
| `401` | Chưa đăng nhập (Unauthorized) |
| `403` | Không có quyền (Forbidden) |
| `404` | Không tìm thấy |
| `409` | Conflict (trạng thái không hợp lệ) |
| `422` | Dữ liệu không xử lý được |
| `500` | Lỗi server |
| `502` | Lỗi từ external API (proxy) |

### Authentication Flow

Mọi protected route đều yêu cầu:
1. **Supabase Session Cookie** — tự động gắn bởi browser sau khi login
2. **Admin Verification** — middleware kiểm tra `admin_users` table
3. **Account Context** — `withAccount` middleware inject `accountId` từ session

---

## 1. Authentication & Authorization

### `GET /api/auth/google/login`
Redirect tới Google OAuth consent screen.

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| `next` | `string?` | URL redirect sau login (default: `/dashboard`) |

**Response:** `302 Redirect` → Google OAuth

---

### `GET /api/auth/google/callback`
Xử lý callback từ Google OAuth, tạo/cập nhật session.

**Response:** `302 Redirect` → `next` URL hoặc `/dashboard`

---

### `GET /api/auth/callback`
Supabase Auth callback handler (exchange code → session).

---

## 2. Orders

### `GET /api/orders`
Lấy danh sách đơn hàng có phân trang.

**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | `number` | `1` | Trang hiện tại |
| `limit` | `number` | `10` | Số item/trang |
| `search` | `string?` | — | Tìm kiếm |
| `status` | `string?` | — | Filter theo status |
| `customer_id` | `string?` | — | Filter theo khách hàng |

**Response:**
```json
{
  "data": [{ "id": "...", "status": "paid", "total_amount_vnd": 100000, ... }],
  "meta": { "count": 42, "page": 1, "limit": 10, "totalPages": 5 }
}
```

---

### `POST /api/orders`
Tạo đơn hàng mới.

**Request Body:** (Zod: `createOrderInputSchema`)
```jsonc
{
  "customerId": "uuid",           // required
  "items": [{                      // required, min 1
    "productId": "uuid",
    "quantity": 1,
    "notes": "optional",
    "assignedSourceAccountId": "uuid?",
    "customerNickUsed": "string?"
  }],
  "paymentMethod": "paid | debt | cod",   // optional
  "paymentSourceId": "uuid?",
  "salesChannelId": "uuid?",
  "proofImageUrls": ["url"],              // max 5
  "salesNote": "string?",                 // max 500 chars
  "contactSnapshot": "string?",           // max 200 chars
  "registeredAt": "ISO date?",            // backdated registration
  "orderNotes": "string?",               // max 1000 chars
  "billingDetails": {                     // optional invoice info
    "companyName": "string?",
    "taxId": "string?",
    "companyAddress": "string?",
    "email": "string?"
  }
}
```

**Response:** `201` + `{ "data": { order + items } }`

---

### `GET /api/orders/:id`
Lấy chi tiết đơn hàng (header + line items).

**Response:** `{ "data": { ...order, items: [...] } }`

---

### `PUT /api/orders/:id`
Cập nhật đơn hàng (status, payment, notes).

**Request Body:**
```jsonc
{
  "status": "draft | pending_payment | paid | provisioning | active | expired | refunded",
  "total_paid": 50000,
  "payment_method": "paid | debt | cod",
  "payment_source_id": "uuid",
  "sales_note": "string",
  "expires_at": "ISO date"
}
```

> **Auto-deallocation:** Khi chuyển từ `provisioning/active` → `pending_payment/paid/refunded`, hệ thống tự động giải phóng slot/key.

**Response:** `{ "data": { ...updated order } }`

---

### `DELETE /api/orders/:id`
Xóa đơn hàng. Tự động deallocate trước khi xóa.

**Response:** `{ "success": true }`

---

### `GET /api/orders/:id/invoice`
Lấy payload hóa đơn đầy đủ (denormalized).

**Response:**
```jsonc
{
  "data": {
    "invoice_number": "INV-20260306-AB12CD",
    "issued_at": "ISO string",
    "order": { "id", "status", "created_at", "expires_at", "sales_note", ... },
    "customer": { "id", "full_name", "type", "contacts": [...] },
    "line_items": [{ "product_name_snapshot", "quantity", "unit_price_vnd", "subtotal_vnd", ... }],
    "payment_summary": {
      "subtotal_vnd", "discount_vnd", "total_vnd", "total_paid_vnd",
      "remaining_vnd", "fully_paid", "payment_method", "payment_source_name"
    },
    "sales_channel_name": "string | null"
  }
}
```

---

### `POST /api/orders/:id/payment`
Ghi nhận thanh toán cho đơn hàng.

**Request Body:**
```json
{ "amount": 50000, "payment_source": "uuid?", "note": "string?" }
```

**Business Logic:**
- `amount` phải > 0 và ≤ remaining
- Reconciliation dựa trên `total_amount_vnd` (frozen tại thời điểm tạo order)
- Auto-chuyển `pending_payment` → `paid` khi thanh toán đầy đủ

**Error Cases:**
- `409` — Đơn đã refunded / đã thanh toán đầy đủ
- `422` — Số tiền vượt quá remaining

---

### `POST /api/orders/import`
Import bulk đơn hàng từ Excel (parsed JSON).

**Request Body:** Array of `importOrderSchema`
```jsonc
[{
  "customerName": "string",
  "productName": "string",
  "quantity": 1,
  "totalAmount": 100000,
  "paymentStatus": "paid | unpaid | refunded",
  "duolingoUsername": "string?",
  "sourceUsername": "string?",
  "inviteLink": "string?",
  "startDate": "ISO?",
  "endDate": "ISO?"
}]
```

**Business Logic:**
- Auto-resolve/create customers (by name, Duolingo username, hoặc Facebook URL)
- Auto-resolve/create products (by plan name)
- Auto-resolve CTV (agency customers)
- Bulk insert vào DB

---

## 3. Customers

### `GET /api/customers`
Lấy tất cả khách hàng.

**Response:** `{ "data": [Customer...] }`

---

### `POST /api/customers`
Tạo khách hàng mới.

**Request Body:** (Zod: `createCustomerInputSchema`)
```json
{
  "name": "Nguyễn Văn A",
  "contacts": [
    { "type": "phone | email | zalo | facebook | telegram | other", "value": "0901234567", "isPrimary": true }
  ],
  "tier": "regular | vip"
}
```

**Response:** `201` + `{ "data": Customer }`

---

### `GET /api/customers/:id`
Lấy chi tiết khách hàng.

### `PUT /api/customers/:id`
Cập nhật khách hàng.

### `DELETE /api/customers/:id`
Xóa khách hàng (soft delete).

---

## 4. Products

### `GET /api/products`
Lấy tất cả sản phẩm/dịch vụ.

**Response:** `{ "data": [ProductService...] }`

---

### `POST /api/products`
Tạo sản phẩm mới.

**Request Body:** (Zod: `createProductInputSchema`)
```json
{
  "name": "Duolingo Super 1 tháng",
  "mode": "slot | key | hybrid",
  "buyPriceVnd": 50000,
  "sellPriceVnd": 75000,
  "durationType": "days | months | years",
  "durationValue": 30,
  "isActive": true
}
```

---

### `PUT /api/products/:id`
Cập nhật sản phẩm. **Guard:** không cho đổi giá khi còn đơn hàng chưa thanh toán.

**Error:** `409` — `"Không thể thay đổi giá khi còn đơn hàng chưa thanh toán"`

### `DELETE /api/products/:id`
Xóa sản phẩm (soft delete).

---

## 5. Inventory (License Keys)

### `GET /api/inventory`
Lấy tất cả license keys.

### `POST /api/inventory`
Tạo license key mới.

**Request Body:** (Zod: `createLicenseKeyInputSchema`)
```json
{
  "keyCode": "XXXX-YYYY-ZZZZ",
  "productId": "uuid",
  "status": "available | sold | revoked"
}
```

### `GET /api/inventory/:id`
### `PUT /api/inventory/:id`
### `DELETE /api/inventory/:id`

---

## 6. Inventory Allocation

### `POST /api/inventory/allocate`
Kiểm tra hoặc xác nhận cấp phát kho cho đơn hàng.

**Request Body:** (Zod: `allocationRequestSchema`)
```json
{ "orderId": "uuid", "confirm": false }
```

| `confirm` | Hành vi |
|-----------|---------|
| `false` | Chỉ kiểm tra — trả về suggestion |
| `true` | Xác nhận cấp phát — gán source account/key cho order items |

**Response (preview):**
```json
{ "data": { "isValid": true, "warnings": [], "items": [...] }, "message": "Inventory co the cap phat" }
```

---

### `DELETE /api/inventory/allocate?orderId=xxx`
Giải phóng cấp phát (deallocate) cho đơn hàng.

**Response:**
```json
{ "data": { "deallocatedSlots": 2, "deallocatedKeys": 0 }, "message": "Đã giải phóng 2 slot và 0 key." }
```

---

## 7. Source Accounts (Warehouse)

### `GET /api/source-accounts`
Lấy tất cả source accounts (kho tài khoản).

### `POST /api/source-accounts`
Tạo source account mới.

**Request Body:**
```json
{
  "email": "account@gmail.com",
  "provider": "duolingo",
  "productIds": ["uuid"],
  "maxSlots": 5,
  "expiresAt": "2026-12-31"
}
```

### `GET /api/source-accounts/:id`
### `PUT /api/source-accounts/:id`
### `DELETE /api/source-accounts/:id`

---

### Source Account Connections

### `GET /api/source-accounts/:id/connections`
Lấy danh sách connections (linked orders).

### `POST /api/source-accounts/:id/connections/connect`
Kết nối order item với source account (gán slot).

### `POST /api/source-accounts/:id/connections/disconnect`
Ngắt kết nối order item.

### `POST /api/source-accounts/:id/connections/reconnect`
Chuyển order item sang source account khác.

### `GET /api/source-accounts/:id/connections/search`
Tìm kiếm source account phù hợp (smart matching).

---

### Reserved Nicks

### `GET /api/source-accounts/:id/reserved-nicks`
### `PUT /api/source-accounts/:id/reserved-nicks`
Quản lý danh sách nick đã đặt trước trên source account.

---

### Smart Match

### `POST /api/source-accounts/smart-match`
Auto-match đơn hàng với source account tối ưu dựa trên product, available slots, và customer nick.

---

## 8. Providers

### `GET /api/providers`
Lấy tất cả nhà cung cấp.

### `POST /api/providers`
Tạo nhà cung cấp mới.

**Request Body:** (Zod: `createProviderInputSchema`)
```json
{
  "name": "Supplier A",
  "contacts": [{ "type": "phone", "value": "0901234567", "isPrimary": true }],
  "tier": "regular | vip"
}
```

### `GET /api/providers/:id`
### `PUT /api/providers/:id`
### `DELETE /api/providers/:id`

---

## 9. Calendar & Events

### `GET /api/calendar`
Lấy tất cả sự kiện lịch.

### `POST /api/calendar`
Tạo sự kiện mới. **Tự động sync Google Calendar** nếu được cấu hình.

**Request Body:** (Zod: `createCalendarEventSchema`)
```json
{
  "title": "Nhắc gia hạn Nguyễn Văn A",
  "date": "2026-03-15",
  "time": "09:00",
  "type": "renewal | follow_up | payment_due | other",
  "customerIds": ["uuid"],
  "notes": "Gọi lại sau 2 ngày",
  "hasReminder": true
}
```

### `PATCH /api/calendar?id=xxx`
Cập nhật sự kiện. Auto-sync GCal.

### `DELETE /api/calendar?id=xxx`
Xóa sự kiện. Auto-delete trên GCal.

---

### Calendar Notes

### `GET /api/calendar/note?date=2026-03-15`
### `PUT /api/calendar/note`
Quản lý ghi chú cho từng ngày.

---

## 10. Settings

### Payment Sources
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/settings/payment-sources` | List all |
| `POST` | `/api/settings/payment-sources` | Create new |
| `PUT` | `/api/settings/payment-sources/:id` | Update |
| `DELETE` | `/api/settings/payment-sources/:id` | Delete |

### Sales Channels
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/settings/sales-channels` | List all |
| `POST` | `/api/settings/sales-channels` | Create new |
| `PUT` | `/api/settings/sales-channels/:id` | Update |
| `DELETE` | `/api/settings/sales-channels/:id` | Delete |

### System Settings
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/settings/system` | Get system settings |
| `POST` | `/api/settings/system` | Create or update (upsert) |

**System Settings Fields:**
```json
{
  "company_name": "", "tax_id": "", "company_address": "",
  "personal_name": "", "bank_name": "", "bank_account": "",
  "default_notes": ""
}
```

---

## 11. Activity Logs

### `GET /api/activity-logs`
Lấy audit trail có phân trang và filter.

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | `number` | Trang |
| `limit` | `number` | Items/trang (default: 20) |
| `search` | `string?` | Tìm kiếm |
| `actionType` | `string?` | Filter: `ORDER_CREATED`, `PAYMENT_ADDED`, `ALLOCATION_CONFIRMED`, etc. |
| `customerId` | `string?` | Filter theo khách hàng |
| `orderId` | `string?` | Filter theo đơn hàng |
| `inventoryAccountId` | `string?` | Filter theo inventory |

**Action Types:**
`ORDER_CREATED` · `ORDER_UPDATED` · `CUSTOMER_CREATED` · `PRODUCT_CREATED` · `PAYMENT_ADDED` · `ALLOCATION_CONFIRMED` · `ALLOCATION_RELEASED` · `INVENTORY_KEY_CREATED` · `INVENTORY_STATUS_CHANGED` · `CALENDAR_EVENT_CREATED` · `CALENDAR_EVENT_UPDATED` · `CALENDAR_EVENT_DELETED`

---

## 12. Proxy APIs

### `GET /api/proxy/duolingo-id?username=xxx`
Proxy Duolingo public API → lấy user ID từ username.

**Response:** `{ "id": 123456, "username": "john_doe" }`

**Errors:** `404` — Username không tồn tại · `502` — Duolingo API error

---

### `GET /api/proxy/facebook-id?link=https://facebook.com/user`
Proxy API → lấy Facebook user ID từ profile URL.

**Response:** `{ "id": "100000123456", "name": "Nguyễn Văn A", "profileUrl": "..." }`

---

## 13. Upload

### `POST /api/upload`
Upload ảnh (proof of payment, etc.).

**Content-Type:** `multipart/form-data`

**Form Fields:**
| Field | Type | Constraints |
|-------|------|------------|
| `file` | `File` | Max 5MB · JPEG/PNG/WEBP/GIF |

**Response (Cloudinary):**
```json
{ "url": "https://res.cloudinary.com/...", "publicId": "managerorder/proof/...", "mode": "cloudinary" }
```

**Response (Fallback - no Cloudinary):**
```json
{ "url": "data:image/jpeg;base64,...", "publicId": "local_1710...", "mode": "local_fallback" }
```

---

## 14. Cron Jobs

### `GET /api/cron/telegram-reminder`
**Vercel Cron** — Gửi nhắc nhở hàng ngày qua Telegram.

**Schedule:** 6AM & 9PM (Asia/Ho_Chi_Minh) via `vercel.json`

**Auth:** `Authorization: Bearer {CRON_SECRET}`

**Behavior:**
1. Lấy tất cả sự kiện hôm nay
2. Format thành HTML message đẹp
3. Gửi qua Telegram Bot API

**Env vars cần thiết:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET`

---

### `GET /api/cron/premium-health-checks`
**Vercel Cron** — Quét kết nối cho tất cả premium accounts hỗ trợ `supports_connection_check`.

**Schedule:** 3:15AM daily via `vercel.json`

**Auth:** `Authorization: Bearer {CRON_SECRET}`

**Behavior:**
1. Lấy danh sách `accounts` đang active
2. Chạy health check trên từng account có premium service hỗ trợ connection check
3. Ghi vào `premium_account_health_logs`
4. Cập nhật `premium_accounts.connection_status` và `last_connection_check_at`
5. Bỏ qua account không có service type phù hợp

**Env vars cần thiết:** `CRON_SECRET`

---

## 15. Premium (Legacy)

> Các endpoints kế thừa từ thiết kế Premium cũ. Vẫn hoạt động nhưng nên dùng Source Accounts API cho logic mới.

| Method | Path | Description |
|--------|------|-------------|
| `GET/POST` | `/api/premium/accounts` | Premium accounts CRUD |
| `GET/PUT/DELETE` | `/api/premium/accounts/:id` | Single account |
| `GET/POST` | `/api/premium/accounts/:id/users` | Account sub-users |
| `PUT/DELETE` | `/api/premium/accounts/:id/users/:userId` | Single sub-user |
| `GET` | `/api/premium/accounts/available` | Available accounts |
| `GET/POST` | `/api/premium/services` | Service types |
| `GET/PUT/DELETE` | `/api/premium/services/:id` | Single service |
| `GET/POST` | `/api/premium/packages` | Packages |
| `GET/PUT/DELETE` | `/api/premium/packages/:id` | Single package |
| `GET/POST` | `/api/premium/subscriptions` | Subscriptions |
| `GET/PUT/DELETE` | `/api/premium/subscriptions/:id` | Single subscription |
| `GET` | `/api/premium/subscriptions/expiring` | Expiring soon |
| `POST` | `/api/premium/subscriptions/:id/renew` | Renew |
| `POST` | `/api/premium/subscriptions/:id/refund` | Refund |
| `GET/POST` | `/api/premium/renewals` | Renewals |
| `POST` | `/api/premium/renewals/:id/confirm` | Confirm renewal |
| `POST` | `/api/premium/renewals/:id/deny` | Deny renewal |
| `GET` | `/api/premium/health-checks` | Health check logs |
| `POST` | `/api/premium/health-checks/run` | Run health check |
| `GET/POST` | `/api/premium/migrations` | Account migrations |
| `GET/PUT` | `/api/premium/migrations/:id` | Single migration |

---

## Middleware & Security

### Authentication Middleware (`middleware.ts`)

```
Request → Supabase Session Check → admin_users Table Check → Route Handler
```

- **Public Routes:** `/login`, `/unauthorized`, `/api/auth/callback`
- **Static Assets:** `/_next`, `/favicon.ico`
- **Protected Routes:** Yêu cầu valid session + email trong `admin_users` table
- **API Routes:** Trả `401/403` JSON thay vì redirect

### API Wrapper Pattern

```typescript
// Tất cả API routes đều sử dụng:
export const GET = withErrorHandler(
  withAccount(async (request, { accountId }) => {
    // Business logic...
  })
);
```

- `withErrorHandler` — Catch exceptions, trả JSON error
- `withAccount` — Extract & validate accountId từ session
- `Zod Schemas` — Input validation ở mọi POST/PUT endpoint

---

*Tài liệu được tạo tự động từ codebase ngày 2026-03-10 bởi Antigravity Documentation Generator.*
