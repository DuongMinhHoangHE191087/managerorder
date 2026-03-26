# Progress — ManagerOrder (Premium Admin Web)

> Cập nhật: 2026-03-14

## 1. Tính năng đã hoàn thành ✅

### Core (Fully Implemented)
- [x] Order CRUD (create, read, update, delete) + state machine
- [x] Order items với price snapshot + multi-product support
- [x] Customer CRUD + RFM segmentation + debt tracking
- [x] Product/Service management (slot/key/hybrid modes)
- [x] Inventory management (source accounts + license keys)
- [x] Auto-allocation engine (smart matching + atomic RPC)
- [x] Payment tracking (multiple payments, partial payment)
- [x] Refund processing (pro_rata + full modes)
- [x] Invoice generation (PDF with company snapshot)
- [x] Import/Export (Excel + CSV) cho orders và customers

### Premium Module
- [x] Premium service types + packages management
- [x] Premium account management (slots, subscription lifecycle)
- [x] Premium account users management
- [x] Customer premium subscriptions
- [x] Subscription renewals + migrations

### Infrastructure
- [x] Custom JWT authentication (register, login, refresh, Google OAuth)
- [x] RBAC (5 roles: admin_owner, sales_staff, inventory_staff, customer_support, accountant)
- [x] Multi-tenant architecture (account_id isolation)
- [x] Webhook event system (HMAC-SHA256, retry queue, SSRF protection)
- [x] Activity logging (audit trail)
- [x] DB caching layer (cache invalidation)
- [x] Calendar system + Google Calendar integration
- [x] Telegram notifications (reminder cron)
- [x] Dashboard with KPIs + charts (Recharts)

### Cron Jobs (6 scheduled)
- [x] Auto-escalation (debt policy)
- [x] Order expiry reminder
- [x] Revenue report
- [x] RFM calculation
- [x] Telegram reminder
- [x] Webhook retry

### Testing (1439 tests)
- [x] Order service logic tests
- [x] Allocation service tests
- [x] Auth service tests
- [x] Excel service tests
- [x] Import service logic tests
- [x] Inventory race condition tests
- [x] Inventory DB rollback tests
- [x] RFM calculator tests (comprehensive)
- [x] Smart matching tests
- [x] Query keys tests

## 2. Metrics

| Metric | Giá trị |
|--------|---------|
| API Routes | 101 |
| React Components | 91 |
| Custom Hooks | 31 |
| Services | 9 |
| Test Cases | 1,439 (2 skipped) |
| TypeScript Errors | 0 |
| Pages Generated | 63 |

## 3. Tính năng chưa triển khai / Cần cải thiện

- [ ] E2E tests (Playwright configured but minimal)
- [ ] RLS policies cho Supabase tables (security advisor)
- [ ] Push notifications (ngoài Telegram)
- [ ] Real-time updates (Supabase Realtime subscriptions)
- [ ] Mobile responsive optimization (some pages)
- [ ] Internationalization (i18n) — hiện tại chỉ Vietnamese
- [ ] Rate limiting cho API routes
- [ ] API documentation (OpenAPI/Swagger)
