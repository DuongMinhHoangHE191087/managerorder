# API Guide — ManagerOrder

> 101 REST API Endpoints | JWT Auth | Zod Validation

---

## Xác thực (Authentication)

Tất cả API routes (trừ auth) yêu cầu **JWT Bearer Token**:

```
Authorization: Bearer <access_token>
```

### Auth Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/api/auth/login` | Đăng nhập → access + refresh token |
| POST | `/api/auth/register` | Đăng ký tài khoản |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/google-oauth` | Google OAuth login |
| POST | `/api/auth/google-oauth/callback` | Google OAuth callback |

---

## Orders (Đơn hàng)

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/orders` | Danh sách đơn, filter status/search/date |
| POST | `/api/orders` | Tạo đơn mới (atomic với items) |
| GET | `/api/orders/[id]` | Chi tiết đơn hàng |
| PUT | `/api/orders/[id]` | Cập nhật đơn |
| DELETE | `/api/orders/[id]` | Xóa đơn (soft delete) |
| PATCH | `/api/orders/[id]/status` | Chuyển trạng thái FSM |
| GET | `/api/orders/stats` | Thống kê đơn hàng |
| POST | `/api/orders/batch` | Batch operations |
| POST | `/api/orders/export` | Export Excel |
| POST | `/api/orders/import` | Import từ Excel |
| POST | `/api/orders/check-duplicate` | Kiểm tra trùng đơn |
| GET | `/api/orders/[id]/history` | Lịch sử trạng thái |
| POST | `/api/orders/[id]/renewal` | Gia hạn đơn |
| POST | `/api/orders/[id]/refund` | Hoàn tiền |

---

## Customers (Khách hàng)

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/customers` | Danh sách KH, filter/search/sort |
| POST | `/api/customers` | Tạo khách hàng |
| GET | `/api/customers/[id]` | Chi tiết KH |
| PUT | `/api/customers/[id]` | Cập nhật KH |
| DELETE | `/api/customers/[id]` | Xóa KH (soft delete) |
| GET | `/api/customers/stats` | Thống kê KH |
| POST | `/api/customers/batch` | Batch operations |
| GET | `/api/customers/[id]/debt` | Tình trạng nợ |
| GET | `/api/customers/[id]/orders` | Đơn hàng của KH |
| POST | `/api/customers/check-duplicate` | Kiểm tra trùng KH |

### Customer Tags

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/customer-tags` | Danh sách tags |
| POST | `/api/customer-tags` | Tạo tag |
| PUT | `/api/customer-tags/[id]` | Cập nhật tag |
| DELETE | `/api/customer-tags/[id]` | Xóa tag |

### Customer Groups

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/customer-groups` | Danh sách nhóm |
| POST | `/api/customer-groups` | Tạo nhóm |
| PUT | `/api/customer-groups/[id]` | Cập nhật nhóm |
| DELETE | `/api/customer-groups/[id]` | Xóa nhóm |

---

## Inventory (Kho)

### Source Accounts

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/source-accounts` | List tài khoản nguồn |
| POST | `/api/source-accounts` | Tạo tài khoản |
| GET | `/api/source-accounts/[id]` | Chi tiết tài khoản |
| PUT | `/api/source-accounts/[id]` | Cập nhật |
| DELETE | `/api/source-accounts/[id]` | Xóa |

### Inventory Operations

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/inventory` | Dashboard kho |
| POST | `/api/inventory/allocate` | Cấp phát tự động |
| POST | `/api/inventory/deallocate` | Giải phóng slot |
| GET | `/api/inventory/dashboard` | Thống kê kho |
| GET | `/api/inventory/profit` | Báo cáo lợi nhuận |
| GET | `/api/inventory/suggestions` | Smart matching suggestions |

---

## Products (Sản phẩm)

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/products` | Danh sách sản phẩm |
| POST | `/api/products` | Tạo sản phẩm |
| GET | `/api/products/[id]` | Chi tiết |
| PUT | `/api/products/[id]` | Cập nhật |
| DELETE | `/api/products/[id]` | Xóa |

---

## Premium Services

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/premium/services` | Loại dịch vụ premium |
| POST | `/api/premium/services` | Tạo loại dịch vụ |
| GET | `/api/premium/packages` | Gói dịch vụ |
| POST | `/api/premium/packages` | Tạo gói |
| GET | `/api/premium/accounts` | Tài khoản premium |
| POST | `/api/premium/accounts` | Tạo tài khoản |
| PUT | `/api/premium/accounts/[id]` | Cập nhật |
| GET | `/api/premium/accounts/[id]/users` | Users trong tài khoản |
| POST | `/api/premium/accounts/[id]/users` | Thêm user |
| DELETE | `/api/premium/accounts/[id]/users/[userId]` | Xóa user |
| GET | `/api/premium/subscriptions` | Customer subscriptions |

---

## Calendar (Lịch)

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/calendar/events` | Sự kiện theo tháng |
| POST | `/api/calendar/events` | Tạo sự kiện |
| PUT | `/api/calendar/events/[id]` | Cập nhật |
| DELETE | `/api/calendar/events/[id]` | Xóa |
| GET | `/api/calendar/notes` | Ghi chú theo ngày |
| POST | `/api/calendar/notes` | Tạo ghi chú |

---

## Dashboard

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/dashboard/stats` | KPI tổng hợp |
| GET | `/api/dashboard/revenue` | Doanh thu theo kỳ |
| GET | `/api/dashboard/order-stats` | Thống kê đơn theo trạng thái |

---

## Settings

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/settings` | Cấu hình hệ thống |
| PUT | `/api/settings` | Cập nhật cấu hình |
| GET | `/api/settings/webhooks` | Webhook endpoints |
| POST | `/api/settings/webhooks` | Tạo webhook |
| PUT | `/api/settings/webhooks/[id]` | Cập nhật |
| DELETE | `/api/settings/webhooks/[id]` | Xóa |

---

## Other

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/providers` | Nhà cung cấp |
| POST | `/api/providers` | Tạo NCC |
| PUT | `/api/providers/[id]` | Cập nhật |
| DELETE | `/api/providers/[id]` | Xóa |
| GET | `/api/activity-logs` | Audit trail |
| POST | `/api/upload` | Upload file |
| GET | `/api/trash` | Thùng rác |
| POST | `/api/trash/restore` | Khôi phục |
| DELETE | `/api/trash/[id]` | Xóa vĩnh viễn |

---

## Cron Jobs

| Path | Schedule | Mô tả |
|------|----------|--------|
| `/api/cron/telegram-reminder` | 6AM, 9PM | Nhắc sự kiện calendar hôm nay |
| `/api/cron/order-expiry-reminder` | Daily | Nhắc đơn hết hạn T-7/T-3/T-1 |
| `/api/cron/revenue-report` | Daily/Weekly | Báo cáo doanh thu |
| `/api/cron/auto-escalation` | Daily | Tự động leo thang nợ |
| `/api/cron/rfm-calculation` | Weekly | Tính RFM segmentation |
| `/api/cron/webhook-retry` | Every 5min | Retry webhook delivery thất bại |

**Auth:** Tất cả cron sử dụng `?secret=CRON_SECRET` query param.

---

## Response Format

### Success

```json
{
  "data": { ... },
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

### Error

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [...]
}
```

### HTTP Status Codes

| Code | Ý nghĩa |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid JWT) |
| 403 | Forbidden (insufficient role) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 500 | Internal Server Error |

---

> 💡 **Swagger UI:** Truy cập `/api-docs` để xem interactive API documentation với OpenAPI 3.1 spec.

---

*Cập nhật: 2026-03-14*
