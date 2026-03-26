# Tech Context — ManagerOrder (Premium Admin Web)

> Cập nhật: 2026-03-14

## 1. Tech Stack

### Core Framework
| Tech | Version | Mục đích |
|------|---------|----------|
| **Next.js** | 15.3.1 | Full-stack React framework (App Router) |
| **React** | 19 (canary) | UI library |
| **TypeScript** | ^5 | Type safety |

### Backend & Database
| Tech | Version | Mục đích |
|------|---------|----------|
| **Supabase** (PostgreSQL) | @supabase/supabase-js 2.49.4 | Database + Auth + Storage |
| **@supabase/ssr** | 0.6.1 | Server-side Supabase client |
| **Zod** | 3.24.2 | Input validation schemas |
| **jsonwebtoken** | 9.0.2 | Custom JWT auth (NOT Supabase Auth) |
| **bcryptjs** | 3.0.2 | Password hashing |
| **uuid** | 11.1.0 | ID generation |

### UI Libraries
| Tech | Version | Mục đích |
|------|---------|----------|
| **Tailwind CSS** | 4.1.1 | Styling |
| **Radix UI** | (multiple) | Headless UI primitives |
| **Lucide React** | 0.484.0 | Icon library |
| **Recharts** | 2.15.3 | Chart/Graph library |
| **Sonner** | 1.7.4 | Toast notifications |
| **date-fns** | 4.1.0 | Date manipulation |
| **clsx** + **tailwind-merge** | - | Class name utilities |
| **@dnd-kit** | - | Drag-and-drop |
| **cmdk** | 1.1.1 | Command palette |

### State Management
| Tech | Mục đích |
|------|----------|
| **TanStack React Query** | 5.74.4 | Server state management (hooks) |
| **Zustand** | - | Client state management (stores) |
| **React Hook Form** | 7.55.0 | Form state management |

### Testing
| Tech | Version | Mục đích |
|------|---------|----------|
| **Vitest** | 3.1.1 | Unit/Integration tests (1439 tests) |
| **Playwright** | - | E2E tests (configured) |
| **@testing-library/react** | 16.3.0 | Component testing utilities |

### Data Processing
| Tech | Version | Mục đích |
|------|---------|----------|
| **xlsx** | 0.18.5 | Excel import/export |
| **jspdf** + **jspdf-autotable** | - | PDF generation (invoices) |
| **papaparse** | 5.5.2 | CSV parsing |
| **html2canvas** | 1.4.1 | Screenshot capture |

## 2. Cấu hình quan trọng

### TypeScript (tsconfig.json)
- **Target**: ES2017
- **Module**: ESNext (bundler resolution)
- **Path aliases**: `@/*` → `./src/*`
- **Strict mode**: Enabled
- **Plugins**: next (experimental App Router support)

### Next.js (next.config.ts)
- **Performance**: `optimizePackageImports` cho lucide-react, date-fns, recharts, @radix-ui/*
- **modularizeImports**: date-fns tree-shaking
- **skipTrailingSlashRedirect**: true (API compatibility)

### Package Scripts
```json
{
  "dev": "next dev --turbopack",
  "build": "next build",
  "test": "vitest run",
  "lint": "next lint"
}
```

## 3. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth (Custom JWT)
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Google Calendar API
GOOGLE_CALENDAR_API_KEY=

# Telegram Bot
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

## 4. Database (Supabase PostgreSQL)

### Tables chính (20+ tables)
- `accounts`, `admin_users` — Multi-tenant + RBAC
- `orders`, `order_items` — Đơn hàng + line items
- `customers`, `customer_tags`, `customer_groups` — Khách hàng
- `products` — Sản phẩm/dịch vụ
- `source_accounts` — Kho tài khoản (slots)
- `license_keys` — License keys
- `payment_sources`, `sales_channels` — Cấu hình
- `calendar_events`, `calendar_notes` — Lịch
- `activity_logs` — Audit trail
- `webhook_endpoints`, `webhook_events` — Webhook system
- `system_settings` — Cấu hình hệ thống
- `premium_*` — Premium service tables (6 tables)

### Key RPC Functions
- `create_order_with_items(p_order, p_items)` — Atomic order creation
- `confirm_allocation_atomic(p_order_id, p_account_id, p_allocations)` — Atomic slot/key allocation
- `deallocate_order_atomic(p_order_id, p_account_id)` — Batch deallocation
- `increment_source_account_slots(p_account_id, p_source_id, p_quantity)` — Atomic slot increment

## 5. Build & Test Status

- **TypeScript**: `tsc --noEmit` — ✅ 0 errors
- **Build**: `npm run build` — ✅ 63 pages generated
- **Tests**: `vitest run` — ✅ 1439 tests passed (2 skipped — mock config issue)
- **Lint**: `next lint` — ⚠️ Pre-existing warnings (non-blocking)
