# 📊 Database Schema Verification - Supabase/PostgreSQL

**Ngày:** 5 Tháng 3, 2026  
**Database:** PostgreSQL (Supabase)  
**ORM:** Prisma  
**Tổng Tables:** 18 tables  
**Status:** 🔍 Chờ xác minh

---

## 🎯 Tóm Tắt Cấu Trúc

```
Accounts & Users (2 tables)
├── accounts         ← Tài khoản công ty (multi-tenant)
└── users            ← Nhân viên/người dùng

Warehouses & Inventory (4 tables)
├── warehouses       ← Các kho hàng
├── warehouse_staff  ← Nhân viên kho
├── inventory        ← Tồn kho theo kho
└── inventory_logs   ← Lịch sử thay đổi tồn kho

Products & Categories (2 tables)
├── categories       ← Danh mục sản phẩm
└── products         ← Sản phẩm/dịch vụ

Customers (3 tables)
├── customers        ← Khách hàng
├── customer_addresses ← Địa chỉ khách hàng
└── customer_renewals  ← Gói dịch vụ/gia hạn

Orders (3 tables)
├── orders           ← Đơn hàng
├── order_items      ← Chi tiết đơn hàng
└── order_status_history ← Lịch sử trạng thái

Payments (3 tables)
├── payments         ← Thanh toán
├── payment_methods  ← Phương thức thanh toán
└── payment_refunds  ← Hoàn tiền

Notifications (1 table)
└── notifications    ← Thông báo
```

---

## 📋 CHI TIẾT TỪNG TABLE

### 1️⃣ **ACCOUNTS** - Tài khoản công ty
**Mục đích:** Lưu thông tin công ty/tài khoản (multi-tenant)

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| name | String | - | ✅ | Tên công ty |
| email | String | - | ✅ | Email (unique) |
| website | String | NULL | ❌ | Website công ty |
| logo | String | NULL | ❌ | URL logo |
| plan | String | "free" | ✅ | Gói: free/pro/enterprise |
| status | String | "active" | ✅ | Trạng thái: active/suspended/deleted |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| updatedAt | DateTime | now() | ✅ | Ngày cập nhật |
| deletedAt | DateTime | NULL | ❌ | Soft delete |

**Indexes:**
- `email` (unique)
- `status`

**Relations:**
- 1 → many: Accounts → Users
- 1 → many: Accounts → Warehouses
- 1 → many: Accounts → Products
- 1 → many: Accounts → Customers
- 1 → many: Accounts → Payments
- 1 → many: Accounts → Notifications

---

### 2️⃣ **USERS** - Nhân viên/Người dùng
**Mục đích:** Lưu thông tin người dùng hệ thống

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| accountId | String | - | ✅ | Liên kết tài khoản |
| email | String | - | ✅ | Email (unique) |
| passwordHash | String | NULL | ❌ | Hash mật khẩu (bcrypt) |
| firstName | String | NULL | ❌ | Tên |
| lastName | String | NULL | ❌ | Họ |
| role | String | "staff" | ✅ | Vai trò: admin/manager/staff/viewer |
| status | String | "active" | ✅ | Trạng thái: active/inactive/invited |
| lastLoginAt | DateTime | NULL | ❌ | Lần đăng nhập cuối |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| updatedAt | DateTime | now() | ✅ | Ngày cập nhật |
| deletedAt | DateTime | NULL | ❌ | Soft delete |

**Constraints:**
- `accountId + email` (unique) ← Mỗi account có email unique

**Indexes:**
- `accountId`
- `email` (unique)
- `status`

**Relations:**
- many → 1: Users → Accounts
- 1 → many: Users → WarehouseStaff
- 1 → many: Users → Orders
- 1 → many: Users → InventoryLogs
- 1 → many: Users → OrderStatusHistory

---

### 3️⃣ **WAREHOUSES** - Các kho hàng
**Mục đích:** Lưu thông tin kho hàng

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| accountId | String | - | ✅ | Tài khoản sở hữu |
| name | String | - | ✅ | Tên kho |
| address | String | NULL | ❌ | Địa chỉ |
| city | String | NULL | ❌ | Thành phố |
| state | String | NULL | ❌ | Tỉnh/Quốc gia |
| postalCode | String | NULL | ❌ | Mã bưu điện |
| country | String | NULL | ❌ | Quốc gia |
| phone | String | NULL | ❌ | Số điện thoại |
| managerId | String | NULL | ❌ | ID người quản lý |
| status | String | "active" | ✅ | Trạng thái: active/inactive |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| updatedAt | DateTime | now() | ✅ | Ngày cập nhật |
| deletedAt | DateTime | NULL | ❌ | Soft delete |

