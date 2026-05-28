# Project Graph

## Nodes

| id | type | label | evidence |
| --- | --- | --- | --- |
| project | project | managerorder | README.md |
| admin-web | module | canonical admin web app | README.md |
| admin-app-router | module | admin web App Router routes and API handlers | docs/architecture.md |
| admin-lib | module | admin web domain rules/services/adapters/repos | docs/architecture.md |
| admin-widgets | module | admin web page composition and UI behavior | docs/architecture.md |
| admin-quality-guards | tool | admin UI/client/copy/css guard scripts | apps/admin-web/package.json |
| corepack-path | constraint | corepack command unavailable in current shell PATH | validation attempt |
| pnpm-path | constraint | pnpm command unavailable in current shell PATH | validation attempt |
| node-runtime | tool | Node.js runtime available from nvm4w | `Get-Command node` |
| local-node-bins | tool | root node_modules binaries for tsc/eslint/next/vitest | `node_modules/.bin` |
| web-interface-guidelines | constraint | current UI accessibility/performance/content rules | https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md |
| admin-navigation | module | canonical admin navigation sections | apps/admin-web/src/widgets/layout/app-nav.tsx |
| premium-pages | module | premium accounts, health checks, subscriptions, services, renewals, migrations pages | apps/admin-web/src/widgets/layout/app-nav.tsx |
| premium-subscriptions-page | module | premium subscriptions list with filter/pagination state | apps/admin-web/src/widgets/pages/premium/subscriptions/components/subscriptions-page-content.tsx |
| premium-renewals-page | module | premium renewals list with manual filters and pagination | apps/admin-web/src/widgets/pages/premium/renewals/page-client.tsx |
| operations-pages | module | dashboard, orders, inventory, customers, providers, products pages | apps/admin-web/src/widgets/layout/app-nav.tsx |
| utility-pages | module | calendar, logs, links, shares, trash, settings pages | apps/admin-web/src/widgets/layout/app-nav.tsx |
| short-links-page | module | short links utility page with local filters and transition hotspots | apps/admin-web/src/widgets/pages/short-links/components/short-links-page-content.tsx |
| short-link-detail-page | module | short-link detail utility page with remaining transition hotspots | apps/admin-web/src/widgets/pages/short-links/[id]/components/short-link-detail-page-content.tsx |
| calendar-page | module | calendar utility page with local filters and transition hotspots | apps/admin-web/src/widgets/pages/calendar/page-client.tsx |
| orders-page | module | orders list page with local search/filter/pagination state | apps/admin-web/src/widgets/pages/orders/page-client.tsx |
| inventory-page | module | inventory page with local list filters and query-param license-key detail | apps/admin-web/src/widgets/pages/inventory/page-client.tsx |
| orders-filter-bar | module | orders search/status/date filter controls | apps/admin-web/src/widgets/pages/orders/components/orders-filter-bar.tsx |
| orders-bulk-action-bar | module | floating bulk order status/delete controls | apps/admin-web/src/widgets/pages/orders/components/bulk-action-bar.tsx |
| orders-table | module | orders list cards, selection, and pagination | apps/admin-web/src/widgets/pages/orders/components/orders-table.tsx |
| shared-input | module | native input primitive with focus-visible styles | apps/admin-web/src/shared/ui/input.tsx |
| shared-select | module | native select primitive with focus-visible styles | apps/admin-web/src/shared/ui/select.tsx |
| shared-button | module | native button primitive with focus-visible styles | apps/admin-web/src/shared/ui/button.tsx |

## Edges

