# ManagerOrder Monorepo

ManagerOrder is now a `pnpm` + `turbo` monorepo with one canonical app workspace and one internal bot package.

## Workspace Layout

```text
.
|-- apps/
|   `-- admin-web/
|-- packages/
|   `-- zalo-bot-js/
|-- scripts/
|-- tooling/
|-- package.json
|-- pnpm-workspace.yaml
`-- turbo.json
```

## Source Of Truth

- `apps/admin-web` is the only canonical admin application.
- `packages/zalo-bot-js` is the only canonical Zalo bot package.
- The old root `src/` tree and nested `premium-admin-web` repo are no longer the source of truth.
- Development, lint, typecheck, test, and build all run from the repository root.

## Prerequisites

- Node.js `22.x`
- `corepack` enabled
- `pnpm 10.x` preferred via `corepack` (`pnpm 9.x` on PATH is tolerated for turbo child tasks)

## Root Commands

```bash
corepack pnpm install
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm audit:prod
```

Workspace-targeted examples:

```bash
corepack pnpm --filter @managerorder/admin-web dev
corepack pnpm --filter @managerorder/admin-web test
corepack pnpm --filter @managerorder/zalo-bot-js test
```

## Architecture Contract

- Route handlers live in `apps/admin-web/src/app`.
- Business logic lives in domain and service modules under `apps/admin-web/src/lib` and `apps/admin-web/src/widgets`.
- Data access defaults to tenant-safe paths first. Reach for `supabaseAdmin` only for explicitly allowlisted system work.
- Runtime integrations such as Telegram and Zalo are isolated behind service and adapter boundaries so they can be tested without live network dependencies.

See [docs/architecture.md](/D:/GITHUB/managerorder/docs/architecture.md) for the current topology and release rules.

## Operational Route Policy

- Sensitive runtime routes must pass tenant auth before doing privileged work.
- Settings and setup surfaces require RBAC permissions.
- Deprecated operational routes stay disabled unless an explicit env flag enables them.
- `/api/migrate` is now hidden unless `ENABLE_DEPRECATED_MIGRATE_ROUTE=1`, and still requires both:
  - authenticated `admin_owner`
  - `Authorization: Bearer $CRON_SECRET`

## Release Gate

The root release gate is:

```bash
corepack pnpm check
```

This gate is expected to keep:

- lint green
- typecheck green
- tests green
- builds green
- production audit free of high-severity runtime advisories
