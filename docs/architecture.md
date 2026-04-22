# Architecture

## Canonical Topology

```text
route handlers
  -> domains / services / use-cases
    -> repositories / adapters
      -> infrastructure / shared utilities
```

Applied to this repository:

- `apps/admin-web/src/app`
  - App Router pages and API route handlers
- `apps/admin-web/src/lib`
  - domain rules, services, API wrappers, integrations, repos, and infra helpers
- `apps/admin-web/src/widgets`
  - page composition and UI behavior
- `packages/zalo-bot-js`
  - internal bot runtime package, consumed as a workspace package
- `tooling`
  - shared ESLint and Vitest configuration for the monorepo

## Tenant Safety

- Default reads and writes should flow through tenant-aware query helpers.
- `supabaseAdmin` is reserved for explicitly allowlisted system paths and cross-tenant operational reads.
- Route handlers that still need `supabaseAdmin` must stay narrow, documented, and covered by RBAC plus runtime gates when exposed over HTTP.

## Runtime And Operations

Sensitive runtime routes follow this policy:

- authenticate tenant context first
- authorize with RBAC next
- require explicit feature flags for deprecated or break-glass routes
- require shared bearer secret policy for internal operational triggers

Current examples:

- `/api/telegram/setup`
  - authenticated route
  - `settings:read` for diagnostics
  - `settings:write` for webhook registration and forced reconfiguration
- `/api/telegram/webhook`
  - POST remains Telegram-secret protected webhook ingress
  - GET diagnostics require authenticated `settings:read`
- `/api/migrate`
  - deprecated runtime alias only
  - hidden by default behind `ENABLE_DEPRECATED_MIGRATE_ROUTE=1`
  - still requires authenticated `admin_owner` plus `CRON_SECRET`

## Quality Gates

Root commands are the only supported release gates:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm audit:prod
```

The app build must keep TypeScript validation enabled. Runtime-specific bypasses such as `typescript.ignoreBuildErrors` are not allowed.

## Migration Order

When changing architecture or repo structure:

1. move topology first
2. keep one canonical source tree
3. re-run root quality gates
4. harden operational routes
5. update docs to match the code that actually ships
