# Premium Admin Web Onboarding

This guide is generated from the project knowledge graph and is meant to help a new contributor understand the repo quickly.

## Project Overview

- **Name:** `premium-admin-web`
- **Purpose:** Multi-tenant admin system for managing premium accounts, orders, inventory, customers, payments, escalations, and automation.
- **Stack:** Next.js 16, React 19, Supabase/PostgreSQL, Tailwind CSS, Vercel
- **Primary runtime shape:** App Router frontend backed by service/repository layers and Supabase RPC

## Architecture Layers

### 1. Presentation

Responsible for pages, layouts, and shared providers.

Key files:
- [`src/app/layout.tsx`](../src/app/layout.tsx)
- [`src/app/page.tsx`](../src/app/page.tsx)
- [`src/app/dashboard/page.tsx`](../src/app/dashboard/page.tsx)
- [`src/app/orders/page.tsx`](../src/app/orders/page.tsx)
- [`src/app/customers/page.tsx`](../src/app/customers/page.tsx)
- [`src/app/inventory/page.tsx`](../src/app/inventory/page.tsx)
- [`src/app/calendar/page.tsx`](../src/app/calendar/page.tsx)
- [`src/app/settings/page.tsx`](../src/app/settings/page.tsx)
- [`src/shared/providers/conditional-providers.tsx`](../src/shared/providers/conditional-providers.tsx)

What to notice:
- The root page redirects to the dashboard.
- The layout defines the global shell, metadata, theme, and provider composition.
- Domain pages are grouped by operational area rather than by technical component type.

### 2. Routing & Security

Responsible for request interception, auth gating, bot blocking, and startup hooks.

Key files:
- [`src/proxy.ts`](../src/proxy.ts)
- [`src/instrumentation.ts`](../src/instrumentation.ts)

What to notice:
- `proxy.ts` is not a simple middleware file; it is a major security boundary.
- It handles public route allowlisting, short-link logic, scanner blocking, and Supabase-backed checks.
- `instrumentation.ts` auto-registers the Telegram webhook on server start.

### 3. Service Layer

Responsible for business orchestration and operational workflows.

Key files:
- [`src/lib/services/order.service.ts`](../src/lib/services/order.service.ts)
- [`src/lib/services/allocation.service.ts`](../src/lib/services/allocation.service.ts)
- [`src/lib/services/auth.ts`](../src/lib/services/auth.ts)
- [`src/lib/services/escalation.service.ts`](../src/lib/services/escalation.service.ts)
- [`src/lib/services/telegram-bot.service.ts`](../src/lib/services/telegram-bot.service.ts)
- [`src/lib/services/telegram-auto-setup.ts`](../src/lib/services/telegram-auto-setup.ts)

What to notice:
- Orders and inventory allocation are core workflows.
- Auth is custom, not Supabase Auth.
- Telegram is part of the operational control plane, not a side feature.

### 4. Domain & Data Access

Responsible for domain scoring, repositories, and database access.

Key files:
- [`src/lib/domain/allocation-engine.ts`](../src/lib/domain/allocation-engine.ts)
- [`src/lib/supabase/middleware.ts`](../src/lib/supabase/middleware.ts)
- [`src/lib/supabase/admin.ts`](../src/lib/supabase/admin.ts)
- [`src/lib/supabase/repositories/orders.repo.ts`](../src/lib/supabase/repositories/orders.repo.ts)
- [`src/lib/supabase/repositories/source-accounts.repo.ts`](../src/lib/supabase/repositories/source-accounts.repo.ts)
- [`supabase/`](../supabase)

What to notice:
- The repo uses a repository pattern over Supabase.
- Atomic behavior is pushed into RPC functions where needed.
- The allocation engine drives how source accounts are chosen.

### 5. Infrastructure

Responsible for deployment settings and platform configuration.

Key files:
- [`vercel.json`](../vercel.json)

What to notice:
- Vercel is part of the runtime model, not just the hosting choice.
- Cron and route behavior matter for how the app operates in production.

### 6. Documentation

Responsible for the canonical system explanations.

Key files:
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
- [`docs/DATABASE.md`](DATABASE.md)

What to notice:
- These docs are authoritative for layer boundaries and schema shape.
- Read them before changing core workflows.

## Guided Tour

### Step 1: Read the architecture docs

Start with:
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
- [`docs/DATABASE.md`](DATABASE.md)

This gives you the mental model for layers, data flow, and core entities.

### Step 2: Enter through the app shell

Read:
- [`src/app/page.tsx`](../src/app/page.tsx)
- [`src/app/layout.tsx`](../src/app/layout.tsx)

You will see that the app redirects into the dashboard and the layout defines the shared environment.

### Step 3: Understand routing and security

Read:
- [`src/proxy.ts`](../src/proxy.ts)
- [`src/instrumentation.ts`](../src/instrumentation.ts)

