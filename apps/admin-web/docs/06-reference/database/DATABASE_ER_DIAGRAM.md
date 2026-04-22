# 📊 Database ER Diagram - Warehouse Management System

## Visual Schema Map

```
╔═════════════════════════════════════════════════════════════════════════════╗
║                      WAREHOUSE MANAGEMENT SYSTEM                           ║
║                         Supabase PostgreSQL                                 ║
╚═════════════════════════════════════════════════════════════════════════════╝


┌─────────────────────────────────────────────────────────────────────────────┐
│                         ACCOUNTS & USERS LAYER                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────┐                                   │
│  │         ACCOUNTS (Tài khoản)         │                                   │
│  ├──────────────────────────────────────┤                                   │
│  │ ✓ id (CUID)                          │                                   │
│  │ ✓ name (Tên công ty)                 │                                   │
│  │ ✓ email (unique)                     │                                   │
│  │ · website                            │  1 ────────|                      │
│  │ · logo                               │           │                      │
│  │ · plan (free/pro/enterprise)         │      ┌────┴──────────────────┐   │
│  │ · status (active/suspended)          │      │ 1 → Many Relationships│   │
│  │ · createdAt, updatedAt, deletedAt    │      │                      │   │
│  └──────────────────────────────────────┘      │ • Users              │   │
│                                                  │ • Warehouses        │   │
│                                                  │ • Products          │   │
│                                Accounts ◄─────────┤ • Customers         │   │
│                                 (1)              │ • Orders            │   │
│                                  ↓               │ • Payments          │   │
│  ┌──────────────────────────────────────┐      │ • Notifications     │   │
│  │         USERS (Nhân viên)            │      └────────────────────┘   │
│  ├──────────────────────────────────────┤                                   │
│  │ ✓ id (CUID)                          │                                   │
│  │ ✓ accountId (FK → Accounts)          │── Many ──→ 1 Account             │
│  │ ✓ email (unique per account)         │                                   │
│  │ · passwordHash (bcrypt)              │                                   │
│  │ · firstName, lastName                │                                   │
│  │ · role (admin/manager/staff/viewer)  │                                   │
│  │ · status (active/inactive/invited)   │                                   │
│  │ · lastLoginAt                        │                                   │
│  │ · createdAt, updatedAt, deletedAt    │                                   │
│  └──────────────────────────────────────┘                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                    WAREHOUSES & INVENTORY LAYER                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────┐                                   │
│  │      WAREHOUSES (Kho hàng)           │                                   │
│  ├──────────────────────────────────────┤                                   │
│  │ ✓ id (CUID)                          │                                   │
│  │ ✓ accountId (FK → Accounts)          │── Many ──→ 1 Account             │
│  │ ✓ name                               │                                   │
│  │ · address, city, state, country      │                      1            │
│  │ · phone, managerId                   │                      ↓            │
│  │ · status (active/inactive)           │  ┌────────────────────────────┐ │
│  │ · createdAt, updatedAt, deletedAt    │  │  WAREHOUSE_STAFF           │ │
│  └──────────────────────────────────────┘  │  (Junction: Staff + Warehouse)
│           │                                 ├────────────────────────────┤ │
│           │                                 │ ✓ id                       │ │
│           │                                 │ ✓ warehouseId (FK)         │ │
│           │                                 │ ✓ userId (FK → Users)      │ │
│           │                                 │ ✓ role (manager/staff)     │ │
│    ┌──────┴──────────┐                     │ · assignedAt               │ │
│    │ Many ──→ 1      │                     └────────────────────────────┘ │
│    ↓                 ↓                                                      │
│  ┌─────────────────────┐         ┌──────────────────────┐                  │
│  │   INVENTORY         │         │  INVENTORY_LOGS      │                  │
│  │ (Tồn kho)           │         │ (Lịch sử thay đổi)   │                  │
│  ├─────────────────────┤         ├──────────────────────┤                  │
│  │ ✓ id                │         │ ✓ id                 │                  │
│  │ ✓ warehouseId (FK)  │         │ ✓ warehouseId (FK)   │                  │
│  │ ✓ productId (FK)    │◄────────┤ ✓ inventoryId (FK)   │                  │
│  │ ✓ quantityAvailable │ 1       │ ✓ referenceType      │                  │
│  │ ✓ quantityReserved  │         │   (purchase/sale)    │                  │
│  │ ✓ quantityDamaged   │         │ · referenceId        │                  │
│  │ · reorderLevel      │         │ ✓ quantityChange     │                  │
│  │ · updatedAt         │         │ · userId             │                  │
│  └─────────────────────┘         │ · notes, createdAt   │                  │
│                                   └──────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                    PRODUCTS & CATEGORIES LAYER                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────┐                                   │
│  │      CATEGORIES (Danh mục)           │                                   │
│  ├──────────────────────────────────────┤                                   │
│  │ ✓ id (CUID)                          │                                   │
│  │ ✓ accountId (FK → Accounts)          │── Many ──→ 1 Account             │
│  │ ✓ name                               │                                   │
│  │ · description                        │         1                        │
│  │ · createdAt                          │         ↓                        │
│  └──────────────────────────────────────┘         │                        │
│                    ▲                      ┌────────┴──────────┐            │
│                    │ 1 ← Many             │                   ↓            │
│                    │                      ┌──────────────────────────────┐ │
│                    │                      │     PRODUCTS                 │ │
│                    └──────────────────────┤   (Sản phẩm/Dịch vụ)       │ │
│                                           ├──────────────────────────────┤ │
│                                           │ ✓ id (CUID)                  │ │
│                                           │ ✓ accountId (FK)             │ │
│                                           │ ✓ name                       │ │
│                                           │ · sku (unique per account)   │ │
│                                           │ · description                │ │
│                                           │ · categoryId (FK)            │ │
│                                           │ ✓ price (Decimal)            │ │
│                                           │ ✓ cost (Decimal)             │ │
│                                           │ · status                     │ │
│                                           │ · createdAt, updatedAt       │ │
│                                           └──────────────────────────────┘ │
│                                                      │                      │
│                                        ┌─────────────┴─────────────┐       │
│                                        │ Many ──→ 1 Relationships │       │
│                                        │                           │       │
│                                        ▼                           ▼       │
│                                    INVENTORY            ORDER_ITEMS (see  │
│                                 (Tồn kho per           below)            │
│                                  warehouse)                              │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                     CUSTOMERS & RENEWALS LAYER                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────┐                                   │
│  │      CUSTOMERS (Khách hàng)          │                                   │
│  ├──────────────────────────────────────┤                                   │
│  │ ✓ id (CUID)                          │                                   │
│  │ ✓ accountId (FK → Accounts)          │── Many ──→ 1 Account             │
│  │ ✓ name                               │                                   │
│  │ · email, phone                       │                      1            │
│  │ · companyName, taxId                 │               ┌──────┴─────────┐ │
│  │ · status (active/inactive/suspended) │               │ Many ──→ 1      │ │
│  │ · createdAt, updatedAt, deletedAt    │               ↓                 ↓ │
│  └──────────────────────────────────────┘                                   │
│           │         │                        ┌─────────────────────────────┐ │
│           │         └────────────────────────┤  CUSTOMER_ADDRESSES         │ │
│           │                                  │ (Địa chỉ khách hàng)        │ │
│           │              ORDERS ◄────────────┤                             │ │
│           │              (See  │             ├─────────────────────────────┤ │
│           │               below)├──────────────│ ✓ id                       │ │
│           │                                  │ ✓ customerId (FK)           │ │
│           │                                  │ ✓ type (billing/shipping)   │ │
│           │                                  │ · street, city, state       │ │
│           │                                  │ · postalCode, country       │ │
│           │                                  │ · isPrimary                 │ │
│           │                                  │ · createdAt                 │ │
│           │                                  └─────────────────────────────┘ │
│           │                                                                  │
│           └──────────────────────┬──────────────────────────────────────────█ │
│                            1     │                                           │
│                            ↓     │                                           │
│           ┌────────────────────────────────────────────┐                    │
│           │   CUSTOMER_RENEWALS                        │                    │
│           │  (Gói dịch vụ/Gia hạn)                    │                    │
│           ├────────────────────────────────────────────┤                    │
│           │ ✓ id (CUID)                                │                    │
│           │ ✓ customerId (FK)                          │─ Many    ┌─────┐   │
│           │ ✓ accountId (FK)                           │   ──→   │ 1   │   │
│           │ · productId (FK → Products)                │         │   │   │
│           │ ✓ renewalDate (DateTime)                   │      Product    │   │
│           │ ✓ expirationDate (DateTime)                │       (optional)   │
│           │ ✓ frequency (monthly/yearly/etc)           │                    │
│           │ · status (active/paused/cancelled)         │                    │
│           │ · notes                                    │                    │
│           │ · createdAt, updatedAt                     │                    │
│           └────────────────────────────────────────────┘                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                       ORDERS & ORDER ITEMS LAYER                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │     ORDERS (Đơn hàng)                                                │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │ ✓ id (CUID)                                                          │  │
│  │ ✓ accountId (FK → Accounts)                           ──→ 1 Account │  │
│  │ ✓ warehouseId (FK → Warehouses)                       ──→ 1 Warehouse
│  │ ✓ customerId (FK → Customers)                         ──→ 1 Customer
│  │ ✓ orderNumber (unique)                                               │  │
│  │ ✓ status (draft → pending → processing → shipped → delivered)        │  │
│  │ ✓ subtotal, tax, shippingCost, total (Decimal)                      │  │
│  │ · notes                                                              │  │
│  │ · shippingAddressId (FK → CustomerAddresses)                        │  │
│  │ · billingAddressId (FK → CustomerAddresses)                         │  │
│  │ · createdById (FK → Users)                                           │  │
│  │ · createdAt, updatedAt, shippedAt, deliveredAt                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                     │                              │                        │
│            1 ───────┴──────────────────┬───────────┴──────── 1             │
│            │                           │                                    │
│            ▼                           ▼                                    │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────────┐ │
│  │   ORDER_ITEMS           │  │  ORDER_STATUS_HISTORY                   │ │
│  │ (Chi tiết đơn hàng)     │  │ (Lịch sử thay đổi trạng thái)           │ │
│  ├─────────────────────────┤  ├─────────────────────────────────────────┤ │
│  │ ✓ id (CUID)             │  │ ✓ id (CUID)                             │ │
│  │ ✓ orderId (FK)          │  │ ✓ orderId (FK)                          │ │
│  │ ✓ productId (FK)  ──┐   │  │ · oldStatus → newStatus (ngành hàng)    │ │
│  │ ✓ quantity (Int)   │   │  │ · changedById (FK → Users, optional)     │ │
│  │ ✓ unitPrice        │   │  │ · notes                                 │ │
│  │ ✓ lineTotal        │   │  │ · changedAt                             │ │
│  │ · createdAt        │   │  └─────────────────────────────────────────┘ │
│  └─────────────────────────┘  │                                            │
│            │                  ↓ (Cascade delete when order deleted)        │
│            └────────────────► PRODUCTS                                     │
│                               (Many ──→ 1 Product)                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                        PAYMENTS & REFUNDS LAYER                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────┐                     │
│  │       PAYMENT_METHODS                              │                     │
│  │    (Phương thức thanh toán)                        │                     │
│  ├───────────────────────────────────────────────────┤                     │
│  │ ✓ id (CUID)                                        │                     │
│  │ ✓ accountId (FK → Accounts)                ──→ 1   │                     │
│  │ · userId (FK → Users, optional)                    │                     │
│  │ ✓ type (credit_card/bank/paypal)                   │                     │
│  │ · tokenEncrypted (token mã hóa)                    │                     │
│  │ · lastFour (4 chữ số cuối)                         │                     │
│  │ · expiryDate                                       │                     │
│  │ · isDefault                                        │                     │
│  │ · createdAt, deletedAt (soft delete)               │                     │
│  └───────────────────────────────────────────────────┘                     │
│           │                                                                  │
│           │ 1 ──────────────────────┐                                       │
│           │                         │                                       │
│           ▼                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │                    PAYMENTS                                      │     │
│  │              (Giao dịch thanh toán)                             │     │
│  ├──────────────────────────────────────────────────────────────────┤     │
│  │ ✓ id (CUID)                                                      │     │
│  │ ✓ orderId (FK → Orders)                           ──→ 1 Order   │     │
│  │ ✓ accountId (FK → Accounts)                       ──→ 1 Account │     │
│  │ ✓ amount (Decimal)                                              │     │
│  │ ✓ status (pending/completed/failed/refunded)                   │     │
│  │ · paymentMethodId (FK → PaymentMethods)           ──→ 1 (opt)  │     │
│  │ · processorTransactionId (Stripe/etc)                          │     │
│  │ · errorMessage (nếu fail)                                       │     │
│  │ · createdAt, updatedAt, processedAt                            │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│           │                                                                  │
│           │ 1 Many                                                          │
│           │ ──→                                                             │
│           ▼                                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │                  PAYMENT_REFUNDS                                │     │
│  │              (Hoàn tiền/Refund)                                │     │
│  ├──────────────────────────────────────────────────────────────────┤     │
│  │ ✓ id (CUID)                                                      │     │
│  │ ✓ paymentId (FK → Payments)                       ──→ 1 Payment │     │
│  │ ✓ amount (Decimal)                                              │     │
│  │ · reason (lý do hoàn tiền)                                      │     │
│  │ ✓ status (pending/completed/failed)                            │     │
│  │ · processorRefundId (từ Stripe/etc)                            │     │
│  │ · createdAt, completedAt                                        │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                         NOTIFICATIONS LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                  NOTIFICATIONS                                   │      │
│  │              (Thông báo cho người dùng)                         │      │
│  ├──────────────────────────────────────────────────────────────────┤      │
│  │ ✓ id (CUID)                                                      │      │
│  │ ✓ accountId (FK → Accounts)                       ──→ 1 Account │      │
│  │ · userId (FK → Users, optional)                                 │      │
│  │ · customerId (FK → Customers, optional)                         │      │
│  │ ✓ type (order_placed/payment_received/stock_low/etc)           │      │
│  │ ✓ title (tiêu đề)                                               │      │
│  │ · body (nội dung chi tiết)                                      │      │
│  │ · isRead (đã đọc chưa)                                          │      │
│  │ · referenceType (order/payment/inventory/etc)                  │      │
│  │ · referenceId (ID của object được reference)                   │      │
│  │ · createdAt, readAt                                            │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘


═════════════════════════════════════════════════════════════════════════════════
                            DATA FLOW EXAMPLE

User (Nhân viên) tạo đơn hàng:

Users ───→ Orders ───→ OrderItems ───→ Products
         ↓                ↓
      Customers   InventoryLogs (stock reduced)
         ↓
  CustomerAddresses (shipping)

      ↓ (Order confirmed) ↓
      
   ↓ (Payment made) ↓
   
    Payments ────→ PaymentMethods
      ↓
 OrderStatusHistory (logged: pending→processing)

      ↓ (When shipped) ↓
      
 OrderStatusHistory (logged: processing→shipped)

      ↓ (Notifications sent) ↓
      
    Notifications (user_id, order_id, "Order shipped")

═════════════════════════════════════════════════════════════════════════════════
```

