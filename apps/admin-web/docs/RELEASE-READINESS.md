# Release Readiness

> ManagerOrder: deploy, migration, runtime smoke, and visual gate checklist.

## Scope

- Core identity: `accounts`, `admin_users`
- Short-link: `sales_channels`, `short_links`, `short_link_clicks`
- Business domains: `customers`, `orders`, `inventory`, `source_accounts`
- Premium domains: `premium_*`, `customer_premium_subscriptions`, `account_migrations`
- Bot/runtime: `/api/settings/bot/status`, contact matching, broadcast, runtime smoke

## Migration Order

Run these in order on a live DB that still needs the baseline alignment:

1. [`20260314000000_rls_tenant_isolation.sql`](./../supabase/migrations/20260314000000_rls_tenant_isolation.sql)
1. [`20260408090000_compat_zalo_auth_soft_delete.sql`](./../supabase/migrations/20260408090000_compat_zalo_auth_soft_delete.sql)
1. [`20260417143000_short_link_public_full_schema.sql`](./../supabase/migrations/20260417143000_short_link_public_full_schema.sql)
1. [`20260418123000_orders_refund_requests_status_alignment.sql`](./../supabase/migrations/20260418123000_orders_refund_requests_status_alignment.sql)
1. [`20260418170000_premium_account_fk_alignment.sql`](./../supabase/migrations/20260418170000_premium_account_fk_alignment.sql)

Notes:

- Do not run the legacy `premium_accounts`-root migrations on a live DB that uses `accounts` as the tenant root.
- If Supabase schema cache is stale after migration, refresh it before runtime smoke.
- If you only need the short-link baseline, the third migration is the one that matters most.

## Deploy Order

1. Apply migrations.
1. Refresh schema cache if needed.
1. Deploy the app.
1. Verify `/api/settings/bot/status`.
1. Run runtime smoke.
1. Run short-link smoke.
1. Run visual QA.

## Verification Gates

```bash
npm run typecheck
npm test
npm run build
npm run smoke:runtime
npm run check:short-link-schema
npm run smoke:short-links
npm run qa:visual
```

## Bot Gate

Before release, confirm:

- Telegram runtime reports a healthy transport.
- Zalo runtime reports a healthy transport.
- `broadcastReady` is true if you expect broadcast to be used.
- `tenantAligned` is true.
- `lastHeartbeatAt` is not stale.
- `lastErrorMessage` is empty or understood.

## Short-Link Gate

Confirm these behaviors on a live runtime:

- `direct_redirect` still redirects immediately.
- `landing_page` renders landing without burning click count.
- `GET /s/[slug]/go` is the click-consuming redirect path.
- Crawler preview does not leak the target URL.
- Force-direct rollback still works through `SHORT_LINK_FORCE_DIRECT_REDIRECT=true`.

## Rollback

If a release needs a fast rollback:

1. Set `SHORT_LINK_FORCE_DIRECT_REDIRECT=true`.
1. Redeploy or restart the runtime.
1. Re-run `npm run smoke:short-links`.
1. Verify the public flow falls back to direct redirect.

