# ManagerOrder — Premium Admin Web

> **SaaS B2B Admin Panel** quản lý đơn hàng, kho, khách hàng, dịch vụ premium, lịch, và báo cáo doanh thu.

---

## 📋 Mục lục

- [Tổng quan](#-tổng-quan)
- [Tech Stack](#-tech-stack)
- [Cài đặt](#-cài-đặt)
- [Chạy Development](#-chạy-development)
- [Testing](#-testing)
- [Build & Deploy](#-build--deploy)
- [Cấu trúc dự án](#-cấu-trúc-dự-án)
- [Tài liệu liên quan](#-tài-liệu-liên-quan)

---

## 🎯 Tổng quan

**ManagerOrder** giải quyết các bài toán quản lý nghiệp vụ cho doanh nghiệp nhỏ/vừa kinh doanh dịch vụ premium:

| Module | Mô tả |
|--------|--------|
| **Orders** | Tạo, duyệt, cấp phát, gia hạn, hoàn tiền — FSM trạng thái nghiêm ngặt |
| **Inventory** | Quản lý tài khoản nguồn (slot-based), license key, cấp phát tự động |
| **Customers** | RFM segmentation, quản lý nợ, tags & groups |
| **Payments** | Thanh toán từng phần, lịch sử, hóa đơn PDF |
| **Premium** | Quản lý tài khoản chia sẻ, gói, subscription lifecycle |
| **Calendar** | Sự kiện, nhắc nhở gia hạn, notes, Google Calendar sync |
| **Dashboard** | KPI, biểu đồ, báo cáo lợi nhuận |
| **Cron Jobs** | Telegram reminder, order expiry, revenue report, auto-escalation, RFM, webhook retry |

### Vai trò người dùng (RBAC)

| Role | Quyền |
|------|-------|
| `admin_owner` | Toàn quyền |
| `sales_staff` | Tạo đơn, quản lý khách |
| `inventory_staff` | Quản lý kho, cấp phát |
| `customer_support` | Hỗ trợ KH, xử lý hoàn tiền |
| `accountant` | Thanh toán, báo cáo tài chính |

---

## 🛠 Tech Stack

| Layer | Tech | Version |
|-------|------|---------|
| **Framework** | Next.js (App Router) | 16.x |
| **UI** | React | 19 |
| **Language** | TypeScript | 5 |
| **Database** | Supabase (PostgreSQL) | supabase-js 2.x |
| **Styling** | Tailwind CSS | 3.x |
| **State** | TanStack React Query + Zustand | 5.x / 5.x |
| **Forms** | React Hook Form + Zod | 7.x / 4.x |
| **Charts** | Recharts | 3.x |
| **Auth** | Custom JWT (bcryptjs + jsonwebtoken) | — |
| **Testing** | Vitest + Playwright | 4.x / 1.x |
| **Icons** | Lucide React | 0.5x |
| **Animations** | Framer Motion | 12.x |

---

## 📦 Cài đặt

### Yêu cầu

- **Node.js** ≥ 20
- **npm** ≥ 10
- **Supabase project** (PostgreSQL, Auth, Storage)

### Bước cài đặt

```bash
# Clone repo
git clone <repo-url>
cd premium-admin-web

# Install dependencies
npm install

# Copy env example
cp .env.example .env.local
```

### Environment Variables

```env
# Supabase (bắt buộc)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Auth - Custom JWT (bắt buộc)
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Google OAuth (tùy chọn)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Google Calendar API (tùy chọn)
GOOGLE_CALENDAR_API_KEY=

# Telegram Bot (tùy chọn)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Cron Jobs (tùy chọn)
CRON_SECRET=your-cron-secret
```

---

## 🚀 Chạy Development

```bash
# Dev server (Turbopack)
npm run dev
# → http://localhost:3000

# Lint
npm run lint
```

---

## 🧪 Testing

```bash
# Unit/Integration tests (Vitest)
npm test              # 1439+ tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report

# E2E tests (Playwright)
npx playwright test
npx playwright test --ui  # Interactive mode
```

### E2E Setup

E2E tests cần biến môi trường riêng:

```env
SUPABASE_TEST_EMAIL=test@example.com
SUPABASE_TEST_PASSWORD=password123
BASE_URL=http://localhost:3000
```

---

## 🏗 Build & Deploy

```bash
# Build production
npm run build
# → 63 pages generated

# Start production
npm start
```

### Deploy Vercel

Chi tiết xem [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 📁 Cấu trúc dự án

```
premium-admin-web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # 101 API routes (21 resource groups)
│   │   │   ├── orders/        # CRUD + stats + batch + export
│   │   │   ├── customers/     # CRUD + stats + RFM + debt
│   │   │   ├── inventory/     # CRUD + allocate + dashboard
│   │   │   ├── premium/       # Services + packages + accounts
│   │   │   ├── calendar/      # Events + notes
│   │   │   ├── dashboard/     # Stats API
│   │   │   ├── cron/          # 6 scheduled jobs
│   │   │   └── webhooks/      # Webhook system
│   │   ├── orders/            # Order pages
│   │   ├── customers/         # Customer pages
│   │   ├── inventory/         # Inventory pages
│   │   ├── calendar/          # Calendar page
│   │   ├── settings/          # Settings pages
│   │   └── premium/           # Premium pages
│   ├── components/            # 91 UI components
│   │   ├── shared/            # Shared components
│   │   ├── ui/                # Base UI primitives
│   │   └── [module]/          # Module-specific components
│   └── lib/
│       ├── domain/            # Types, schemas, FSM
│       ├── services/          # 9 business logic services
│       ├── hooks/             # 31 React Query hooks
│       ├── supabase/          # DB client, repos, mappers
│       ├── cache/             # Caching layer
│       ├── utils/             # Utilities (telegram, jwt, crypto)
│       └── store/             # Zustand stores
├── docs/                      # Tài liệu (bạn đang ở đây!)
├── e2e/                       # E2E tests (Playwright)
├── public/                    # Static assets + OpenAPI spec
└── memory/                    # Project memory bank
```

---

## 📚 Tài liệu liên quan

| File | Nội dung |
|------|----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Kiến trúc tổng thể, layer, patterns |
| [DATABASE.md](./DATABASE.md) | Schema, RPC functions, indexes |
| [API-GUIDE.md](./API-GUIDE.md) | 101 API endpoints guide |
| [MODULES.md](./MODULES.md) | Chi tiết module nghiệp vụ |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deploy Vercel, env vars, cron |
| [TELEGRAM.md](./TELEGRAM.md) | Telegram notifications + đề xuất nâng cấp |

---

*Cập nhật: 2026-03-14*
