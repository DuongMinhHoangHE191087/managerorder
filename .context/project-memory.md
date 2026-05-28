# Project Memory

## Active Scope

- Project: `managerorder`
- Last updated:
- Primary source files:
- Related docs: `README.md`, `docs/architecture.md`, `.context/coding_style.md`

## Decisions

- 2026-05-28: Sửa lỗi Next.js build Out Of Memory (OOM) đa nền tảng bằng cách tích hợp cross-env để thiết lập NODE_OPTIONS --max-old-space-size=4096 một cách nhất quán trên cả Local (Windows) và Vercel CI (Linux).
- 2026-05-28: Loại bỏ tiền tố corepack trong scripts của zalo-bot-js package.json giúp các lệnh lint, typecheck, test, và build chạy chuẩn hóa và di động hơn.
- 2026-05-28: Gỡ bỏ hoàn toàn Zalo Bot (packages/zalo-bot-js) khỏi workspace và dọn dẹp các scripts liên quan trong root package.json theo yêu cầu người dùng, giúp monorepo cực kỳ tinh gọn.
- [date] decision / rationale

## Facts

- 2026-05-28: Next.js build gặp lỗi crash code 134 (JS heap out of memory) trong pha tsc typecheck. Giải quyết triệt để bằng cách dùng cross-env cấp phát 4GB heap size và chạy next build chuẩn hóa, tương thích cả Windows local và Linux Vercel CI.
- 2026-05-28: Thực hiện thành công toàn bộ Pre-flight Checks của quy trình /ops trên cả monorepo: ESLint (0 lỗi), TypeScript typecheck (0 lỗi), Unit Tests (2091/2091 passed), và zalo-bot-js smoke test (smoke ok).
- 2026-05-28: Xóa cứng Zalo Bot và gỡ bỏ 288 packages dư thừa khỏi node_modules. Build toàn diện monorepo thành công 100%.
- [date] concise factual note
- 2026-05-13: After short-links/calendar patches, remaining top transition hotspots are short-link detail, create-order form, customers list, providers content, event-create modal, inventory table/header, settings reminder config, group/tag manager, and orders import.
- 2026-05-13: Short-links page keeps search/status/sort/page in local state, has many `transition-all` classes, and still uses browser `confirm(...)` for destructive single/bulk deletes.
- 2026-05-13: Remaining widgets scan ranks `short-links/components/short-links-page-content.tsx` as the largest untouched UI hotspot (18 `transition-all`, no `useSearchParams`), followed by short-link detail, calendar page, create-order form, customers list, and providers content.
- 2026-05-13: Scoped status still shows a broad pre-existing dirty worktree across widgets/pages, including inventory, login, orders, premium, settings bot, and untracked account-share/share pages.
- 2026-05-13: Final scoped status after remaining page work shows 10 modified UI files plus untracked `.context` files; touched files have no remaining `transition-all`, but premium diff stats remain large because those files were already broadly modified in the dirty worktree.
- 2026-05-13: Post-cleanup scan found no `transition-all` in the touched premium/inventory files, and `git diff --check` passed for the touched UI files; Git still warns that one subscriptions file has CRLF normalization behavior.
- 2026-05-13: Post-patch scan found remaining `transition-all` in touched premium subscriptions, premium renewals, and inventory files; initial diff stat for premium files is inflated by line-ending/format churn and needs cleanup before finalizing.
- 2026-05-13: Inventory page already uses URL params for license-key detail (`key`, `trash`) but search/product/provider/status filters are local state; closing detail currently routes to `/inventory` and drops all query context.
- 2026-05-13: Premium subscriptions page keeps `search`, renewal/subscription/order/sales-channel filters, page, and page size in local state while building the API query from that state.
- 2026-05-13: Premium renewals page keeps `ManualFilterState`, page, and page size in local state while building the API query from that state.
- 2026-05-13: Source-of-truth docs confirm `apps/admin-web` is the only canonical admin app; route handlers must stay in `src/app`, while business rules, services, and page behavior belong in `src/lib` and `src/widgets`.
- 2026-05-13: Current UX/business audit must preserve tenant-safe data paths, RBAC/feature-gated sensitive routes, and root validation gates from the monorepo contract.
- 2026-05-13: Root and admin package scripts expose the expected gates (`lint`, `typecheck`, `test`, `build`, `audit:prod`) plus admin UI guards (`check:client-boundaries`, `check:css-tokens`, `check:ui-copy`) and visual QA scripts.
- 2026-05-13: Current worktree already contains many modified and untracked files across admin API, domain, widgets, auth, account sharing, and premium flows; future edits in this session must avoid reverting unrelated user changes.
- 2026-05-13: `rg.exe` failed with Windows access denied, so compact exploration should use PowerShell `Get-ChildItem` and `Select-String` fallbacks in this environment.
- 2026-05-13: Admin navigation groups pages into operations (`dashboard`, `orders`, `inventory`, `customers`, `providers`, `products`), premium accounts (`accounts`, `health-checks`, `subscriptions`, `services`, `renewals`, `migrations`), and utilities (`calendar`, `activity-logs`, `short-links`, `account-shares`, `trash`, `settings`, `settings/bot`).
- 2026-05-13: Latest Vercel Web Interface Guidelines emphasize accessible icon buttons, visible focus states, semantic controls/links, URL-synced state, robust empty/long-content handling, safe destructive actions, `Intl.*` formatting, and avoiding risky anti-patterns like `transition: all`.
- 2026-05-13: Orders list keeps page/search/status/date state locally and passes it into `useOrders`; Inventory keeps list filters locally while only license-key detail uses query params. This creates a UX gap against URL-synced filter state.
- 2026-05-13: PowerShell reads for Next dynamic segment paths such as `[id]` require `-LiteralPath`.
- 2026-05-13: Orders filter and bulk action UI have accessible-form and interaction polish gaps: unlabeled select/date controls, decorative icons without explicit hiding, `transition-all`/scale chip movement, and bulk bar controls missing explicit button type/name/labels.
- 2026-05-13: Premium subscriptions and renewals pages build API query params from local filter/pagination state instead of initializing/syncing those controls from the URL.
- 2026-05-13: Shared `Input`, `Select`, and `Button` primitives forward native props and already provide focus-visible rings, but still use broad `transition-all` classes.
- 2026-05-13: Diff review after Orders patches showed some unrelated pre-existing dirty changes in `orders/page-client.tsx`; touched controls now use scoped transitions and any `focus-visible:outline-none` instances keep visible ring replacements.
- 2026-05-13: Static page scan found remaining `transition-all` concentration in short-links, orders table/import/detail, calendar, customers/providers, and inventory components; no `window.confirm` occurrences were found under `widgets/pages`.
- 2026-05-13: `orders-table` transition hotspots are mostly hover card movement/shadow, checkbox state, timeline/payment bar width, page-size chips, and pagination arrows.
- 2026-05-13: Post-patch scan found no `transition-all` occurrences in the touched Orders/shared primitive files; current code diff is concentrated in seven admin UI files.
- 2026-05-13: Current shell has Node at `C:\nvm4w\nodejs\node.exe`, but neither `pnpm` nor `corepack` is available in PATH.
- 2026-05-13: Root `node_modules/.bin` contains local `tsc`, `eslint`, `next`, and `vitest` binaries, and admin guard scripts exist under `apps/admin-web/scripts`.
- 2026-05-13: Final scoped status for this session shows seven modified admin UI files and untracked `.context/project-memory.md` plus `.context/project-graph.md`; touched files remain free of `transition-all`.