**Indexes:**
- `accountId`
- `status`

---

### 4️⃣ **WAREHOUSE_STAFF** - Nhân viên kho
**Mục đích:** Gán nhân viên vào kho hàng

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| warehouseId | String | - | ✅ | ID kho hàng |
| userId | String | - | ✅ | ID nhân viên |
| role | String | - | ✅ | Vai trò: manager/staff |
| assignedAt | DateTime | now() | ✅ | Ngày gán |

**Constraints:**
- `warehouseId + userId` (unique)

**Indexes:**
- `warehouseId`
- `userId`

---

### 5️⃣ **PRODUCTS** - Sản phẩm/Dịch vụ
**Mục đích:** Lưu catalog sản phẩm

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| accountId | String | - | ✅ | Tài khoản sở hữu |
| name | String | - | ✅ | Tên sản phẩm |
| sku | String | NULL | ❌ | Mã SKU |
| description | String | NULL | ❌ | Mô tả |
| categoryId | String | NULL | ❌ | ID danh mục |
| price | Decimal(10,2) | - | ✅ | Giá bán |
| cost | Decimal(10,2) | - | ✅ | Giá vốn |
| status | String | "active" | ✅ | Trạng thái: active/inactive/discontinued |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| updatedAt | DateTime | now() | ✅ | Ngày cập nhật |
| deletedAt | DateTime | NULL | ❌ | Soft delete |

**Constraints:**
- `accountId + sku` (unique)

**Indexes:**
- `accountId`
- `status`

---

### 6️⃣ **CATEGORIES** - Danh mục sản phẩm
**Mục đích:** Phân loại sản phẩm

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| accountId | String | - | ✅ | Tài khoản |
| name | String | - | ✅ | Tên danh mục |
| description | String | NULL | ❌ | Mô tả |
| createdAt | DateTime | now() | ✅ | Ngày tạo |

**Constraints:**
- `accountId + name` (unique)

---

### 7️⃣ **INVENTORY** - Tồn kho
**Mục đích:** Theo dõi tồn kho theo kho hàng

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| warehouseId | String | - | ✅ | ID kho hàng |
| productId | String | - | ✅ | ID sản phẩm |
| quantityAvailable | Int | 0 | ✅ | Số lượng có sẵn |
| quantityReserved | Int | 0 | ✅ | Số lượng đã đặt hàng |
| quantityDamaged | Int | 0 | ✅ | Số lượng hỏng |
| reorderLevel | Int | NULL | ❌ | Mức tồn kho tối thiểu |
| updatedAt | DateTime | now() | ✅ | Cập nhật lần cuối |

**Constraints:**
- `warehouseId + productId` (unique) ← Mỗi sản phẩm 1 kho hàng

**Indexes:**
- `warehouseId`
- `productId`

---

### 8️⃣ **INVENTORY_LOGS** - Lịch sử tồn kho
**Mục đích:** Ghi log mọi thay đổi tồn kho

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| warehouseId | String | - | ✅ | ID kho hàng |
| inventoryId | String | - | ✅ | ID tồn kho |
| referenceType | String | - | ✅ | Loại: purchase/sale/adjustment/damaged/return |
| referenceId | String | NULL | ❌ | Liên kết (order, purchase,...) |
| quantityChange | Int | - | ✅ | Số lượng thay đổi (+/-) |
| userId | String | NULL | ❌ | ID người thay đổi |
| notes | String | NULL | ❌ | Ghi chú |
| createdAt | DateTime | now() | ✅ | Ngày thay đổi |

**Indexes:**
- `warehouseId`
- `inventoryId`

---

### 9️⃣ **CUSTOMERS** - Khách hàng
**Mục đích:** Lưu thông tin khách hàng

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| accountId | String | - | ✅ | Tài khoản |
| name | String | - | ✅ | Tên khách hàng |
| email | String | NULL | ❌ | Email |
| phone | String | NULL | ❌ | Số điện thoại |
| companyName | String | NULL | ❌ | Tên công ty |
| taxId | String | NULL | ❌ | Mã số thuế |
| status | String | "active" | ✅ | Trạng thái: active/inactive/suspended |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| updatedAt | DateTime | now() | ✅ | Ngày cập nhật |
| deletedAt | DateTime | NULL | ❌ | Soft delete |

**Indexes:**
- `accountId`

---

