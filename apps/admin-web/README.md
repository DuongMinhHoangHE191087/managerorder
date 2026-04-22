# Premium Accounts Management System

**Version:** 3.0  
**Date:** 2026-03-10  
**Status:** Production-Ready  
**Database:** Supabase PostgreSQL (28 tables)

---

## 🚀 Quick Start

```bash
# 1. Clone & install
git clone <repo-url>
cd premium-admin-web
npm install

# 2. Configure environment
cp .env.local.example .env.local
# Fill in Supabase URL, keys, etc.

# 3. Start development
npm run dev
# → http://localhost:3000
```

---

## 🎯 System Overview

**Premium Accounts Management** — Hệ thống quản lý và bán tài khoản Premium dùng chung (Family Sharing):
- ChatGPT Plus/Team · Duolingo Super · Netflix Premium · YouTube Premium Family · Spotify Family · ...

### Business Model

```
Seller mua 1 account Premium (5 slots) → Bán cho 5 khách hàng
→ Quản lý: renewal, refund, migration, warranty tracking
→ Scale: 1000+ accounts trong kho
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **UI** | React 19 + TailwindCSS 3 |
| **State** | TanStack React Query 5 + Zustand 5 |
| **Forms** | React Hook Form 7 + Zod 4 |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Google OAuth via Supabase |
| **Hosting** | Vercel |
| **Animations** | Framer Motion 12 |
| **Charts** | Recharts 3 |

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[API_REFERENCE.md](docs/API_REFERENCE.md)** | 📡 63 API endpoints — 15 domain groups |
| **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** | 🏗️ System architecture, data flow, auth flow |
| **[COMPONENTS.md](docs/COMPONENTS.md)** | 🧩 33 shared + domain components, 13 hooks |
| **[DATABASE.md](docs/DATABASE.md)** | 🗄️ 28 tables, functions, indexes, RLS |
| **[QUICK_START.md](docs/QUICK_START.md)** | 🚀 Setup guide step-by-step |

### Business & Design Docs

| Folder | Content |
|--------|---------|
| `docs/01-requirements/` | Business requirements & user stories |
| `docs/02-architecture/` | System design & critical rules |
| `docs/03-database/` | Schema SQL & setup guide |
| `docs/04-implementation/` | Implementation plan |
| `docs/05-verification/` | Testing & validation plan |
| `docs/06-reference/` | Quick reference |

---

## 📁 Project Structure

```
premium-admin-web/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── api/              #   63 API routes (15 domains)
│   │   ├── dashboard/        #   Dashboard (KPIs, charts)
│   │   ├── orders/           #   Order management
│   │   ├── customers/        #   Customer CRM
│   │   ├── inventory/        #   Inventory management
│   │   ├── calendar/         #   Calendar + GCal sync
│   │   └── settings/         #   System settings
│   ├── components/           # UI Components (33 shared + domain)
│   ├── lib/
│   │   ├── domain/           #   Types, schemas, business rules
│   │   ├── hooks/            #   13 React Query hooks
│   │   ├── services/         #   4 business services
│   │   ├── supabase/         #   DB client + 10 repositories
│   │   └── utils/            #   Utilities
│   └── middleware.ts         # Auth middleware
├── supabase/                 # Database migrations (14 files)
├── docs/                     # Documentation
└── vercel.json               # Deployment + cron config
```

---

## 📋 Key Features

### Core Business
✅ Multi-product order management · ✅ Flexible slot/key/hybrid products  
✅ Smart inventory allocation · ✅ Customer CRM with contact registry  
✅ Payment tracking & reconciliation · ✅ Invoice generation  
✅ Excel bulk import · ✅ Prorated refund calculation

### Integrations
✅ Google Calendar sync · ✅ Telegram daily reminders  
✅ Duolingo ID auto-fetch · ✅ Facebook ID auto-resolve  
✅ Cloudinary image upload

### Technical
✅ Google OAuth + admin whitelist · ✅ Complete audit trail  
✅ Zod validation on all endpoints · ✅ React Query caching  
✅ Command palette (Cmd+K) · ✅ Responsive design

---

## 🔐 Security

- Google OAuth authentication
- Admin whitelist via `admin_users` table
- Row Level Security (RLS)
- Zod input validation on all endpoints
- Password hashing (bcryptjs)
- No hardcoded secrets (`.env.local`)

---

## 📜 Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production
npm run lint         # ESLint check
npm run test         # Run tests (Vitest)
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

`npm run dev`, `npm run start`, and Docker now auto-run both Telegram and Zalo polling bots when the required env vars are present.

---

## 🔧 Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth
NEXTAUTH_SECRET=

# Google Calendar
GOOGLE_CALENDAR_ID=
GOOGLE_SERVICE_ACCOUNT_KEY=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Zalo
ZALO_BOT_TOKEN=
ZALO_BOT_ACCOUNT_ID=
ADMIN_ZALO_USER_IDS=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

# Cron
CRON_SECRET=
```

---

**Last Updated:** 2026-03-10 · **Powered by Antigravity** 🚀
