# System Patterns — ManagerOrder (Premium Admin Web)

> Cập nhật: 2026-03-14

## 1. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────┐
│                Next.js App Router                │
│  (Pages + API Routes + Server Components)        │
├──────────────┬──────────────┬────────────────────┤
│   UI Layer   │  API Layer   │   Cron Jobs        │
│ (Components) │ (Route.ts)   │ (api/cron/*)       │
│  + Hooks     │              │                    │
├──────────────┴──────────────┴────────────────────┤
│              Service Layer                        │
│  (order.service, allocation.service, auth, etc.)  │
├──────────────────────────────────────────────────┤
│           Domain Layer (types, schemas, FSM)      │
├──────────────────────────────────────────────────┤
│         Repository Layer (*.repo.ts)              │
│         + Mapper Layer (*.mapper.ts)              │
├──────────────────────────────────────────────────┤
│    Supabase (PostgreSQL + Auth + Storage)         │
│    + RPC Functions (atomic transactions)          │
└──────────────────────────────────────────────────┘
```

## 2. Design Patterns đang dùng

### 2.1 Repository Pattern
- **Location**: `src/lib/supabase/repositories/*.repo.ts`
- **Mô tả**: Mỗi entity có file repo riêng (orders.repo, customers.repo, source-accounts.repo, etc.)
- **Convention**: Hàm nhận `accountId` để multi-tenant isolation

### 2.2 Mapper Pattern
- **Location**: `src/lib/supabase/mappers/*.mapper.ts`
- **Mô tả**: Chuyển đổi giữa DB Row types ↔ Domain types
- **Convention**: `mapXxxRow(row) → DomainType` và `mapXxxToDB(domain) → DbRow`

### 2.3 Service Layer (Business Logic)
- **Location**: `src/lib/services/*.service.ts`
- **Key Services**:
  - `order.service.ts`: Tạo đơn atomic (validate → build items → RPC persist → slot update → nicks sync → activity log → emit event)
  - `allocation.service.ts`: Cấp phát inventory (suggestion → confirm via atomic RPC → fallback)
  - `auth.ts`: Custom JWT auth (register, login, refresh) — NOT Supabase Auth
  - `event-bus.service.ts`: Webhook system (emit → deliver → retry queue)
  - `smart-matching.service.ts`: Nick matching cho inventory
  - `rfm-calculator.ts`: RFM segmentation tính toán
  - `escalation.service.ts`: Auto-escalation cho nợ
  - `import.service.ts` + `excel-service.ts`: Import/Export Excel

### 2.4 Custom Hooks (React Query)
- **Location**: `src/lib/hooks/use-*.ts`
- **Pattern**: TanStack React Query (useQuery + useMutation)
- **Central query keys**: `query-keys.ts` — unique cache keys cho mỗi entity
- **Convention**: `useXxx()` returns `{ data, isLoading, error, mutate* }`

### 2.5 API Route Handlers
- **Location**: `src/app/api/***/route.ts`
- **Pattern**: Next.js Route Handlers (GET, POST, PUT, PATCH, DELETE)
- **Auth**: JWT verify qua utility, extract accountId từ token
- **101 routes** covering all CRUD + special operations

### 2.6 Atomic Transactions (PostgreSQL RPC)
- **Key RPCs**:
  - `create_order_with_items`: Atomic order + items insertion
  - `confirm_allocation_atomic`: Lock + allocate slots + keys
  - `deallocate_order_atomic`: Batch release slots + keys
  - `increment_source_account_slots`: Atomic slot increment
  - `allocate_license_keys`: Atomic key allocation

### 2.7 Event-Driven Architecture
- **Event Bus**: `event-bus.service.ts`
- **Events**: order.created, order.status_changed, payment.received, subscription.expired, refund.completed
- **Delivery**: HMAC-SHA256 signed, 10s timeout, exponential backoff retry (1min → 5min → 30min)
- **SSRF Protection**: Block internal IPs, HTTPS-only

### 2.8 Caching Layer
- **Location**: `src/lib/cache/db-cache.ts`
- **Pattern**: Cache key invalidation sau mỗi write operation
- **Usage**: `invalidate('orders:list:${accountId}')`

### 2.9 Order State Machine (FSM)
- **Location**: `src/lib/domain/order-state-machine.ts`
- **Transitions**:
  ```
  draft → pending_payment, refunded
  pending_payment → paid, refunded
  paid → provisioning, refunded
  provisioning → active, refunded
  active → expired, refunded
  expired → active, refunded
  refunded → (terminal)
  ```

## 3. Cấu trúc thư mục

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # 101 API routes
│   │   ├── orders/        # CRUD + stats + batch + export/import
│   │   ├── customers/     # CRUD + stats + batch + RFM + debt
│   │   ├── inventory/     # CRUD + allocate + dashboard + profit
│   │   ├── premium/       # Accounts + users + packages + services
│   │   ├── calendar/      # Events + notes
│   │   ├── dashboard/     # Stats
│   │   ├── cron/          # Scheduled jobs (6 cron routes)
│   │   └── auth/          # Login/Register + Google OAuth
│   ├── orders/            # Order pages
│   ├── customers/         # Customer pages
│   ├── inventory/         # Inventory pages
│   ├── calendar/          # Calendar page
│   ├── settings/          # Settings pages
│   └── premium/           # Premium management pages
├── components/            # 91 UI components by feature
│   ├── calendar/          # 5 components
│   ├── customers/         # 13 components
│   ├── inventory/         # 12 components
│   ├── orders/            # 20 components
│   ├── premium/           # 12 components
│   ├── settings/          # 10 components
│   ├── shared/            # 12 shared components
│   └── ui/                # 7 base UI components
├── lib/
│   ├── domain/            # Types, schemas, FSM, allocation engine
│   ├── services/          # Business logic (9 services + 10 tests)
│   ├── supabase/          # DB client, repos, mappers, admin
│   ├── hooks/             # 31 React Query hooks
│   ├── cache/             # DB caching layer
│   ├── types/             # Auth types, shared types
│   ├── utils/             # Crypto, JWT, errors, formatters
│   └── stores/            # Zustand stores
└── middleware.ts           # (in lib/supabase/middleware.ts)
```

## 4. Multi-Tenant Architecture

- Mọi query đều filter theo `account_id`
- JWT token chứa `accountId`, `role`, `email`
- API routes extract `accountId` từ JWT trước mỗi operation
- Supabase Admin client dùng service role key cho server-side operations

## 5. Stabilization patterns added on 2026-04-10

### 5.1 Client/server import boundary
- Client modules must never import modules that use:
  - `import "server-only"`
  - secret `process.env.*`
  - `supabaseAdmin` or server-side auth helpers
- Pure calculations that are needed in both server and client must live in a domain-safe module, not next to repository or admin access code.
- First concrete split:
  - Pure premium math now lives in `src/lib/domain/premium-account-math.ts`
  - Server-only premium helper logic stays in `src/lib/utils/premium-accounts-helpers.ts`

### 5.2 API envelope contract
- Frontend-consumed responses should converge on:
  - success: `{ data, meta? }`
  - error: `{ error, code?, details? }`
- Client readers should normalize both legacy nested errors and the new flat error shape during migration.
- Routes should avoid leaking raw stack traces or env-related crashes to the UI.

### 5.3 Design token contract
- Components may only use CSS variables defined in `src/app/globals.css` or allowed vendor prefixes such as `--radix-*`.
- New tokens must be added centrally before component adoption.
- Compatibility aliases are allowed as a short-term bridge, but the desired end state is one canonical token set.

### 5.4 Runtime split for bots
- Vercel is the primary production runtime.
- Web routes and bot event entrypoints should prefer webhook or event-based execution.
- Telegram and Zalo polling scripts are fallback paths for local development or non-Vercel hosting only.

### 5.5 Agent guardrails
- Read `memory/memory-conventions.md` first.
- Wake up MemPalace and search existing facts before deep repo reads.
- Prefer targeted inspection plus memory recall over re-reading the whole repository.
- Run repo quality guards before typecheck, test, or build so boundary and token drift errors fail early.
