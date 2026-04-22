# Kế hoạch Triển khai (PLAN): Xác thực Trang Quản Lý (Admin Auth)

Căn cứ theo yêu cầu bảo mật hệ thống quản trị, chúng tôi sẽ lập kế hoạch xây dựng tính năng Xác thực bằng Google qua Supabase.

## 1. Yêu cầu Hệ thống
- Tích hợp Supabase Auth với Provider: Google.
- Xác thực (Authentication): Người dùng buộc phải đăng nhập.
- Phân quyền (Authorization): Chỉ những tài khoản được cấp phép mới được truy cập hệ thống. Các tài khoản khác sẽ bị chặn và thông báo lỗi.
- Ẩn toàn bộ hệ thống đằng sau bức tường bảo vệ (Middleware) của Next.js (chỉ chừa lại các route như trang Login hoặc public callbacks).

## 2. Các Bước Triển khai

### Phase 1: Cấu hình Supabase & Thư viện
- Cài đặt / Kiểm tra package `@supabase/ssr` và `@supabase/supabase-js`.
- Cài đặt tiện ích Supabase server client (utils/supabase/server.ts, client.ts) tuân thủ chuẩn mới của App Router Next.js 14/15.
- Xác nhận các biến môi trường (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) đã đúng.

### Phase 2: Giao diện Đăng Nhập (Login Page)
- **Tạo trang `/login`**: Đây sẽ là trang duy nhất public.
- Dùng UI đẹp (có thể sử dụng thư viện UI hiện có, dark mode) để hiển thị nút "Sign in with Google".
- Xử lý hành động callback của Supabase: `/api/auth/callback` thực thi quá trình chuyển đổi ticket thành session.

### Phase 3: Lớp bảo vệ Middleware (Phân quyền & Chặn người dùng lạ)
- **Tạo `middleware.ts`**: Bắt buộc mọi Request vào hệ thống (trừ `/login` và các file public/assets) đều phải có Session hợp lệ.
- **Tích hợp logic Phân quyền (Authorization)** (Tuỳ thuộc vào quyết định từ Brainstorming):
  - Ví dụ: middleware kiểm tra nếu Session email nằm trong Database `admin_users` -> Allow. Ngược lại -> Redirect sang trang báo lỗi Unauthorized.

### Phase 4: Thiết lập Phân quyền trong Database 
- (Nếu chọn Option B từ Brainstorm): 
  - Tạo Table `admin_users` chứa `email` và `role`.
  - Bạn (chủ hệ thống) sẽ add email của Bạn vào đó qua Supabase Studio.

### Phase 5: Giao diện Chặn người ngoài / Unauthorized
- Tạo Component/Fragment hiển thị cho những Google users không có quyền quản lý (để tránh trường hợp họ bị vòng lặp vô tận đăng nhập - đá ra - đăng nhập).
- Nút "Logout" ở trang Admin và trang Unauthorized.

## 3. Danh sách Công việc (Checklist)
- [ ] Xác nhận phương án Phân quyền từ phía người dùng (Brainstorming).
- [ ] Khởi tạo Supabase client files (SSR).
- [ ] Xây dựng UI trang login.
- [ ] Cài đặt Route handler `/api/auth/callback`.
- [ ] Triển khai Middleware phân quyền.
- [ ] Chỉnh sửa layout chính (Main Layout): tích hợp kiểm tra session bảo mật.
- [ ] Cập nhật UI Header: Nút Logout.

## 4. Agent Setup
- **Agent Roles**: Sẽ sử dụng `Security Armor` để tuân thủ tính bảo mật JWT & Auth, kết hợp `Frontend Developer` để xây dựng UI Auth Login hiện đại. 
