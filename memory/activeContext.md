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
