# Modules nghiệp vụ — ManagerOrder

> Chi tiết chức năng từng module trong hệ thống

---

## 1. Orders (Quản lý đơn hàng)

### Chức năng chính
- **CRUD đơn hàng** — tạo, sửa, xóa (soft delete), batch operations
- **State Machine (FSM)** — 7 trạng thái: `draft → pending_payment → paid → provisioning → active → expired → refunded`
- **Atomic creation** — tạo order + items trong 1 transaction (RPC `create_order_with_items`)
- **Duplicate check** — kiểm tra trùng đơn dựa trên KH + sản phẩm + khoảng thời gian
- **Price snapshot** — giá bán/mua được freeze tại thời điểm tạo
- **Gia hạn (Renewal)** — chọn kỳ gia hạn (6/12 tháng), log lịch sử, gửi thông báo
- **Hoàn tiền (Refund)** — refund từng phần/toàn bộ, tự động giải phóng inventory
- **Export/Import** — Excel export danh sách, import đơn hàng

### Components (20 UI components)
- `OrderList`, `OrderDetail`, `CreateOrderModal`, `EditOrderModal`
- `OrderStatusBadge`, `OrderTimeline`, `OrderItemTable`
- `RenewalDialog`, `RefundDialog`, `BatchActionBar`

### Hooks
- `use-orders` — CRUD + list + pagination
- `use-order-status-history` — timeline trạng thái
- `use-check-duplicate-order` — kiểm tra trùng
- `use-renewals` — gia hạn đơn
- `use-refunds` — hoàn tiền
- `use-payments` — thanh toán từng phần

---

## 2. Customers (Quản lý khách hàng)

### Chức năng chính
- **CRUD khách hàng** — tạo, sửa, xóa, batch operations
- **RFM Segmentation** — tự động tính R (Recency), F (Frequency), M (Monetary) qua cron
- **Debt Management** — theo dõi nợ, policy escalation tự động
- **Tags & Groups** — phân loại khách hàng bằng tags (màu sắc) và groups (rules tự động)
- **Nicks Registry** — quản lý username/nick KH trên các platform
- **Customer Tiers** — `regular`, `vip`, `potential`, `new`

### Components (13 UI components)
- `CustomerList`, `CustomerDetail`, `CreateCustomerModal`
- `CustomerTagManager`, `CustomerGroupManager`
- `DebtSummary`, `RFMChart`, `CustomerNicksEditor`

### Hooks
- `use-customers` — CRUD + search + filter
- `use-customer-detail` — chi tiết KH + orders
- `use-customer-tags` — CRUD tags
- `use-customer-groups` — CRUD groups
- `use-debt-summary` — tổng nợ

---

## 3. Inventory (Quản lý kho)

### Chức năng chính
- **Source Accounts** — tài khoản nguồn (slot-based), quản lý max/used slots
- **License Keys** — lifecycle management (available → reserved → used → expired)
- **Smart Matching** — thuật toán gợi ý tài khoản phù hợp nhất cho đơn
- **Auto-Allocation** — cấp phát tự động qua RPC `confirm_allocation_atomic`
- **Deallocation** — giải phóng batch, tự động khi refund
- **Inventory Dashboard** — tổng quan slot, tỉ lệ sử dụng, profit per account
- **Profit Report** — lợi nhuận theo sản phẩm, account

### Components (12 UI components)
- `SourceAccountList`, `SourceAccountDetail`, `CreateSourceAccountModal`
- `AllocationPanel`, `SmartMatchingSuggestions`
- `InventoryDashboard`, `ProfitChart`, `SlotUsageBar`

### Hooks
- `use-inventory` — CRUD source accounts
- `use-source-accounts` — detail + operations
- `use-inventory-dashboard` — stats
- `use-profit-report` — profit data
- `use-account-suggestions` — smart matching

---

## 4. Premium (Dịch vụ Premium)

### Chức năng chính
- **Service Types** — định nghĩa loại dịch vụ (Spotify, Netflix, YouTube, etc.)
- **Packages** — gói dịch vụ (individual/family/group) với pricing per slot
- **Premium Accounts** — tài khoản premium với subscription lifecycle
- **User Management** — thêm/bớt thành viên vào tài khoản
- **Subscription Tracking** — theo dõi hết hạn, renewal, migration