### 🔟 **CUSTOMER_ADDRESSES** - Địa chỉ khách hàng
**Mục đích:** Lưu nhiều địa chỉ cho khách hàng

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| customerId | String | - | ✅ | ID khách hàng |
| type | String | - | ✅ | Loại: billing/shipping/other |
| street | String | NULL | ❌ | Đường phố |
| city | String | NULL | ❌ | Thành phố |
| state | String | NULL | ❌ | Tỉnh |
| postalCode | String | NULL | ❌ | Mã bưu điện |
| country | String | NULL | ❌ | Quốc gia |
| isPrimary | Boolean | false | ✅ | Địa chỉ mặc định |
| createdAt | DateTime | now() | ✅ | Ngày tạo |

**Indexes:**
- `customerId`

---

### 1️⃣1️⃣ **CUSTOMER_RENEWALS** - Gói deicv vụ/Gia hạn
**Mục đích:** Theo dõi gói dịch vụ và gia hạn của khách hàng

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| customerId | String | - | ✅ | ID khách hàng |
| accountId | String | - | ✅ | ID tài khoản |
| productId | String | NULL | ❌ | ID sản phẩm |
| renewalDate | DateTime | - | ✅ | Ngày gia hạn |
| expirationDate | DateTime | - | ✅ | Ngày hết hạn |
| frequency | String | - | ✅ | Tần suất: monthly/quarterly/yearly/custom |
| status | String | "active" | ✅ | Trạng thái: active/paused/cancelled/expired |
| notes | String | NULL | ❌ | Ghi chú |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| updatedAt | DateTime | now() | ✅ | Ngày cập nhật |

**Indexes:**
- `customerId`
- `status`

---

### 1️⃣2️⃣ **ORDERS** - Đơn hàng
**Mục đích:** Quản lý đơn hàng

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| accountId | String | - | ✅ | ID tài khoản |
| warehouseId | String | - | ✅ | ID kho hàng |
| customerId | String | - | ✅ | ID khách hàng |
| orderNumber | String | - | ✅ | Mã đơn hàng (unique) |
| status | String | "draft" | ✅ | Trạng thái: draft/pending/processing/shipped/delivered/cancelled |
| subtotal | Decimal(12,2) | - | ✅ | Tổng cộng (chưa thuế) |
| tax | Decimal(12,2) | - | ✅ | Thuế |
| shippingCost | Decimal(12,2) | - | ✅ | Phí vận chuyển |
| total | Decimal(12,2) | - | ✅ | Tổng cộng |
| notes | String | NULL | ❌ | Ghi chú |
| shippingAddressId | String | NULL | ❌ | Địa chỉ giao hàng |
| billingAddressId | String | NULL | ❌ | Địa chỉ thanh toán |
| createdById | String | NULL | ❌ | ID người tạo |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| updatedAt | DateTime | now() | ✅ | Ngày cập nhật |
| shippedAt | DateTime | NULL | ❌ | Ngày giao hàng |
| deliveredAt | DateTime | NULL | ❌ | Ngày nhận hàng |

**Indexes:**
- `accountId`
- `warehouseId`
- `customerId`
- `status`

---

### 1️⃣3️⃣ **ORDER_ITEMS** - Chi tiết đơn hàng
**Mục đích:** Lưu từng sản phẩm trong đơn hàng

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| orderId | String | - | ✅ | ID đơn hàng |
| productId | String | - | ✅ | ID sản phẩm |
| quantity | Int | - | ✅ | Số lượng |
| unitPrice | Decimal(10,2) | - | ✅ | Giá đơn vị |
| lineTotal | Decimal(12,2) | - | ✅ | Tổng cộng (quantity × price) |
| createdAt | DateTime | now() | ✅ | Ngày tạo |

**Indexes:**
- `orderId`

**Cascade:** Xóa order → xóa order_items

---

### 1️⃣4️⃣ **ORDER_STATUS_HISTORY** - Lịch sử trạng thái
**Mục đích:** Ghi log mọi thay đổi trạng thái đơn hàng

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| orderId | String | - | ✅ | ID đơn hàng |
| oldStatus | String | NULL | ❌ | Trạng thái cũ |
| newStatus | String | - | ✅ | Trạng thái mới |
| changedById | String | NULL | ❌ | ID người thay đổi |
| notes | String | NULL | ❌ | Ghi chú |
| changedAt | DateTime | now() | ✅ | Ngày thay đổi |

**Indexes:**
- `orderId`

---

