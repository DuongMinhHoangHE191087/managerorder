# Deployment Guide - ManagerOrder

> Vercel + Supabase + Bot runtime + short-link public flow

## 1. Yêu cầu

| Thành phần | Provider | Mục đích |
|------------|----------|----------|
| Hosting | Vercel | Deploy Next.js runtime |
| Database | Supabase | PostgreSQL + Auth + Storage |
| Bot | Telegram / Zalo | Nhận thông báo và phản hồi |
| Public short-link | App Router + middleware | Redirect hoặc landing public |

## 2. Build commands

```bash
npm install
npm run typecheck
npm test
npm run build
```

## 3. Environment variables

### 3.1 Bắt buộc

| Variable | Mô tả |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `JWT_SECRET` | JWT secret cho middleware và smoke auth |
| `ADMIN_SECRET_KEY` | Khóa truy cập màn hình admin/login |

### 3.2 Bot runtime

| Variable | Mô tả |
|----------|-------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_ADMIN_CHAT_ID` hoặc `TELEGRAM_CHAT_ID` | Chat nhận cảnh báo |
| `TELEGRAM_WEBHOOK_SECRET` | Secret webhook Telegram |
| `ZALO_BOT_TOKEN` | Token bot Zalo |
| `ZALO_BOT_ACCOUNT_ID` | Tenant bot Zalo |
| `ADMIN_ZALO_USER_IDS` | Danh sách admin Zalo nhận cảnh báo |

### 3.3 Short-link public landing

| Variable | Mô tả | Mặc định |
|----------|-------|----------|
| `SHORT_LINK_PUBLIC_LANDING_ENABLED` | Bật/tắt landing public | `true` |
| `SHORT_LINK_FORCE_DIRECT_REDIRECT` | Rollback flag, ép toàn bộ link về redirect trực tiếp | `false` |

## 4. Database rollout

### 4.1 Migration bắt buộc cho short-link landing

Áp dụng migration sau trước khi deploy code:

- [20260413120000_short_link_delivery_modes.sql](/D:/GITHUB/managerorder/premium-admin-web/supabase/migrations/20260413120000_short_link_delivery_modes.sql)

Migration này thêm:

- `sales_channels.default_delivery_mode`
- `sales_channels.default_landing_template_key`
- `short_links.sales_channel_id`
- `short_links.delivery_mode`
- `short_links.landing_template_key`
- `short_links.locked_ipv6`
- `short_link_clicks.event_type`

### 4.2 Schema cache

Nếu environment đang dùng PostgREST schema cache cũ, cần refresh cache sau migration.
Nếu không, runtime sẽ lỗi kiểu:

```text
Could not find the 'delivery_mode' column of 'short_links' in the schema cache
```

## 5. Verification commands

```bash
npm run typecheck
npm test
npm run build
npm run smoke:runtime
npm run check:short-link-schema
npm run smoke:short-links
npm run qa:visual
```

Nếu bạn có `SUPABASE_ACCESS_TOKEN` dạng Personal Access Token cho Supabase Management API, có thể apply migration ngay từ repo:

```bash
npm run db:apply-short-link-migration
```

## 6. Thứ tự deploy an toàn

1. Apply schema migration.
2. Refresh schema cache nếu cần.
3. Deploy app code.
4. Chạy `npm run smoke:runtime`.
5. Chạy `npm run check:short-link-schema`.
6. Chạy `npm run smoke:short-links`.
7. Chạy `npm run qa:visual`.

Nếu có `SUPABASE_ACCESS_TOKEN`, bước 1 có thể dùng `npm run db:apply-short-link-migration`.

## 7. Rollback nhanh cho short-link landing

Nếu landing public gây lỗi nhưng không muốn rollback toàn bộ app:

1. Set `SHORT_LINK_FORCE_DIRECT_REDIRECT=true`
2. Restart runtime hoặc redeploy
3. Chạy lại `npm run smoke:short-links`
4. Xác nhận các link `landing_page` đã fallback về redirect trực tiếp

## 8. Checklist phát hành

- [ ] Env bắt buộc đã cấu hình đúng
- [ ] Migration đã chạy xong
- [ ] Schema cache đã refresh nếu cần
- [ ] `npm run typecheck` pass
- [ ] `npm test` pass
- [ ] `npm run build` pass
- [ ] `npm run smoke:runtime` pass
- [ ] `npm run check:short-link-schema` pass
- [ ] `npm run smoke:short-links` pass
- [ ] `npm run qa:visual` pass
- [ ] `/api/settings/bot/status` còn heartbeat hợp lệ

## 9. Tài liệu liên quan

- [SHORT_LINK_RELEASE_CHECKLIST.md](/D:/GITHUB/managerorder/premium-admin-web/docs/05-verification/SHORT_LINK_RELEASE_CHECKLIST.md)

## 10. Current release order

Use [RELEASE-READINESS.md](/D:/GITHUB/managerorder/premium-admin-web/docs/RELEASE-READINESS.md) as the canonical deploy/migration checklist for the current release train.