| from | relation | to | evidence |
| --- | --- | --- | --- |
| project | depends_on | apps/admin-web | README.md |
| project | depends_on | packages/zalo-bot-js | README.md |
| admin-web | owns | admin-app-router | docs/architecture.md |
| admin-web | owns | admin-lib | docs/architecture.md |
| admin-web | owns | admin-widgets | docs/architecture.md |
| admin-web | verified_by | admin-quality-guards | apps/admin-web/package.json |
| admin-quality-guards | blocked_by | corepack-path | validation attempt |
| admin-quality-guards | blocked_by | pnpm-path | validation attempt |
| admin-quality-guards | depends_on | node-runtime | apps/admin-web/package.json |
| admin-quality-guards | depends_on | local-node-bins | `node_modules/.bin` |
| admin-web | depends_on | web-interface-guidelines | `.agents/web-design-guidelines/SKILL.md` |
| admin-navigation | owns | operations-pages | apps/admin-web/src/widgets/layout/app-nav.tsx |
| admin-navigation | owns | premium-pages | apps/admin-web/src/widgets/layout/app-nav.tsx |
| premium-pages | owns | premium-subscriptions-page | apps/admin-web/src/widgets/pages/premium/subscriptions/page-client.tsx |
| premium-pages | owns | premium-renewals-page | apps/admin-web/src/widgets/pages/premium/renewals/page-client.tsx |
| admin-navigation | owns | utility-pages | apps/admin-web/src/widgets/layout/app-nav.tsx |
| utility-pages | owns | short-links-page | apps/admin-web/src/widgets/pages/short-links/page-client.tsx |
| utility-pages | owns | short-link-detail-page | apps/admin-web/src/widgets/pages/short-links/[id]/page-client.tsx |
| utility-pages | owns | calendar-page | apps/admin-web/src/widgets/pages/calendar/page-client.tsx |
| operations-pages | owns | orders-page | apps/admin-web/src/widgets/pages/orders/page-client.tsx |
| operations-pages | owns | inventory-page | apps/admin-web/src/widgets/pages/inventory/page-client.tsx |
| orders-page | owns | orders-filter-bar | apps/admin-web/src/widgets/pages/orders/page-client.tsx |
| orders-page | owns | orders-bulk-action-bar | apps/admin-web/src/widgets/pages/orders/page-client.tsx |
| orders-page | owns | orders-table | apps/admin-web/src/widgets/pages/orders/page-client.tsx |
| admin-widgets | depends_on | shared-input | apps/admin-web/src/widgets/pages/orders/components/orders-filter-bar.tsx |
| admin-widgets | depends_on | shared-select | apps/admin-web/src/widgets/pages/orders/components/orders-filter-bar.tsx |
| admin-widgets | depends_on | shared-button | apps/admin-web/src/widgets/pages/orders/components/orders-filter-bar.tsx |

## Timeline

