# Active Context — ManagerOrder (Premium Admin Web)

> Cập nhật: 2026-03-14

## 1. Trạng thái hiện tại

**Phase**: Stabilization & Maintenance
**Trạng thái**: Hệ thống đã ổn định, codebase đã được tổ chức lại chuyên nghiệp.

## 2. Công việc vừa hoàn thành

### Reorganization (2026-03-14)
- ✅ Tập trung components vào `src/components/<feature>` (từ `src/app/*/components`)
- ✅ Tập trung hooks vào `src/lib/hooks` (từ `src/hooks`)
- ✅ Cập nhật tất cả import paths
- ✅ Verify: tsc ✅, build ✅ (63 pages), tests ✅ (1439)

### File Cleanup (2026-03-14)
- ✅ Xóa 7 file rác từ root (logs, SQL scripts, output files)
- ✅ Cập nhật `.gitignore` (loại bỏ temp files, Excel data, SQL scratch)
- ✅ Tổ chức `docs/` thành 11 thư mục phân loại (01- → 09-, plans/, scripts/)
- ✅ Xóa 24 file reports cũ + 6 file SQL trùng lặp
- ✅ Verify: tsc ✅, build ✅

### Trước đó (2026-03-12 → 2026-03-13)
- ✅ RBAC implementation (Phase 3)
- ✅ Platform Metrics (Phase 4)
- ✅ Supabase client migration (SSR pattern)
- ✅ Dashboard status colors fix
- ✅ Inventory 404 loop fix
- ✅ Edit source account modal refactoring
- ✅ Order creation & renewal improvements
- ✅ Calendar today's tasks fix
- ✅ Activity logs fix
- ✅ Race condition tests fix

## 3. Known Issues

| Issue | Severity | Mô tả |
|-------|----------|--------|
| Supabase mock key | Low | 2 tests bị skip do thiếu mock cho Supabase key trong Vitest config |
| Lint warnings | Low | Pre-existing lint warnings (non-blocking, không ảnh hưởng build) |

## 4. Quyết định kiến trúc quan trọng (Recent)

1. **Custom JWT Auth** (không dùng Supabase Auth): Do cần multi-tenant với admin_users table riêng
2. **Atomic RPC + Fallback**: Mọi operation quan trọng dùng PostgreSQL RPC, có JS fallback nếu RPC chưa deploy
3. **Component centralization**: Components đã move ra khỏi `src/app/*/components` → `src/components/<feature>` để decouple khỏi App Router
4. **React Query cho server state**: Tất cả data fetching qua custom hooks + TanStack Query, central query keys

## 5. Conventions cần tuân thủ

- **File naming**: kebab-case cho files (`create-order-form.tsx`), PascalCase cho components
- **Import paths**: Luôn dùng `@/` alias (tsconfig path)
- **API routes**: `src/app/api/<entity>/route.ts` hoặc `[id]/route.ts`
- **Hooks**: `src/lib/hooks/use-<entity>.ts`
- **Components**: `src/components/<feature>/<component-name>.tsx`
- **Services**: `src/lib/services/<name>.service.ts`
- **Repos**: `src/lib/supabase/repositories/<name>.repo.ts`
- **Mappers**: `src/lib/supabase/mappers/<name>.mapper.ts`

## 6. Stabilization Wave 1 (2026-04-10)

### Current phase
- Phase: Runtime and UI stabilization on top of the current refactor workspace.
- Priority order: fix 500 errors, fix CSS token drift, lock business regressions, then expand features.
- Primary runtime target: Vercel. Local polling and supervisor scripts stay as fallback for dev or self-host.

### Work completed in this wave
- Added client/server boundary guardrails:
  - `src/lib/supabase/admin.ts` and `src/lib/supabase/server.ts` now declare `server-only`.
  - `src/lib/utils/premium-accounts-helpers.ts` now declares `server-only`.
  - Added pure domain helpers in `src/lib/domain/premium-account-math.ts`.
- Fixed the real client runtime failure on premium migrations:
  - `src/widgets/pages/premium/migrations/page-client.tsx` now imports pure math helpers instead of the server helper that pulled `supabaseAdmin`.
- Fixed CSS token drift and added compatibility aliases:
  - Replaced missing token usage in order and bot settings UI.
  - Added temporary aliases in `src/app/globals.css` for `bg-base`, `surface-1`, `surface-base`, and `fg-primary`.
- Added repo quality guards:
  - `scripts/check-client-boundaries.mjs`
  - `scripts/check-css-tokens.mjs`
  - `scripts/runtime-smoke.mjs`
  - package scripts wired into `pretypecheck`, `pretest`, and `prebuild`.

### Verified facts to preserve
- `typecheck`, `lint`, and `build` were green before this stabilization wave.
- `qa-artifacts/visual-qa/report.json` showed a real runtime error on `/premium/migrations?status=pending` caused by a client import crossing into server-only code.
- `qa-artifacts/provider-flows-qa/report.json` showed the provider -> purchase-order flow was already visually clean.
- `test:e2e:smoke` can skip business smoke when `SUPABASE_TEST_EMAIL` and `SUPABASE_TEST_PASSWORD` are missing.

### Next focus
- Re-run the new guards and static gates after the code changes.
- Expand runtime smoke around dashboard, notifications, orders, premium, and bot status.
- Stabilize business validations before broad feature work.
