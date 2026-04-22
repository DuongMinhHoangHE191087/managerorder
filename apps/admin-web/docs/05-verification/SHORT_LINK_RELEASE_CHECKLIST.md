# Short-Link Release Checklist

## 1. Schema gate

- [ ] Đã apply migration [20260413120000_short_link_delivery_modes.sql](/D:/GITHUB/managerorder/premium-admin-web/supabase/migrations/20260413120000_short_link_delivery_modes.sql)
- [ ] Đã refresh PostgREST schema cache nếu environment còn cache cũ
- [ ] `npm run check:short-link-schema` pass
- [ ] Nếu dùng Supabase Management API, đã set `SUPABASE_ACCESS_TOKEN` và `npm run db:apply-short-link-migration` pass

## 2. Runtime gate

- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` hợp lệ
- [ ] `SHORT_LINK_FORCE_DIRECT_REDIRECT` đang tắt nếu muốn bật landing
- [ ] Runtime preview hoặc production đang truy cập được

## 3. Verification commands

```bash
npm run typecheck
npm test
npm run build
npm run smoke:runtime
npm run check:short-link-schema
npm run smoke:short-links
npm run qa:visual
```

## 4. Business checks

- [ ] Tạo `sales channel` mặc định `landing_page + ctv_neutral`
- [ ] Tạo short-link `inherit_channel`
- [ ] `GET /api/short-links/:id` trả `resolvedPolicy.effectiveDeliveryMode = landing_page`
- [ ] `GET /s/[slug]` render landing page
- [ ] `GET /s/[slug]/go` redirect 302 tới `target_url`
- [ ] Crawler preview không lộ `target_url`
- [ ] Link `direct_redirect` vẫn redirect ngay
- [ ] Sai token hoặc sai IP vẫn bị chặn

## 5. Rollback plan

1. Set `SHORT_LINK_FORCE_DIRECT_REDIRECT=true`
2. Restart runtime hoặc redeploy
3. Chạy lại `npm run smoke:short-links`
4. Xác nhận short-link `landing_page` đã fallback về redirect trực tiếp

## 6. Exit criteria

- [ ] Không còn lỗi thiếu column `delivery_mode`, `landing_template_key`, `event_type`
- [ ] Không có regression ở `/api/settings/bot/status`
- [ ] Public flow đã được verify trên runtime thật