| time | event | evidence |
| --- | --- | --- |
| 2026-05-29 | Triển khai soft-delete và cascade purge đồng bộ cho 5 thực thể mới trong Thùng rác (lịch, thuê bao, gia hạn, chuyển đổi, chia sẻ) | `apps/admin-web/src/lib/supabase/repositories/trash.repo.ts`, `apps/admin-web/src/widgets/pages/trash/page-client.tsx` |
| 2026-05-29 | Khắc phục lỗi 500 khi xoá vĩnh viễn khách hàng/sản phẩm bằng cascade đơn hàng/contacts và xử lý chặn lỗi FK sản phẩm thân thiện | `apps/admin-web/src/lib/supabase/repositories/trash.repo.ts` |
| 2026-05-29 | Bổ sung API Webhook landing-page vào danh sách route công khai để không bị chặn đăng nhập | `apps/admin-web/src/proxy.ts` |
| 2026-05-28 | Loại bỏ cron job trùng lặp cho telegram-reminder và nới rộng dải Node.js engine lên ">=22.0.0", đồng bộ packageManager lên pnpm@10.0.0 | `apps/admin-web/vercel.json`, `package.json`, `apps/admin-web/package.json` |
| 2026-05-28 | Sửa lỗi Next.js build crash do thiếu biến môi trường Supabase bằng cách thêm fallback placeholders vào admin.ts và proxy.ts | `apps/admin-web/src/lib/supabase/admin.ts`, `apps/admin-web/src/proxy.ts` |
| 2026-05-28 | Next.js build Out Of Memory fixed globally by integrating cross-env and setting NODE_OPTIONS max heap limit to 4GB | `apps/admin-web/package.json` |
| 2026-05-28 | Zalo Bot (zalo-bot-js) completely removed from the workspace and monorepo scripts pruned | `packages/zalo-bot-js` |
| 2026-05-28 | Pre-flight Checks successfully verified ESLint (0 errors), tsc typecheck (0 errors), 2091/2091 unit tests passed, and zalo-bot-js normalized by removing corepack | `packages/zalo-bot-js/package.json` |
| 2026-05-08 | premium health-check summary contract moved server-side; account detail audit page size raised; migration catalog batch size increased | `apps/admin-web/src/app/api/premium/health-checks/route.ts`, `apps/admin-web/src/widgets/pages/premium/health-checks/page-client.tsx`, `apps/admin-web/src/widgets/pages/premium/accounts/[id]/page-client.tsx`, `apps/admin-web/src/widgets/pages/premium/migrations/page-client.tsx` |
| 2026-05-08 | migration modal switched target-user loading to the dedicated users endpoint to avoid fetching full account detail | `apps/admin-web/src/widgets/pages/premium/migrations/components/migration-modals.tsx` |
| 2026-05-08 | added regression coverage for account audit limit default and dedicated account users route | `apps/admin-web/src/app/api/__tests__/premium-admin-contracts.api.test.ts` |
| 2026-05-08 | premium renewals and subscriptions cards gained quick presets, cleaner action affordances, and reminder copy generation aligned to API order data | `apps/admin-web/src/widgets/pages/premium/renewals/page-client.tsx`, `apps/admin-web/src/widgets/pages/premium/subscriptions/components/subscriptions-page-content.tsx`, `apps/admin-web/src/app/api/premium/subscriptions/route.ts` |
| 2026-05-08 | subscriptions UI copy was normalized to clear the premium copy guard and the page build now passes end-to-end again | `apps/admin-web/src/widgets/pages/premium/subscriptions/components/subscriptions-page-content.tsx`, `apps/admin-web/scripts/check-ui-copy-vi.mjs` |
| 2026-05-09 | renewals mutation buttons now render a busy state during processing; subscriptions menu gained direct order open/copy actions | `apps/admin-web/src/widgets/pages/premium/renewals/page-client.tsx`, `apps/admin-web/src/widgets/pages/premium/subscriptions/components/subscriptions-page-content.tsx` |
| 2026-05-09 | subscriptions header now routes back to renewals and cards expose inline order status for quicker review | `apps/admin-web/src/widgets/pages/premium/subscriptions/components/subscriptions-page-content.tsx` |
| 2026-05-09 | subscriptions now expose server-backed order status and CTV/kênh bán filters, with preset/reset wiring kept in sync | `apps/admin-web/src/widgets/pages/premium/subscriptions/components/subscriptions-page-content.tsx`, `apps/admin-web/src/app/api/premium/subscriptions/route.ts` |
| 2026-05-09 | subscriptions gained quick preset chips for order-status filters and renewals cards now collapse info pills to a single column on mobile | `apps/admin-web/src/widgets/pages/premium/subscriptions/components/subscriptions-page-content.tsx`, `apps/admin-web/src/widgets/pages/premium/renewals/page-client.tsx` |
| 2026-05-09 | subscriptions sales-channel quick chips now preserve other active filters, exclude the none bucket from the top-channel row, and show normalized pagination copy | `apps/admin-web/src/widgets/pages/premium/subscriptions/components/subscriptions-page-content.tsx` |
| 2026-05-09 | subscriptions gained server-backed quick chips for subscription status so operators can jump straight to active, waiting renewal, renewed, migrated, refunded, and suspended rows | `apps/admin-web/src/widgets/pages/premium/subscriptions/components/subscriptions-page-content.tsx`, `apps/admin-web/src/app/api/premium/subscriptions/route.ts` |
| 2026-05-09 | premium subscriptions now surface renewal-block reasons from the API and allow no-renew on non-not-renewing rows so blocked subscriptions can still be hidden intentionally | `apps/admin-web/src/app/api/premium/subscriptions/route.ts`, `apps/admin-web/src/widgets/pages/premium/subscriptions/components/subscriptions-page-content.tsx`, `apps/admin-web/src/widgets/pages/premium/renewals/page-client.tsx` |
| 2026-05-09 | direct DB trace for account `550e8400-e29b-41d4-a716-446655440000` showed four expired subscriptions were blocked too aggressively, so renewal/no-renew now allow active and expired rows while still blocking pending and terminal-risk states | `apps/admin-web/src/app/api/premium/subscriptions/route.ts`, `apps/admin-web/src/widgets/pages/premium/subscriptions/components/subscriptions-page-content.tsx`, `apps/admin-web/src/widgets/pages/premium/renewals/page-client.tsx` |
| 2026-05-09 | full DB sweep found no waiting_renewal, suspended, migrated, or refunded subscriptions in the current tenant, so expired was the only real blocked-to-open correction needed | `apps/admin-web/src/app/api/premium/subscriptions/route.ts`, `apps/admin-web/src/widgets/pages/premium/subscriptions/components/subscriptions-page-content.tsx` |
| 2026-05-09 | the current tenant has zero subscription_renewals rows, so renewals now shows an explicit empty state with a shortcut back to subscriptions for request creation | `apps/admin-web/src/widgets/pages/premium/renewals/page-client.tsx` |
| 2026-05-09 | premium subscription renewal guard now allows expired rows alongside active rows so expired subscriptions can create renewal requests from the subscriptions screen | `apps/admin-web/src/lib/domain/sales-workflow-guards.ts`, `apps/admin-web/src/lib/domain/__tests__/sales-workflow-guards.test.ts` |
| 2026-05-09 | subscriptions summary counts were realigned so eligible/blocked totals now treat expired rows as actionable alongside active rows | `apps/admin-web/src/app/api/premium/subscriptions/route.ts`, `apps/admin-web/src/app/api/__tests__/premium.api.test.ts` |
| 2026-05-09 | renewals overdue quick preset now uses the supported subscription-status filter state instead of comparing against an unsupported expired status value | `apps/admin-web/src/widgets/pages/premium/renewals/page-client.tsx` |
| 2026-05-13 | started focused business UX/UI quality audit for the canonical admin web app pages | `.agents/modern-web-architect/SKILL.md`, `.agents/web-design-guidelines/SKILL.md`, `.agents/tdd-master-workflow/SKILL.md` |
| 2026-05-13 | source-of-truth review confirmed canonical admin topology and tenant/RBAC quality constraints for the page audit | `README.md`, `docs/architecture.md`, `.context/coding_style.md` |
| 2026-05-13 | package scripts and git status review found admin visual/quality guards available and a broad pre-existing dirty worktree to preserve | `package.json`, `apps/admin-web/package.json`, `git status --short` |
| 2026-05-13 | route/page map identified operations, premium, and utility page clusters for business UX audit | `apps/admin-web/src/widgets/pages`, `apps/admin-web/src/app`, `apps/admin-web/src/widgets/layout/app-nav.tsx` |
| 2026-05-13 | fetched current Vercel Web Interface Guidelines for UI audit criteria | `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md` |
| 2026-05-13 | orders and inventory page read found local-only filter state that can lose operator context on reload/share | `apps/admin-web/src/widgets/pages/orders/page-client.tsx`, `apps/admin-web/src/widgets/pages/inventory/page-client.tsx` |
| 2026-05-13 | orders filter and bulk action controls showed low-risk accessibility/interaction fixes to patch before deeper behavior changes | `apps/admin-web/src/widgets/pages/orders/components/orders-filter-bar.tsx`, `apps/admin-web/src/widgets/pages/orders/components/bulk-action-bar.tsx` |
| 2026-05-13 | shared form/button primitives were checked before patching page-level accessibility props | `apps/admin-web/src/shared/ui/input.tsx`, `apps/admin-web/src/shared/ui/select.tsx`, `apps/admin-web/src/shared/ui/button.tsx` |
| 2026-05-13 | patched orders filter/bulk controls and shared form/button primitives for accessibility and scoped transitions | `apps/admin-web/src/widgets/pages/orders/components/orders-filter-bar.tsx`, `apps/admin-web/src/widgets/pages/orders/components/bulk-action-bar.tsx`, `apps/admin-web/src/shared/ui/input.tsx`, `apps/admin-web/src/shared/ui/select.tsx`, `apps/admin-web/src/shared/ui/button.tsx` |
| 2026-05-13 | orders list filters and pagination were deep-linked into URL query state | `apps/admin-web/src/widgets/pages/orders/page-client.tsx` |
| 2026-05-13 | diff and pattern scan reviewed touched Orders/accessibility files before running validation | `git diff`, `Select-String` |
| 2026-05-13 | static page scan found remaining transition-all hotspots and no window.confirm usage in page widgets | `apps/admin-web/src/widgets/pages` |
| 2026-05-13 | orders table transition hotspots inspected for scoped transition cleanup | `apps/admin-web/src/widgets/pages/orders/components/orders-table.tsx` |
| 2026-05-13 | orders table transitions were scoped without changing list, selection, progress, or pagination behavior | `apps/admin-web/src/widgets/pages/orders/components/orders-table.tsx` |
| 2026-05-13 | touched Orders/shared primitive files were rescanned and no transition-all occurrences remained | `Select-String`, `git diff --stat` |
| 2026-05-13 | validation attempt was blocked because corepack is not recognized in the current shell | `corepack pnpm --dir apps/admin-web run check:quality-guards` |
| 2026-05-13 | validation fallback check found Node available but pnpm/corepack unavailable in PATH | `Get-Command node`, `Get-Command pnpm`, `pnpm --version` |
| 2026-05-13 | local validation fallbacks found root tsc/eslint/next/vitest binaries and admin guard scripts | `node_modules/.bin`, `apps/admin-web/scripts` |
| 2026-05-13 | direct Node fallback ran admin quality guards successfully | `apps/admin-web/scripts/check-legacy-imports.mjs`, `apps/admin-web/scripts/check-client-boundaries.mjs`, `apps/admin-web/scripts/check-css-tokens.mjs`, `apps/admin-web/scripts/check-ui-copy-vi.mjs` |
| 2026-05-13 | admin TypeScript validation passed through local tsc binary fallback | `node_modules/.bin/tsc.cmd`, `apps/admin-web/tsconfig.json` |
| 2026-05-13 | targeted ESLint passed on changed Orders/shared primitive UI files | `node_modules/.bin/eslint.cmd` |
| 2026-05-13 | final scoped status confirmed seven changed admin UI files and no transition-all in touched files | `git status --short`, `git diff --stat`, `Select-String` |
| 2026-05-13 | resumed remaining page quality work with repo/frontend/UI audit/validation skills | `managerorder-standard`, `.agents/modern-web-architect/SKILL.md`, `.agents/web-design-guidelines/SKILL.md`, `.agents/lint-and-validate/SKILL.md` |
| 2026-05-13 | inspected premium subscriptions and renewals filter/page state before URL sync patching | `apps/admin-web/src/widgets/pages/premium/subscriptions/components/subscriptions-page-content.tsx`, `apps/admin-web/src/widgets/pages/premium/renewals/page-client.tsx` |
| 2026-05-13 | premium subscriptions filters and pagination were deep-linked into URL query state | `apps/admin-web/src/widgets/pages/premium/subscriptions/components/subscriptions-page-content.tsx` |
| 2026-05-13 | premium renewals manual filters and pagination were deep-linked into URL query state | `apps/admin-web/src/widgets/pages/premium/renewals/page-client.tsx` |
| 2026-05-13 | inspected inventory filter/detail query handling before URL sync patching | `apps/admin-web/src/widgets/pages/inventory/page-client.tsx` |
| 2026-05-13 | inventory filters were deep-linked while preserving key/trash detail query behavior | `apps/admin-web/src/widgets/pages/inventory/page-client.tsx` |
| 2026-05-13 | premium filter controls received accessible names and decorative search icons were hidden from screen readers | `apps/admin-web/src/widgets/pages/premium/subscriptions/components/subscriptions-page-content.tsx`, `apps/admin-web/src/widgets/pages/premium/renewals/page-client.tsx` |
| 2026-05-13 | touched premium/inventory files were scanned for remaining transition-all and diff churn before validation | `Select-String`, `git diff --stat` |
| 2026-05-13 | removed remaining transition-all from touched premium/inventory files and cleaned subscriptions EOF spacing | `apps/admin-web/src/widgets/pages/premium/subscriptions/components/subscriptions-page-content.tsx`, `apps/admin-web/src/widgets/pages/premium/renewals/page-client.tsx`, `apps/admin-web/src/widgets/pages/inventory/page-client.tsx` |
| 2026-05-13 | touched premium/inventory/orders UI files passed transition-all and whitespace scans | `Select-String`, `git diff --check` |
| 2026-05-13 | admin quality guards passed after remaining page patches | `apps/admin-web/scripts/check-legacy-imports.mjs`, `apps/admin-web/scripts/check-client-boundaries.mjs`, `apps/admin-web/scripts/check-css-tokens.mjs`, `apps/admin-web/scripts/check-ui-copy-vi.mjs` |
| 2026-05-13 | admin TypeScript validation passed after remaining page patches | `node_modules/.bin/tsc.cmd`, `apps/admin-web/tsconfig.json` |
| 2026-05-13 | targeted ESLint passed on all changed UI files from the Orders/Premium/Inventory audit | `node_modules/.bin/eslint.cmd` |
| 2026-05-13 | final scoped status showed 10 modified UI files and no transition-all in touched files; premium diff stats remain inflated by pre-existing dirty changes | `git diff --stat`, `git status --short`, `Select-String` |
| 2026-05-13 | remaining widgets scan identified short-links and calendar as next utility-page UX/UI hotspots while confirming the worktree is still broadly dirty | `Get-ChildItem`, `Select-String`, `git status --short` |
| 2026-05-13 | inspected short-links page and found local filter state, transition-all hotspots, and browser confirm deletes | `apps/admin-web/src/widgets/pages/short-links/components/short-links-page-content.tsx` |
| 2026-05-13 | short-links page received URL-synced list state, scoped transitions, accessible filter controls, and an in-app delete confirmation dialog | `apps/admin-web/src/widgets/pages/short-links/components/short-links-page-content.tsx` |
| 2026-05-13 | calendar page received URL-synced view/date state, scoped transitions, and accessible main controls | `apps/admin-web/src/widgets/pages/calendar/page-client.tsx` |
| 2026-05-13 | targeted ESLint, admin typecheck, and admin quality guards passed after short-links/calendar patches | `node_modules/.bin/eslint.cmd`, `node_modules/.bin/tsc.cmd`, `apps/admin-web/scripts/check-*.mjs` |
| 2026-05-13 | post-patch hotspot scan identified short-link detail and shared form/list components as next cleanup targets | `apps/admin-web/src/widgets/pages` |
| 2026-05-13 | resumed remaining utility-page cleanup under ManagerOrder UI and validation skills | `managerorder-standard`, `.agents/modern-web-architect/SKILL.md`, `.agents/web-design-guidelines/SKILL.md`, `.agents/lint-and-validate/SKILL.md` |
| 2026-05-13 | short-link detail inspection found destructive browser confirms and broad transition hotspots to replace with in-app confirmation and scoped motion | `apps/admin-web/src/widgets/pages/short-links/[id]/components/short-link-detail-page-content.tsx` |
| 2026-05-13 | short-links main page provides the confirmation-dialog UX pattern for detail-page destructive actions | `apps/admin-web/src/widgets/pages/short-links/components/short-links-page-content.tsx` |
| 2026-05-13 | short-link detail destructive and status actions now route through an in-app confirmation dialog and scoped motion classes | `apps/admin-web/src/widgets/pages/short-links/[id]/components/short-link-detail-page-content.tsx` |
| 2026-05-13 | short-link detail cleanup passed pattern scan, targeted ESLint, and scoped diff whitespace validation | `apps/admin-web/src/widgets/pages/short-links/[id]/components/short-link-detail-page-content.tsx` |
| 2026-05-13 | remaining page hotspot scan prioritizes customer/order/provider/calendar/inventory form and list components for transition/confirm cleanup | `apps/admin-web/src/widgets/pages` |
| 2026-05-13 | inspected customer modals/list and create-order form for transition/button cleanup; no native confirm usage found in that batch | `apps/admin-web/src/widgets/pages/customers/components/customer-modals.tsx`, `apps/admin-web/src/widgets/pages/customers/components/customers-page-list.tsx`, `apps/admin-web/src/widgets/pages/orders/components/create-order-form.tsx` |
| 2026-05-13 | customer/order batch requires only UI affordance patches, not business hook or API contract changes | `apps/admin-web/src/widgets/pages/customers/components/customer-modals.tsx`, `apps/admin-web/src/widgets/pages/customers/components/customers-page-list.tsx`, `apps/admin-web/src/widgets/pages/orders/components/create-order-form.tsx` |
| 2026-05-13 | customer/order batch patched scoped transitions and selection/pagination affordances | `apps/admin-web/src/widgets/pages/customers/components/customer-modals.tsx`, `apps/admin-web/src/widgets/pages/customers/components/customers-page-list.tsx`, `apps/admin-web/src/widgets/pages/orders/components/create-order-form.tsx` |
| 2026-05-13 | customer/order batch passed refined native-confirm scan, targeted ESLint, and scoped diff whitespace validation | `apps/admin-web/src/widgets/pages/customers/components/customer-modals.tsx`, `apps/admin-web/src/widgets/pages/customers/components/customers-page-list.tsx`, `apps/admin-web/src/widgets/pages/orders/components/create-order-form.tsx` |
| 2026-05-13 | providers/calendar/inventory batch inspection found UI-only transition/button affordance cleanup targets with no native confirm usage | `apps/admin-web/src/widgets/pages/providers/components/providers-page-content.tsx`, `apps/admin-web/src/widgets/pages/calendar/components/event-create-modal.tsx`, `apps/admin-web/src/widgets/pages/inventory/components/inventory-page-header.tsx`, `apps/admin-web/src/widgets/pages/inventory/components/inventory-table.tsx` |
| 2026-05-13 | providers/calendar/inventory batch patched scoped transitions and selected-state affordances without changing data hooks | `apps/admin-web/src/widgets/pages/providers/components/providers-page-content.tsx`, `apps/admin-web/src/widgets/pages/calendar/components/event-create-modal.tsx`, `apps/admin-web/src/widgets/pages/inventory/components/inventory-page-header.tsx`, `apps/admin-web/src/widgets/pages/inventory/components/inventory-table.tsx` |
| 2026-05-13 | providers/calendar/inventory batch passed refined native-confirm scan, targeted ESLint, and scoped diff whitespace validation | `apps/admin-web/src/widgets/pages/providers/components/providers-page-content.tsx`, `apps/admin-web/src/widgets/pages/calendar/components/event-create-modal.tsx`, `apps/admin-web/src/widgets/pages/inventory/components/inventory-page-header.tsx`, `apps/admin-web/src/widgets/pages/inventory/components/inventory-table.tsx` |
| 2026-05-13 | remaining hotspot scan shifted to orders import, customer group/tag, settings reminder, import mapping, dashboard/provider detail, premium service, inventory detail, and products components | `apps/admin-web/src/widgets/pages` |
| 2026-05-13 | orders import/mapping, customer group-tag, and reminder config inspection found transition/button cleanup only; existing destructive dialogs stay in-app | `apps/admin-web/src/widgets/pages/orders/import/page-client.tsx`, `apps/admin-web/src/widgets/pages/orders/components/import-mapping-grid.tsx`, `apps/admin-web/src/widgets/pages/customers/components/group-tag-manager.tsx`, `apps/admin-web/src/widgets/pages/settings/components/reminder-config.tsx` |
| 2026-05-13 | orders import/mapping, customer group-tag, and reminder config batch patched scoped transitions and choice-control accessibility states | `apps/admin-web/src/widgets/pages/orders/import/page-client.tsx`, `apps/admin-web/src/widgets/pages/orders/components/import-mapping-grid.tsx`, `apps/admin-web/src/widgets/pages/customers/components/group-tag-manager.tsx`, `apps/admin-web/src/widgets/pages/settings/components/reminder-config.tsx` |
| 2026-05-13 | orders import/mapping, customer group-tag, and reminder config batch passed refined native-confirm scan, targeted ESLint, and scoped diff whitespace validation | `apps/admin-web/src/widgets/pages/orders/import/page-client.tsx`, `apps/admin-web/src/widgets/pages/orders/components/import-mapping-grid.tsx`, `apps/admin-web/src/widgets/pages/customers/components/group-tag-manager.tsx`, `apps/admin-web/src/widgets/pages/settings/components/reminder-config.tsx` |
| 2026-05-13 | remaining hotspot scan now prioritizes customer detail, products, dashboard header, provider detail, inventory source-account detail, and premium service edit modal | `apps/admin-web/src/widgets/pages` |
| 2026-05-13 | customer/product/dashboard/provider/inventory detail and premium service edit inspection found UI-only transition/button cleanup targets with no native confirm usage | `apps/admin-web/src/widgets/pages/customers/[customerId]/page-client.tsx`, `apps/admin-web/src/widgets/pages/products/components/products-page-content.tsx`, `apps/admin-web/src/widgets/pages/dashboard/components/dashboard-header.tsx`, `apps/admin-web/src/widgets/pages/providers/[providerId]/components/provider-detail-page-content.tsx`, `apps/admin-web/src/widgets/pages/inventory/source-accounts/[id]/page-client.tsx`, `apps/admin-web/src/widgets/pages/premium/services/components/service-edit-modal.tsx` |
| 2026-05-13 | customer/product/dashboard/provider/inventory detail and premium service edit batch patched scoped transitions and tab/toggle affordances | `apps/admin-web/src/widgets/pages/customers/[customerId]/page-client.tsx`, `apps/admin-web/src/widgets/pages/products/components/products-page-content.tsx`, `apps/admin-web/src/widgets/pages/dashboard/components/dashboard-header.tsx`, `apps/admin-web/src/widgets/pages/providers/[providerId]/components/provider-detail-page-content.tsx`, `apps/admin-web/src/widgets/pages/inventory/source-accounts/[id]/page-client.tsx`, `apps/admin-web/src/widgets/pages/premium/services/components/service-edit-modal.tsx` |
| 2026-05-13 | customer/product/dashboard/provider/inventory detail and premium service edit batch passed refined native-confirm scan, targeted ESLint, and scoped diff whitespace validation | `apps/admin-web/src/widgets/pages/customers/[customerId]/page-client.tsx`, `apps/admin-web/src/widgets/pages/products/components/products-page-content.tsx`, `apps/admin-web/src/widgets/pages/dashboard/components/dashboard-header.tsx`, `apps/admin-web/src/widgets/pages/providers/[providerId]/components/provider-detail-page-content.tsx`, `apps/admin-web/src/widgets/pages/inventory/source-accounts/[id]/page-client.tsx`, `apps/admin-web/src/widgets/pages/premium/services/components/service-edit-modal.tsx` |
| 2026-05-13 | full remaining line scan found scattered transition-all cleanup plus one native confirm in source-account connection disconnect | `apps/admin-web/src/widgets/pages` |
| 2026-05-13 | bounded mechanical transition rewrite removed remaining broad transition-all classes across widgets/pages without changing component logic | `apps/admin-web/src/widgets/pages` |
| 2026-05-13 | source-account connections disconnect action still needs in-app confirmation replacing native browser confirm | `apps/admin-web/src/widgets/pages/inventory/components/source-account-connections.tsx` |
| 2026-05-13 | source-account connections disconnect action now uses an in-app confirmation dialog while preserving the existing disconnect mutation path | `apps/admin-web/src/widgets/pages/inventory/components/source-account-connections.tsx` |
| 2026-05-13 | widgets/pages scan is clean for broad transition-all and native browser confirm usage | `apps/admin-web/src/widgets/pages` |
| 2026-05-13 | full widgets/pages ESLint, admin TypeScript, and diff whitespace validation passed after page-wide transition/confirm cleanup | `apps/admin-web/src/widgets/pages`, `apps/admin-web/tsconfig.json` |
| 2026-05-13 | admin quality guards passed after page-wide cleanup | `apps/admin-web/scripts/check-legacy-imports.mjs`, `apps/admin-web/scripts/check-client-boundaries.mjs`, `apps/admin-web/scripts/check-css-tokens.mjs`, `apps/admin-web/scripts/check-ui-copy-vi.mjs` |
| 2026-05-13 | final page-wide scan and diff whitespace check remained clean after validation; premium CRLF warnings persist | `apps/admin-web/src/widgets/pages`, `.context/project-memory.md`, `.context/project-graph.md` |
| 2026-05-13 | hook/type spot-check found no transition rewrite artifacts in non-UI files under widgets/pages | `apps/admin-web/src/widgets/pages/inventory/hooks/use-source-accounts.ts`, `apps/admin-web/src/widgets/pages/orders/hooks/use-orders.ts`, `apps/admin-web/src/widgets/pages/premium/health-checks/types.ts`, `apps/admin-web/src/widgets/pages/premium/migrations/types.ts` |
