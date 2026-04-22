# Kế hoạch Nâng cấp và Tái cấu trúc (PLAN-admin-upgrade)

## MÔ TẢ MỤC TIÊU
Thực hiện quá trình đại tu kiến trúc, bảo mật và hiệu năng cho hệ thống `premium-admin-web` theo đánh giá tổng quan, tập trung vào 5 lỗ hổng Critical/High và chuẩn bị cơ sở cho việc scale hệ thống một cách an toàn (SaaS multi-tenant production-grade).

## PHÂN CÔNG AI AGENTS (THE SQUAD)
- **Red Team / Security Auditor**: Xử lý rò rỉ dữ liệu, RLS bypass, Google OAuth, Public Endpoints.
- **Backend Architect**: Chuyên tái thiết thế trận Telegram Bot, tách layer cho `system_settings`.
- **Database Optimizer**: Chuyển Rate Limit / Caching sang Redis; Fix cấu trúc Event Bus / Webhook.
- **QA / Self-Healing**: Thêm Automated test coverage cho các boundary sau khi refactor.

---

## 🛠 DANH SÁCH TÁC VỤ (TASK BREAKDOWN)

### Giai đoạn 1: Bịt Lỗ Hổng Kế Cấp (Critical Security Fixes) - 🔴 Ưu tiên Cao nhất
1. **Sửa lỗi Google OAuth State Manipulation**
   - *Vấn đề:* Kẻ gian có thể overwrite token của tenant khác do OAuth không verify `state`.
   - *Action:* Triển khai tạo (gen) nonce signed bằng Redis/Server Session. Validate state ở Callback. Chỉ insert/update với quyền của Admin đang đăng nhập.
2. **Ngăn chặn Bypass thư viện `system_settings` (Cross-Tenant Leak)**
   - *Vấn đề:* Load settings bằng `service_role` thiếu `account_id`.
   - *Action:* Wrapper lại các hàm call Supabase của Settings. Bắt buộc filter query theo `account_id` hoặc chuyển logic hoàn toàn qua RLS với session xác thực.
3. **Đóng Endpoints "Đi Cửa Sau" (Public Setup/Cron)**
   - *Vấn đề:* Các route `/api/telegram/setup`, `/api/telegram/webhook` (GET) và các endpoint migrate/cron không check bảo mật đủ mạnh (dễ brute-force, không dùng HTTPS auth header).
   - *Action:* Chặn public access. Thiết lập Internal Job / X-Internal-Token và chuyển GET webhook tools đằng sau check Admin auth.

### Giai đoạn 2: Architecture & Contract Drift Resolution - 🟡 Ưu tiên Trung bình-Cao
4. **Hợp nhất Schema cho Webhook và Hệ thống Event**
   - *Vấn đề:* Lệch schema giữa UI, event bus và migration/DB config (`webhooks` vs `webhook_endpoints`).
   - *Action:* Dọn dẹp/Delete bảng cũ, generate DB TypeScript Interfaces mới nhất và ép toàn bộ luồng bắn hook, lưu lịch sử, frontend form... sử dụng một source-of-truth.
5. **Nâng cấp Hiệu năng Session & Rate-Limiter (Sang Redis)**
   - *Vấn đề:* Bộ đệm RateLimiter hiện tại làm In-Memory. Nếu deploy multi-pods sẽ tạch, dễ Spam Bot.
   - *Action:* Update module rate-limiter và Telegram Session sang dùng Redis (Upstash). 

### Giai đoạn 3: Tái cấu trúc Telegram Bot Module - 🟢 Refactor Toàn diện
6. **Tháo rời khối Monolithic `telegram-bot.service.ts`**
   - *Vấn đề:* File quá to, gánh nhiều nghiệp vụ, khó maintain và hay bị trộn `secret`.
   - *Action:* Tách ra thành các Sub-modules:
     - `auth.ts` (Check whitelist, Anti-spam)
     - `router.ts` (Routing theo regex/cú pháp)
     - `orders.ts` & `inventory.ts` (Handlers)
7. **Xoá Test Môi trường (NEXT_PUBLIC_TEST_ACCOUNT_ID)**
   - Khóa strict môi trường `production`, không sử dụng account ảo public trên production code.

### Giai đoạn 4: Quality of Life & UI/UX Audit
8. **Fix Orders Date Filter UX**
   - Nối DatePicker component vào react-query `useOrders` hooks.
9. **Xóa Mock Analytics Data**
   - Chuyển trang Dashboard / Khảo sát Metric qua số liệu DB thực.

---

## 🛑 SOCRATIC GATE (Câu hỏi rà soát cho người quản lý)

1. Để triển khai **Rate Limiting / Caching theo phương án scale** cho bot, dự án đã có sẳn tài khoản/kết nối Redis (như Upstash) chưa? (Hay bạn muốn mình init bằng Supabase/PG caching session trước)?
2. Quá trình chia nhỏ và generate lại Type cho `webhooks` có thể làm ảnh hưởng các webhook đang chạy ngầm của dự án hay không? Có cần downtime maintenance?
3. Với `NEXT_PUBLIC_TEST_ACCOUNT_ID`, khi chúng ta xóa, tính năng fallback cho dev của các bạn có bị kẹt không? (Có cần cấu hình môi trường development riêng biệt?).
