## 🧠 Brainstorm: Xây dựng Premium Module UI với Supabase Data

### Context
User yêu cầu kết nối 5 trang Premium (`/premium/services`, `/premium/accounts`, `/premium/subscriptions`, `/premium/renewals`, `/premium/migrations`) bằng API thật sử dụng Supabase. Yêu cầu đặc biệt là nâng cấp UI/UX theo tiêu chuẩn "ui-ux-pro-max" (đẹp, chuyên nghiệp, không glassmorphism mờ nhạt làm khó nhìn, hiệu ứng tương tác mượt mà).

---

### Nguyên Tắc UI/UX Chung (Dựa theo ui-ux-pro-max & User Preferences)
- **Data Table:** Thiết kế bảng dữ liệu sạch sẽ, border rõ ràng, phân trang/scroll ngang chuẩn. Không dùng background glassmorphism quá mờ gây khó đọc chữ. Dùng nền trắng (`bg-white dark:bg-slate-900`) hoặc xám siêu nhạt cho Card.
- **Trạng Thái Mạng (Loading):** Khi fetch API hoặc tìm kiếm, phải có hiệu ứng Skeleton loading hoặc Spinner. Search thì delay 0.5s (debounce) rồi mới loading (như yêu cầu trước).
- **Phân Cấp Thị Giác (Visual Hierarchy):** Các chỉ số quan trọng (Card thống kê) to, in đậm, phối màu chuẩn (màu xanh rủi ro thấp, cam rủi ro vừa, đỏ nguy hiểm/alert).
- **Tương tác:** Thêm Hover card, active states, button scale click.

---

### Phân Tích Component & API Từng Trang

#### 1. Premium Services (`/premium/services`)
- **Nghiệp vụ:** CRUD `premium_service_types` (ChatGPT, Netflix,...).
- **API File:** `src/app/api/premium/services/route.ts` & `[id]/route.ts`.
- **UI:** Bảng grid danh sách dịch vụ hoặc bảng List. Hiển thị Logo, Tên, Category, Active Status. Nút Tạo Mới gọi Modal.

#### 2. Premium Accounts (`/premium/accounts`)
- **Nghiệp vụ:** Quản lý kho tài khoản gốc (`premium_accounts`), liên kết với service.
- **API File:** `src/app/api/premium/accounts/route.ts` & `[id]/route.ts`.
- **UI:** Master-Detail view. Danh sách Acc hiển thị Email, Slots (Dùng/Tổng), Tỉ lệ lấp đầy Progress Bar, Hạn. Click vào xem chi tiết danh sách users bên trong (`premium_account_users`).

#### 3. Premium Subscriptions (`/premium/subscriptions`)
- **Nghiệp vụ:** Quản lý khách hàng mua dịch vụ (`customer_premium_subscriptions`).
- **API File:** `src/app/api/premium/subscriptions/route.ts`.
- **UI:** Bảng dữ liệu Khách Hàng -> Account chia sẻ. Nút "Chỉ định Account" (Assign Slot). Hiển thị số ngày còn lại (Days Remaining) với màu cảnh báo.

#### 4. Premium Renewals & Migrations
- **Nghiệp vụ:** Xử lý gia hạn và chuyển đổi account bị sập. Bảng Queue.
- **API:** Phức tạp hơn, tương tác nhiều bảng (`subscription_renewals`, `account_migrations`).
- **UI:** Kanban board hoặc Table có Action Button rõ ràng (Chấp nhận gia hạn, Hủy, Đổi Acc).

---

### Lộ trình Code Hiện Tại (Execution Plan)

- **Bước 1 (Backend - 2h):** Tạo nhanh bộ 5 API folders trong `src/app/api/premium/...`. Dùng `supabaseAdmin` client.
- **Bước 2 (Types - 30m):** Định nghĩa Type Interface trong `src/lib/domain/premium-types.ts` ánh xạ với Supabase schema.
- **Bước 3 (Frontend Fetching - 1h):** Viết custom hook hoặc dùng `useEffect` (tuân thủ nguyên tắc Clean Code) để lấy dữ liệu.
- **Bước 4 (Refine UI - 2h):** Chạy lệnh refactor UI các trang đang dùng Mock Data thành trang dùng Data thật với Form Modal chuẩn. Nhúng các helper Component từ `ui-ux-pro-max`.

## 💡 Recommendation
Cách tốt nhất là đi theo luồng: **Types -> API API Routes -> Cắm API vào `<PremiumServicesPage />` (Trang gốc dễ nhất)** để xây dựng base UI chuẩn. Sau đó nhân bản Component Table/Modal cho 4 trang còn lại.