---

## 📋 Bảng Tóm Tắt: 18 Tables

| Lớp | Table | Hàng | Chức Năng |
|-----|-------|------|----------|
| **Auth** | accounts | 9 | Tài khoản công ty (multi-tenant) |
|  | users | 12 | Nhân viên/người dùng + password |
| **Warehouse** | warehouses | 11 | Các kho hàng |
|  | warehouse_staff | 4 | Nhân viên gán cho kho |
|  | inventory | 7 | Tồn kho (warehouse + product) |
|  | inventory_logs | 8 | Lịch sử thay đổi |
| **Products** | categories | 4 | Danh mục sản phẩm |
|  | products | 11 | Sản phẩm/dịch vụ |
| **Customers** | customers | 9 | Khách hàng |
|  | customer_addresses | 8 | Địa chỉ (billing/shipping) |
|  | customer_renewals | 11 | Gói dịch vụ/gia hạn |
| **Orders** | orders | 16 | Đơn hàng |
|  | order_items | 7 | Chi tiết từng sản phẩm |
|  | order_status_history | 6 | Audit trail trạng thái |
| **Payments** | payment_methods | 8 | Phương thức thanh toán |
|  | payments | 11 | Giao dịch thanh toán |
|  | payment_refunds | 7 | Hoàn tiền |
| **Notifications** | notifications | 10 | Thông báo |

**Total: 18 Tables, 187 Columns**

---

## ✅ Indexing Strategy

**High Performance Queries:**
```
SELECT * FROM orders WHERE accountId = $1 AND status = $2
  → Index: (accountId, status)

SELECT * FROM inventory WHERE warehouseId = $1
  → Index: (warehouseId)

SELECT * FROM users WHERE accountId = $1 AND email = $2
  → Index: (accountId, email)

SELECT * FROM products WHERE accountId = $1
  → Index: (accountId)
```

---

**Status:** 🔍 **Chờ xác minh từ bạn**

Vui lòng review và đánh dấu:
- [ ] Đúng cấu trúc?
- [ ] Có table/cột nào cần thêm?
- [ ] Có constraints nào cần sửa?
- [ ] Relationships có chính xác?

Chỉ cần comment và tôi sẽ sửa! 👍