### 1️⃣5️⃣ **PAYMENTS** - Thanh toán
**Mục đích:** Theo dõi các giao dịch thanh toán

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| orderId | String | - | ✅ | ID đơn hàng |
| accountId | String | - | ✅ | ID tài khoản |
| amount | Decimal(12,2) | - | ✅ | Số tiền |
| status | String | "pending" | ✅ | Trạng thái: pending/completed/failed/refunded |
| paymentMethodId | String | NULL | ❌ | ID phương thức thanh toán |
| processorTransactionId | String | NULL | ❌ | Mã giao dịch từ processor |
| errorMessage | String | NULL | ❌ | Thông báo lỗi nếu có |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| updatedAt | DateTime | now() | ✅ | Ngày cập nhật |
| processedAt | DateTime | NULL | ❌ | Ngày xử lý |

**Indexes:**
- `orderId`
- `accountId`

---

### 1️⃣6️⃣ **PAYMENT_METHODS** - phương thức thanh toán
**Mục đích:** Lưu các phương thức thanh toán của tài khoản

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| accountId | String | - | ✅ | ID tài khoản |
| userId | String | NULL | ❌ | ID người dùng |
| type | String | - | ✅ | Loại: credit_card/bank_transfer/paypal/other |
| tokenEncrypted | String | NULL | ❌ | Token mã hóa |
| lastFour | String | NULL | ❌ | 4 chữ số cuối (thẻ) |
| expiryDate | DateTime | NULL | ❌ | Ngày hết hạn |
| isDefault | Boolean | false | ✅ | Là phương thức mặc định |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| deletedAt | DateTime | NULL | ❌ | Soft delete |

**Indexes:**
- `accountId`

---

### 1️⃣7️⃣ **PAYMENT_REFUNDS** - Hoàn tiền
**Mục đích:** Theo dõi các giao dịch hoàn tiền

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| paymentId | String | - | ✅ | ID thanh toán |
| amount | Decimal(12,2) | - | ✅ | Số tiền hoàn lại |
| reason | String | NULL | ❌ | Lý do hoàn tiền |
| status | String | "pending" | ✅ | Trạng thái: pending/completed/failed |
| processorRefundId | String | NULL | ❌ | Mã hoàn tiền từ processor |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| completedAt | DateTime | NULL | ❌ | Ngày hoàn thành |

**Indexes:**
- `paymentId`

---

### 1️⃣8️⃣ **NOTIFICATIONS** - Thông báo
**Mục đích:** Lưu thông báo cho người dùng

| Cột | Kiểu | Mặc định | Bắt buộc | Mô tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| accountId | String | - | ✅ | ID tài khoản |
| userId | String | NULL | ❌ | ID người dùng |
| customerId | String | NULL | ❌ | ID khách hàng |
| type | String | - | ✅ | Loại thông báo |
| title | String | - | ✅ | Tiêu đề |
| body | String | NULL | ❌ | Nội dung |
| isRead | Boolean | false | ✅ | Đã đọc |
| referenceType | String | NULL | ❌ | Loại đối tượng |
| referenceId | String | NULL | ❌ | ID đối tượng |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| readAt | DateTime | NULL | ❌ | Ngày đọc |

**Indexes:**
- `accountId`

---

## 🔗 Mối Quan Hệ Giữa Các Bảng

```
                          ┌─────────────────┐
                          │   ACCOUNTS      │
                          │   (Công ty)     │
                          └────────┬────────┘
                                   │
         ┌─────────────────────────┼──────────────────────────┐
         │                         │                          │
         ▼                         ▼                          ▼
    ┌─────────┐           ┌────────────┐            ┌──────────────┐
    │  USERS  │           │WAREHOUSES  │            │  PRODUCTS    │
    └────┬────┘           └─────┬──────┘            └──────┬───────┘
         │                      │                          │
         │                 ┌────▼──────────┐               │
         │                 │WAREHOUSE_STAFF│               │
         │                 └────┬──────────┘               │
         │                      │                          │
         │                 ┌────▼──────────┐        ┌──────▼───────┐
         │                 │  INVENTORY   │◄───────┤ CATEGORIES   │
         │                 └────┬─────────┘        └──────────────┘
         │                      │
         │              ┌───────▼──────────┐
         │              │ INVENTORY_LOGS   │
         │              └──────────────────┘
         │
         ├──────────────────────────────┐
         │                              │
    ┌────▼────────────┐          ┌──────▼──────────┐
    │  CUSTOMERS      │          │   ORDERS        │
    └────┬────────────┘          └────┬────────────┘
         │                            │
         ├──►┌───────────────────┐    │
         │   │CUSTOMER_ADDRESSES│◄───┘
         │   └───────────────────┘
         │
         └──►┌──────────────────┐
             │CUSTOMER_RENEWALS │
             └──────────────────┘

              ┌──────────────┐
              │ ORDER_ITEMS  │
              └────┬─────────┘
                   │
        ┌──────────▼──────────┐
        │ORDER_STATUS_HISTORY │
        └─────────────────────┘

    ┌──────────────┐
    │PAYMENT_METHODS
    ├──────┬───────┘
    │      │
    │      ├──►┌──────────────┐
    │      │   │  PAYMENT_REFUNDS
    │      │   └──────────────┘
    │      │
    │  ┌───▼───────────┐
    │  │  PAYMENTS    │
    │  └──────────────┘

    ┌──────────────┐
    │NOTIFICATIONS│
    └──────────────┘
```

