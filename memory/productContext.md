# Product Context — ManagerOrder (Premium Admin Web)

> Cập nhật: 2026-03-14

## 1. Mục đích sản phẩm

ManagerOrder là một **hệ thống quản lý đơn hàng và dịch vụ premium** (SaaS B2B Admin Panel) giúp chủ doanh nghiệp nhỏ/vừa quản lý toàn bộ quy trình:
- **Quản lý đơn hàng** (tạo, duyệt, cấp phát, theo dõi trạng thái, gia hạn, hoàn tiền)
- **Quản lý kho** (tài khoản nguồn slot-based, license key, cấp phát tự động)
- **Quản lý khách hàng** (RFM segmentation, nợ, phân nhóm, thẻ tag)
- **Quản lý thanh toán** (thanh toán từng phần, lịch sử, hóa đơn)
- **Quản lý dịch vụ Premium** (tài khoản chia sẻ, gói dịch vụ, subscription lifecycle)
- **Lịch và nhắc nhở** (gia hạn, nợ, sự kiện tùy chỉnh)
- **Dashboard & Báo cáo** (KPI, biểu đồ, lợi nhuận)
- **Hệ thống Webhook** (event-driven, HMAC-SHA256, retry queue)

## 2. Pain Points giải quyết

| Vấn đề | Giải pháp |
|--------|-----------|
| Quản lý slot tài khoản phức tạp | Auto-allocation engine với smart matching |
| Theo dõi gia hạn thủ công | Calendar + Cron job tự động nhắc |
| Rủi ro đặt trùng đơn | Duplicate check API + warning UI |
| Quản lý nợ khách hàng | Debt policy engine + auto-escalation |
| Thiếu báo cáo lợi nhuận | Dashboard stats + profit report |

## 3. Đối tượng người dùng

- **Admin Owner** (admin_owner): Toàn quyền hệ thống
- **Sales Staff** (sales_staff): Tạo đơn, quản lý khách
- **Inventory Staff** (inventory_staff): Quản lý kho, cấp phát
- **Customer Support** (customer_support): Hỗ trợ khách, xử lý hoàn tiền
- **Accountant** (accountant): Thanh toán, báo cáo tài chính

## 4. Business Domain Entities

### Core Entities
- **Order**: Đơn hàng có trạng thái FSM (draft → pending_payment → paid → provisioning → active → expired/refunded)
- **OrderItem**: Line item với price snapshot, assigned source account/key
- **Customer**: Khách hàng với contacts, tier (vip/regular), RFM segmentation, nicks registry
- **ProductService**: Sản phẩm/dịch vụ với mode (slot/key/hybrid), giá mua/bán, thời hạn
- **SourceAccount**: Tài khoản nguồn với slot management (max/used), credentials mã hóa
- **LicenseKey**: Key bản quyền với status lifecycle (available → reserved → used → expired)

### Premium Entities
- **PremiumServiceType**: Loại dịch vụ premium (Spotify, Netflix, etc.)
- **PremiumPackage**: Gói dịch vụ (individual/family/group) với pricing per slot
- **PremiumAccount**: Tài khoản premium với subscription lifecycle
- **PremiumAccountUser**: Thành viên tài khoản premium
- **CustomerPremiumSubscription**: Subscription khách hàng với renewal/migration

### Supporting Entities
- **PaymentSource**, **SalesChannel**: Cấu hình nguồn thanh toán và kênh bán
- **CalendarEvent**: Sự kiện với Google Calendar integration
- **Webhook/WebhookLog**: Hệ thống webhook events
- **SystemSettings**: Cấu hình hệ thống (thông tin công ty, ngân hàng)
- **ReminderConfig**: Cấu hình nhắc nhở Telegram/Email

## 5. Key Business Rules

1. **Order State Machine**: Trạng thái đơn hàng tuân theo FSM nghiêm ngặt (order-state-machine.ts)
2. **Price Snapshot**: Giá bán/mua được freeze tại thời điểm tạo đơn
3. **Slot Allocation**: Atomic increment qua PostgreSQL RPC, có advisory lock chống race condition
4. **Duplicate Check**: API check trùng đơn trước khi tạo
5. **Debt Policy**: Tự động escalation khi nợ quá hạn
6. **RFM Segmentation**: Tính toán tự động qua cron job
7. **Invoice Snapshot**: Lưu thông tin hóa đơn tại thời điểm tạo đơn

## 6. Canonical operating flow to preserve (2026-04-10)

The system should keep one coherent sales-management flow end to end:

1. customer/contact intake
2. product or service selection
3. order creation
4. payment and debt tracking
5. provisioning or slot allocation
6. active subscription operation
7. renewal, migration, or refund
8. reporting, debt review, and reminders

The current stabilization work should protect this flow before any large new module is added.

## 7. Bot support role in the product

Bots are not a side feature only for alerts. The target product role is:
- quick lookup for customer, order, inventory, and premium account state
- customer/contact matching support
- automated reminders for debt, renewal, and expiry
- controlled broadcast and operational actions
- shared governance across Telegram and Zalo with tenant-safe behavior
