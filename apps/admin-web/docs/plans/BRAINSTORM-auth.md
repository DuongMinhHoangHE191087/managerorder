## 🧠 Brainstorm: Xác thực Đăng nhập & Phân quyền Admin

### Context
Trang quản lý (admin) hiện đang public, cần bổ sung xác thực (Authentication) bằng Google qua Supabase. Tuy nhiên, bất kỳ ai có tài khoản Google đều có thể đăng nhập được nếu chỉ bật Google OAuth đơn thuần. Do đó, cần thêm một lớp **Phân quyền (Authorization)** để chỉ cho phép các tài khoản do BẠN (chủ hệ thống) cấp quyền mới có thể truy cập. Nếu tài khoản không có quyền, hệ thống sẽ từ chối.

Dưới đây là 3 phương án để giải quyết vấn đề phân quyền này:

---

### Option A: Danh sách trắng bằng Biến môi trường (Environment Variables)
Sử dụng một biến môi trường (ví dụ: `ALLOWED_EMAILS=myemail@gmail.com,other@gmail.com`) để kiểm tra sau khi user đăng nhập.

✅ **Pros:**
- Rất dễ triển khai (không cần tạo thêm table trong database).
- An toàn tuyệt đối ở cấp source code.
- Nhanh chóng, không làm châm tốc độ login.

❌ **Cons:**
- Mỗi lần muốn cấp quyền cho người mới, bạn phải sửa file `.env` và deploy lại ứng dụng.
- Khó quản lý nếu số lượng người dùng lớn (tuy nhiên với trang quản lý nội bộ thì thường ít người).

📊 **Effort:** Low

---

### Option B: Bảng phân quyền trong Database (`admin_users`)
Tạo một bảng `admin_users` (hoặc `user_roles`) trong Supabase. Khi một tài khoản Google đăng nhập thành công, Middleware sẽ kiểm tra email/UID đó có nằm trong bảng này không. Bạn có thể dùng giao diện (hoặc trực tiếp qua Supabase Dashboard) để thêm/sửa/xoá người được cấp quyền.

✅ **Pros:**
- Rất linh hoạt, thêm/bớt quyền ngay lập tức mà không cần deploy lại.
- Dễ dàng mở rộng sau này (ví dụ: cấp quyền 'Viewer', 'Editor', 'SuperAdmin').

❌ **Cons:**
- Tốn thêm 1 truy vấn database khi kiểm tra quyền (có thể cache lại để tối ưu).
- Cần tạo bảng mới trong database Supabase.

📊 **Effort:** Medium

---

### Option C: Sử dụng Supabase Custom Claims / Trigger
Sử dụng tính năng `auth.users` của Supabase kết hợp với một SQL Trigger. Khi user tạo tài khoản, Trigger sẽ kiểm tra và gán một vai trò (ví dụ: `role: admin`) vào JWT (app_metadata).

✅ **Pros:**
- Tối ưu cực tốt vì quyền (role) nằm thẳng trong token (JWT) của người dùng.
- Không cần gọi truy vấn Database ở Middleware (kiểm tra token là tự biết quyền).

❌ **Cons:**
-Cần phải viết SQL cho Supabase Trigger (đòi hỏi kỹ thuật cao hơn).
- Giao diện quản lý quyền có  phần phức tạp hơn (nếu cập nhật quyền, user thường phải đăng xuất và đăng nhập lại mới nhận JWT mới).

📊 **Effort:** High

---

## 💡 Recommendation

**Option B (Bảng phân quyền trong Database)** là phương án tối ưu nhất. Lý do: Nó cân bằng giữa khả năng mở rộng (thêm/bớt tuỳ ý bất cứ lúc nào qua trang giao diện hoặc Supabase Studio) và dễ bảo trì code trong Next.js (Middleware).

Bạn nghĩ sao về lựa chọn này?