This is where public routes, auth boundaries, bot detection, and webhook bootstrapping happen.

### Step 4: Follow the business workflow

Read:
- [`src/lib/services/order.service.ts`](../src/lib/services/order.service.ts)
- [`src/lib/services/allocation.service.ts`](../src/lib/services/allocation.service.ts)
- [`src/lib/domain/allocation-engine.ts`](../src/lib/domain/allocation-engine.ts)

This is the core order fulfillment and inventory allocation path.

### Step 5: Trace automation and support operations

Read:
- [`src/lib/services/auth.ts`](../src/lib/services/auth.ts)
- [`src/lib/services/escalation.service.ts`](../src/lib/services/escalation.service.ts)
- [`src/lib/services/telegram-bot.service.ts`](../src/lib/services/telegram-bot.service.ts)
- [`src/lib/services/telegram-auto-setup.ts`](../src/lib/services/telegram-auto-setup.ts)

This is the operational layer that keeps the business running day to day.

## File Map

### High-Value Entry Files

- [`src/app/dashboard/page.tsx`](../src/app/dashboard/page.tsx): operational overview and KPIs
- [`src/app/orders/page.tsx`](../src/app/orders/page.tsx): order lifecycle workspace
- [`src/app/inventory/page.tsx`](../src/app/inventory/page.tsx): source accounts and allocation control
- [`src/app/customers/page.tsx`](../src/app/customers/page.tsx): CRM and customer segmentation
- [`src/app/calendar/page.tsx`](../src/app/calendar/page.tsx): reminders and scheduling
- [`src/app/settings/page.tsx`](../src/app/settings/page.tsx): system configuration

### Core Business Services

- [`src/lib/services/order.service.ts`](../src/lib/services/order.service.ts): atomic order orchestration
- [`src/lib/services/allocation.service.ts`](../src/lib/services/allocation.service.ts): slot/key allocation planning
- [`src/lib/services/auth.ts`](../src/lib/services/auth.ts): custom authentication flow
- [`src/lib/services/escalation.service.ts`](../src/lib/services/escalation.service.ts): overdue order automation
- [`src/lib/services/telegram-bot.service.ts`](../src/lib/services/telegram-bot.service.ts): Telegram command handling

### Core Data Access

- [`src/lib/supabase/admin.ts`](../src/lib/supabase/admin.ts): privileged Supabase client
- [`src/lib/supabase/middleware.ts`](../src/lib/supabase/middleware.ts): session handling
- [`src/lib/supabase/repositories/orders.repo.ts`](../src/lib/supabase/repositories/orders.repo.ts): order persistence
- [`src/lib/supabase/repositories/source-accounts.repo.ts`](../src/lib/supabase/repositories/source-accounts.repo.ts): inventory persistence

### Core Infrastructure

- [`src/proxy.ts`](../src/proxy.ts): request gate and route policy
- [`src/instrumentation.ts`](../src/instrumentation.ts): startup side effects
- [`vercel.json`](../vercel.json): deployment and cron config

## Complexity Hotspots

Approach these carefully:

- [`src/proxy.ts`](../src/proxy.ts): complex security and route behavior
- [`src/lib/services/order.service.ts`](../src/lib/services/order.service.ts): transactional business orchestration
- [`src/lib/services/allocation.service.ts`](../src/lib/services/allocation.service.ts): allocation logic and RPC-safe planning
- [`src/lib/services/telegram-bot.service.ts`](../src/lib/services/telegram-bot.service.ts): large command handler with state and security checks
- [`src/lib/services/auth.ts`](../src/lib/services/auth.ts): schema compatibility and custom auth

## Mental Model

Think of the system as:

1. A Next.js admin shell that routes users into the dashboard.
2. A security and routing layer that decides what traffic is allowed and how special routes behave.
3. A service layer that performs business workflows.
4. A domain/data layer that stores, scores, and retrieves business entities.
5. External automation channels, especially Telegram and cron jobs, that keep operations moving.

## What To Read First

If you are new to the repo, read in this order:

1. [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
2. [`docs/DATABASE.md`](DATABASE.md)
3. [`src/proxy.ts`](../src/proxy.ts)
4. [`src/lib/services/order.service.ts`](../src/lib/services/order.service.ts)
5. [`src/lib/services/allocation.service.ts`](../src/lib/services/allocation.service.ts)
6. [`src/lib/services/telegram-bot.service.ts`](../src/lib/services/telegram-bot.service.ts)

## Practical Editing Rules

- Change business behavior in services first, not in pages.
- Change data shape in repositories/migrations before wiring UI around it.
- Treat `proxy.ts` as a security-sensitive file.
- Keep Telegram and cron side effects idempotent.
- Prefer the documented schema and RPCs over ad hoc queries.