## Open Questions

- [date] unresolved question
- 2026-05-13: Validation environment question: package manager commands are unavailable in PATH, so gates may need direct Node scripts or local `node_modules/.bin` fallbacks.

## Session Log

- 2026-05-28: Gỡ bỏ hoàn toàn Zalo Bot: Xóa cứng thư mục packages/zalo-bot-js, dọn dẹp cấu hình workspace và 288 packages phụ thuộc. Xác thực chạy lại build toàn monorepo thành công rực rỡ.
- 2026-05-28: Chạy quy trình /ops (/deploy check) toàn diện: Kiểm tra thành công ESLint (0 errors), tsc typecheck (0 errors) của admin-web. Đồng thời gỡ bỏ corepack khỏi zalo-bot-js, xác thực thành công bộ unit tests 2091/2091 passed và smoke test thành công (smoke ok).
- [date] event or correction
- 2026-05-13: Spot-check of non-UI hook/type files under `widgets/pages` showed their diffs are pre-existing contract additions, not transition rewrite artifacts; no `transition-*` strings remain in those hook/type files.
- 2026-05-13: Final scan remained clean for `transition-all` and native `confirm(` across `widgets/pages`; final scoped `git diff --check` passed with the same premium CRLF normalization warnings.
- 2026-05-13: Final status/stat shows the page-wide cleanup touched many `apps/admin-web/src/widgets/pages` files, including pre-existing dirty and untracked account-share/share/login worktree areas; validation covered the full widgets/pages tree.
- 2026-05-13: Admin quality guards passed after full page cleanup: no legacy import/boundary violations, client modules avoid server-only imports, CSS tokens resolve, and Vietnamese UI copy guard is clean.
- 2026-05-13: Large validation passed after full widgets/pages cleanup: ESLint on `src/widgets/pages`, full admin `tsc --noEmit`, and `git diff --check` all passed; Git still warns about CRLF normalization in premium migrations/subscriptions files.
- 2026-05-13: Full `widgets/pages` scan is now clean for both `transition-all` and native `confirm(` after the mechanical rewrite and source-account confirmation dialog patch.
- 2026-05-13: Source-account connections now replaces native disconnect `confirm` with an in-app modal dialog, pending state, overlay close guard, and unchanged `handleDisconnect` mutation path.
- 2026-05-13: Source-account connections disconnect flow currently gates `handleDisconnect` with native `confirm(text.confirmDisconnect(...))`; component already has local state and can host an in-app confirmation dialog near its main return.
- 2026-05-13: Applied a bounded mechanical rewrite under `apps/admin-web/src/widgets/pages` replacing remaining `transition-all` with `transition-[background-color,border-color,box-shadow,color,opacity,transform,width]` so motion stays scoped without hand-editing unrelated logic.
- 2026-05-13: Full remaining line-level scan found transition-all still scattered across account shares, dashboard, customer/inventory/order/premium/provider/settings components, and one native confirm in `source-account-connections` disconnect flow.
- 2026-05-13: Customer/product/dashboard/provider/inventory detail and premium service edit batch validation passed: transition/native-confirm scan clean, targeted ESLint passed, and scoped `git diff --check` passed.
- 2026-05-13: Customer/product/dashboard/provider/inventory detail and premium service edit batch now scopes CTA/row/input/progress/tab transitions and adds explicit button types plus pressed state on detail tabs/toggles.
- 2026-05-13: Customer/product/dashboard/provider/inventory detail and premium service edit inspection found only scoped transition and button-type/pressed-state cleanup; no native confirm usage.
- 2026-05-13: Remaining hotspot scan after import/config cleanup now leads with customer detail, products, dashboard header, provider detail, inventory source-account detail, and premium service edit modal at four occurrences each.
- 2026-05-13: Orders import/mapping, customer group-tag, and reminder config batch validation passed: transition/native-confirm scan clean, targeted ESLint passed, and scoped `git diff --check` passed.
- 2026-05-13: Orders import/mapping, customer group-tag manager, and reminder config batch now scopes dropzone/card/control transitions, adds pressed states to tab/channel/color choices, labels color swatches, and sets explicit button types on reminder actions.
- 2026-05-13: Orders import/mapping, customer group-tag manager, and reminder config inspection found transition/button affordance cleanup only; destructive group/tag deletes already use in-app dialogs, not native confirm.
- 2026-05-13: Remaining hotspot scan after providers/calendar/inventory cleanup now leads with orders import page, customer group/tag manager, settings reminder config, import mapping grid, dashboard header, provider detail, premium service modals, inventory account detail, and products page.
- 2026-05-13: Providers/calendar/inventory batch validation passed: transition/native-confirm scan clean, targeted ESLint passed, and scoped `git diff --check` passed.
- 2026-05-13: Providers/calendar/inventory batch now scopes broad transitions on provider rows/pagination, calendar create-modal controls, inventory header actions, and inventory table row/progress/container affordances; page-size and modal type buttons expose pressed state.
- 2026-05-13: Providers, calendar event modal, and inventory header/table inspection found transition-all hotspots in create buttons, rows, cards, form controls, sort/progress/pagination affordances; no native confirm usage in this batch.
- 2026-05-13: Customer/order batch validation passed: refined transition/native-confirm scan is clean, targeted ESLint passed, and scoped `git diff --check` passed.
- 2026-05-13: Customer modal/list and create-order form batch now scopes remaining broad transitions, adds pressed state to segmented/preset buttons, labels destructive row removal, and labels customer pagination controls.
- 2026-05-13: Detailed snippets confirmed the current batch can be handled with scoped transition class swaps plus `type`/`aria-pressed`/swatch labels; no data contract or hook changes are needed.
- 2026-05-13: Customer modal/list and create-order form inspection found only transition/button polish issues in this pass, with no native `confirm(` in those three files.
- 2026-05-13: Post short-link-detail hotspot scan now ranks customer modals, create-order form, customers list, providers page, calendar event modal, inventory header/table, orders import, settings reminders, and customer group/tag managers as the next transition/confirm cleanup targets.
- 2026-05-13: Short-link detail cleanup passed targeted scans: no remaining `transition-all` or native `confirm(` in the file, targeted ESLint passed, and scoped `git diff --check` passed.
- 2026-05-13: Short-link detail page now uses an in-app confirmation dialog for delete/status-toggle actions, explicit button types for action controls, hidden decorative action icons, and scoped transitions for header actions, security banner, progress, and tabs.
- 2026-05-13: Short-links main page already has an in-app delete dialog pattern with overlay button, `role="dialog"`, pending-state action button, and scoped transitions; short-link detail can reuse that UX shape.
- 2026-05-13: Short-link detail page inspection found native `confirm(...)` in delete/toggle-status flows, `transition-all` across header actions/security/progress/tabs, and several action buttons missing explicit `type`.
- 2026-05-13: Reloaded ManagerOrder, modern-web-architect, web-design-guidelines, and lint-and-validate instructions before continuing the remaining utility-page quality cleanup; short-link detail remains the immediate target.
- 2026-05-13: Targeted ESLint passed for short-links/calendar; full admin `tsc --noEmit` passed; admin quality guards passed again after utility page patches.
- 2026-05-13: Short-links page now syncs search/status/sort/page with URL query params, removes page-level `transition-all` hotspots, adds accessible labels/pressed states on list filters, and replaces browser confirm deletes with an in-app confirmation dialog.
- 2026-05-13: Calendar page now syncs `view` and `date` with URL query params, removes page-level `transition-all` hotspots, and tightens button/input accessibility on the main calendar controls.
- 2026-05-13: Continued remaining business UX/UI quality work using ManagerOrder Standard, Modern Web Architect, Web Design Guidelines, and Lint Validate; next target is URL-synced filter state for premium subscription/renewal pages.
- 2026-05-13: Premium subscriptions filters and pagination now sync with `/premium/subscriptions` query params while preserving back/forward behavior and using shared page-size options for parsing and UI.
- 2026-05-13: Premium renewals `ManualFilterState`, page, and page size now sync with `/premium/renewals` query params while preserving quick views and back/forward behavior.
- 2026-05-13: Inventory filters now sync with `/inventory` query params, and closing a license-key detail removes only `key`/`trash` while preserving the active inventory filters.
- 2026-05-13: Premium subscriptions and renewals filter controls now expose clearer accessible names; decorative search icons are hidden from screen readers.
- 2026-05-13: Removed remaining `transition-all` usages from the touched premium subscriptions, premium renewals, and inventory files; also removed extra blank lines at the end of subscriptions content.
- 2026-05-13: Admin quality guards passed again after premium/inventory URL state and a11y patches: legacy imports, client boundaries, CSS tokens, and Vietnamese UI copy.
- 2026-05-13: Admin TypeScript validation passed again via direct local `tsc.cmd --noEmit` after premium/inventory URL state patches.
- 2026-05-13: Targeted ESLint passed for all changed UI files across Orders, Premium subscriptions/renewals, Inventory, and shared form/button primitives.
- 2026-05-13: Started a focused business UX/UI quality audit for the canonical admin web app, using modern-web-architect, web-design-guidelines, TDD workflow, and token-efficient repo exploration.
- 2026-05-13: Patched Orders filter and bulk action controls for stronger accessibility and interaction quality: labels/names on controls, decorative icons hidden, pressed/focus state on chips, explicit button types, live region for bulk selection, and scoped transitions.
- 2026-05-13: Patched shared `Input`, `Select`, and `Button` primitives to replace broad `transition-all` with scoped transition properties while preserving focus-visible rings.
- 2026-05-13: Orders list now initializes and syncs search/status/date/page/page_size state with the URL using `router.replace(..., { scroll: false })`, preserving operator context across reload/back/share without changing API contracts.
- 2026-05-13: Patched `orders-table` transition hotspots to scope transitions to actual animated properties (`transform`, `box-shadow`, `width`, and colors) while preserving the existing card, progress, and pagination behavior.
- 2026-05-13: Attempted `corepack pnpm --dir apps/admin-web run check:quality-guards`, but validation could not start because `corepack` is not recognized in the current shell.
- 2026-05-13: Admin guard scripts passed via direct Node fallback: no legacy import violations, no client/server boundary violations, all CSS tokens resolve, and no blocked English/mojibake UI copy detected.
- 2026-05-13: Admin TypeScript validation passed via direct local binary fallback: `..\..\node_modules\.bin\tsc.cmd --noEmit` from `apps/admin-web`.
- 2026-05-13: Targeted ESLint passed for the seven changed admin UI files in Orders and shared form/button primitives.