---

## ✅ CHECKLIST VERIFICATION

Hãy kiểm tra các điểm sau:

### Accounts & Users
- [ ] Accounts: 12 cột + indexes
- [ ] Users: 12 cột + constraints (accountId + email unique)
- [ ] Soft delete enabled (deletedAt)
- [ ] Role-based (admin/manager/staff/viewer)

### Warehouses
- [ ] Warehouses: 11 cột
- [ ] WarehouseStaff: Junction table (warehouse + user)
- [ ] Inventory: Tracking per warehouse + product
- [ ] InventoryLogs: Full audit trail

### Products
- [ ] Products: 9 cột với price/cost (Decimal)
- [ ] Categories: Support multi-tenant
- [ ] SKU unique per account

### Customers
- [ ] Customers: 8 cột
- [ ] CustomerAddresses: Multiple per customer
- [ ] CustomerRenewals: Subscription/renewal tracking

### Orders
- [ ] Orders: Status tracking (draft → shipped → delivered)
- [ ] OrderItems: Line items with unit price
- [ ] OrderStatusHistory: Audit trail

### Payments
- [ ] Payments: Multi-status (pending/completed/failed/refunded)
- [ ] PaymentMethods: Secure token storage
- [ ] PaymentRefunds: Refund tracking

### Indexes
- [ ] `accounts.email` (unique)
- [ ] `accounts.status` (query frequently)
- [ ] `users.accountId` (multi-tenant isolation)
- [ ] `users.email` (unique)
- [ ] `warehouses.accountId` + `status`
- [ ] `products.accountId` (multi-tenant)
- [ ] `orders.accountId` + `status` (frequently filtered)
- [ ] `inventory.warehouseId` + `productId` (unique)
- [ ] `payments.orderId` + `accountId`

---

## 🎯 Tính Năng Hỗ Trợ

### ✅ Multi-Tenancy
- Mỗi table có `accountId` để isolate data
- Users được gán vào account
- Soft delete (không xóa thật, chỉ đánh dấu)

### ✅ Inventory Management
- Tồn kho theo kho (warehouse + product)
- Theo dõi lịch sử thay đổi
- Hỗ trợ: purchase, sale, adjustment, damaged, return

### ✅ Order Processing
- Full lifecycle: draft → pending → processing → shipped → delivered
- Audit trail cho trạng thái
- Multiple addresses (billing + shipping)

### ✅ Customer Management
- Khách hàng + addresses
- Gói dịch vụ/gia hạn (renewals)
- Theo dõi frequency (monthly/quarterly/yearly)

### ✅ Payment Handling
- Payment methods (credit card, bank, paypal)
- Transaction tracking
- Refund management

### ✅ Security
- Password hashed (bcrypt)
- Soft delete (data không bao giờ mất)
- JWT authentication ready
- Account-level isolation

---

## 📝 Các Điểm Lưu Ý

### ✅ Đã Triển Khai
- [x] 18 tables, 130+ columns
- [x] Proper indexes cho performance
- [x] Foreign key relationships
- [x] Timestamps (createdAt/updatedAt)
- [x] Soft delete support
- [x] Multi-tenant architecture
- [x] Decimal for monetary values

### ⚠️ Cần Xác Nhận
- [ ] Tên table/cột có đúng không? (tiếng Anh)
- [ ] Kiểu dữ liệu có phù hợp? (Decimal vs Float)
- [ ] Constraints có đúng?
- [ ] Relationships có chính xác?
- [ ] Default values có hợp lý?
- [ ] Indexes có đủ?

---

## 🚀 Bước Tiếp Theo

1. **Xác minh** schema này
2. **Điều chỉnh** nếu cần thiết
3. Chạy: `npm run db:push` để create tables
4. Kiểm tra Supabase dashboard

---

## 📞 Nếu Có Thay Đổi

Vui lòng chỉ định:
- Table nào cần thay đổi?
- Cột nào cần thêm/xóa/sửa?
- Mối quan hệ cần điều chỉnh?

---

**Status:** 🔍 Chờ xác minh  
**Last Updated:** 5 Tháng 3, 2026

Hãy review và cho tôi biết cần thay đổi gì nhé! ✅