### Components (12 UI components)
- `PremiumServiceList`, `PremiumPackageManager`
- `PremiumAccountCard`, `PremiumUserTable`
- `SubscriptionTimeline`, `MigrationDialog`

### Hooks
- `use-premium` — CRUD services + packages + accounts

---

## 5. Calendar (Lịch & Nhắc nhở)

### Chức năng chính
- **Monthly View** — xem sự kiện theo tháng
- **Event Types** — gia hạn, nợ, tùy chỉnh, meeting
- **Notes** — ghi chú nhanh theo ngày
- **Auto-generated** — tự động tạo event khi đơn sắp hết hạn
- **Google Calendar Sync** — tích hợp Google Calendar API (tùy chọn)
- **Telegram Reminders** — cron gửi nhắc 6AM + 9PM

### Components (5 UI components)
- `CalendarView`, `EventCard`, `EventForm`
- `DailyNotes`, `CalendarSidebar`

### Hooks
- `use-calendar-events` — CRUD events
- `use-calendar-notes` — CRUD notes

---

## 6. Dashboard (Bảng điều khiển)

### Chức năng chính
- **KPI Cards** — doanh thu, đơn mới, khách mới, nợ
- **Revenue Chart** — biểu đồ doanh thu theo ngày/tuần/tháng
- **Order Status Distribution** — pie chart theo trạng thái
- **Product Performance** — sản phẩm bán chạy
- **Recent Activity** — hoạt động gần đây

### Components
- `DashboardStats`, `RevenueChart`, `OrderStatusPie`
- `ProductRanking`, `RecentActivityFeed`

### Hooks
- `use-dashboard` — all dashboard stats

---

## 7. Settings (Cài đặt)

### Chức năng chính
- **Company Info** — tên, địa chỉ, logo, thông tin ngân hàng
- **Payment Sources** — cấu hình nguồn thanh toán
- **Sales Channels** — kênh bán hàng (Facebook, Zalo, Website)
- **Webhook Endpoints** — cấu hình webhook URLs + events
- **Products Management** — quản lý sản phẩm/dịch vụ
- **User Management** — thêm/sửa admin users + RBAC

### Components (10 UI components)
- `CompanySettings`, `PaymentSourceManager`
- `SalesChannelManager`, `WebhookManager`
- `UserManagement`, `RoleSelector`

### Hooks
- `use-settings` — company + payment + channels
- `use-products` — CRUD products
- `use-providers` — CRUD providers

---

## 8. Activity Logs (Nhật ký hoạt động)

### Chức năng chính
- **Audit Trail** — ghi log mọi mutation (create/update/delete)
- **Filter** — theo entity type, user, date range
- **Change Details** — diff before/after cho mỗi thay đổi

### Hooks
- `use-activity-logs` — list + filter

---

## 9. Trash (Thùng rác)

### Chức năng chính
- **Soft Delete** — items bị xóa chuyển vào trash
- **Restore** — khôi phục items từ trash
- **Permanent Delete** — xóa vĩnh viễn

### Hooks
- `use-trash` — list + restore + delete

---

## 10. Shared Components

| Component | Mục đích |
|-----------|----------|
| `AppLayout` | Layout chính với sidebar + topbar |
| `DataTable` | Table component tái sử dụng (TanStack Table) |
| `Modal`, `ConfirmDialog` | Dialog/modal patterns |
| `SearchInput` | Search debounced |
| `Pagination` | Phân trang |
| `StatusBadge` | Badge trạng thái với màu |
| `DateRangePicker` | Chọn khoảng ngày |
| `FileUpload` | Upload ảnh/file |
| `ExportButton` | Export Excel |
| `EmptyState`, `LoadingState` | State placeholders |
| `Toaster` | Notification toast (Sonner) |
| `CommandPalette` | Keyboard shortcuts (Ctrl+K) |

---

*Cập nhật: 2026-03-14*