## Command Journal

- [date] command / insight / saved delta
- 2026-05-08: Premium health-checks now return pagination.summary from the server and the UI reads total summary counts instead of page-local counts; account detail audit pagination now uses limit 12, migration catalog loads subscriptions with page_size 100.
- 2026-05-08: Premium migration modal now loads target account users from `/api/premium/accounts/[id]/users?status=active&limit=100` instead of pulling full account detail, reducing unnecessary audit/detail traffic.
- 2026-05-08: Added contract coverage for premium account detail audit limit defaulting to 12 and for the dedicated premium account users endpoint.
- 2026-05-08: Renewals and subscriptions UX was tightened with quick preset chips, cleaner per-item actions, reminder copy helpers, and removal of duplicate direct action buttons on subscription cards.
- 2026-05-08: Subscriptions card actions now use `buildReminderMessage(subscription)` from the page contract shape, with `order_code` added to the local row type so reminder copy stays aligned with API data.
- 2026-05-08: Repaired mojibake UI copy in subscriptions so the premium copy guard passes again; the page now builds cleanly after the action row simplification.
- 2026-05-09: Renewals per-item mutation buttons now show a busy state and are disabled while the card is processing, preventing duplicate submits.
- 2026-05-09: Subscriptions quick actions now include opening the related order and copying the order code directly from the card menu.
- 2026-05-09: Subscriptions header now links back to renewals, and subscription cards surface order status inline for faster operations review.
- 2026-05-09: Subscriptions gained server-backed filters for order status and CTV/kênh bán, with reset/preset behavior wired to clear them correctly.
- 2026-05-09: Subscriptions now expose quick preset chips for server-backed order statuses, and renewals cards switch their info grid to a single column on mobile for better readability.
- 2026-05-09: Subscriptions sales-channel quick chips now preserve other active filters, skip the "none" bucket from the top-channel row, and the pagination copy is cleaned up for clearer operator flow.
- 2026-05-09: Subscriptions now expose server-backed quick chips for subscription status, so operators can jump straight to active, waiting renewal, renewed, migrated, refunded, and suspended rows without opening the full filter panel.
- 2026-05-09: Premium subscriptions now return explicit renewal-block reasons from the API, and the no-renew action is available for non-not-renewing rows so operators can hide blocked subscriptions instead of losing the action entirely.
- 2026-05-09: Direct DB trace on account `550e8400-e29b-41d4-a716-446655440000` showed 30 subscriptions with 4 `expired` rows incorrectly blocked by the old rule; renewal and no-renew now allow `active` + `expired` rows while still blocking pending/not_renewing and risky terminal states.
- 2026-05-09: A full DB sweep showed this tenant has no `waiting_renewal`, `suspended`, `migrated`, or `refunded` subscriptions yet, so the only real blocked-to-open correction needed was `expired`; the broader terminal-state blocks remain unchanged for future data.
- 2026-05-09: The current tenant has zero `subscription_renewals` rows, so the renewals screen now presents an explicit empty state that routes operators back to subscriptions to create renewal requests instead of showing a dead end.
- 2026-05-09: Premium subscription renewal guard now allows `expired` rows as well as `active` rows, matching the DB trace where expired subscriptions were the real operator path for creating renewal requests.
- 2026-05-09: Subscriptions API summary counts were still active-only after the rule change, so `canRenewSubscription` and the eligible/blocked counters were aligned to treat `expired` rows as actionable too.
- 2026-05-09: Renewals quick preset state was corrected so the overdue chip uses `dueState=expired` with the existing subscription-status filter state instead of comparing against a non-existent expired subscription status value.
