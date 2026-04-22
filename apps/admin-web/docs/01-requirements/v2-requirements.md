# 📋 Yêu Cầu Nghiệp Vụ - Giai Đoạn 2 (V2 Requirements)

**Trạng thái:** Đã chốt (Approved)
**Ngày lập:** Lấy thời điểm hiện tại

---

## 🧭 1. Executive Summary

Giai đoạn 2 của hệ thống Quản Lý Premium Admin tập trung vào **5 mục tiêu chính** đã được thống nhất với Business Owner:

1. **Lưu trữ CSDL bằng Supabase (Persistence)**:
   - Dùng 100% Supabase client thay thế cho in-memory.
   - Loại bỏ hoàn toàn Prisma ORM. Hệ thống sẽ thiết kế Database Schema trực tiếp trên Supabase / PostgreSQL.
2. **Khách hàng Đa Liên Hệ (Multi-Channel Contacts)**:
   - Một khách hàng cho phép lưu **lên đến 10 liên hệ** (ví dụ: FB 1, Zalo, FB 2, SĐT, Email...).
   - Input cho phép nhập nội dung tự do theo từng kênh.
   - Giao diện có nút Thêm Liên Hệ (Add Contact).
   - Riêng với thẻ "Facebook", bên cạnh sẽ hiện thêm 1 nút **"Verify"** (tương lai sẽ gọi API lấy UID).
3. **Lịch dùng chung & UI/UX theo mẫu**:
   - Tái sử dụng thiết kế UI Calendar từ thư mục `code.html` cũ, tuỳ biến với Tailwind CSS.
   - Lịch dùng chung (Shared) cho cả team.
   - Nhấn đúp (Double click) vào ngày bất kỳ sẽ bật Form "Thêm sự kiện" chọn sẵn ngày đó.
   - Giao diện Mobile: Mặc định hiển thị chế độ "Ngày" (Day View) để dễ thao tác.
4. **Thông báo Telegram Bot (Nhắc việc)**:
   - Gửi vào **Group chung** của team.
   - Chạy theo lịch Cron: **8h sáng** và **10h tối**.
   - Nội dung nhắc: Lịch trình ngày tiếp theo, số khách chưa thanh toán hôm đó, và danh sách khách cần nhắc gia hạn.
5. **Sửa lỗi Inventory (Thêm kho hàng)**:
   - Fix lỗi form thêm tài khoản trong module Quản lý Kho hiện đang không hoạt động.
   - Nâng cấp hiển thị: Các kho hàng bắt buộc hiển thị số slot realtime (thực tế từ Database).

---

## 🎭 2. User Stories (Chi Tiết Chức Năng)

### 💾 Epic 1: Supabase Migration
- **US-01.1:** Là Admin, tôi muốn toàn bộ Database chuyển sang Supabase và xóa toàn bộ thư viện Prisma ORM để tối ưu chi phí và theo một chuẩn duy nhất.
- **US-01.2:** Là Server, các API (/api/orders, /api/customers,...) trả về và lưu dữ liệu bằng Supabase client thay vì chọc vào code in-memory.

### 👥 Epic 2: Khách Hàng Đa Liên Hệ
- **US-02.1:** Là Sales, khi tạo hoặc sửa thông tin Khách hàng, tôi có một mục Liên Hệ. Tôi có thể bấm nút "+" để thêm phương thức liên hệ (chọn loại kênh: Zalo, FB, Tele, v.v.) và gõ tự do nội dung (sdt, link, handle).
- **US-02.2:** Tôi có thể thêm tối đa 10 kênh liên hệ cho 1 khách.
- **US-02.3:** Nếu loại kênh là "Facebook", UI tự động hiển thị nút "Verify" bên cạnh ô input để phục vụ tính năng mở rộng trong tương lai.

### 📅 Epic 3: Giao diện Lịch (Calendar) Team
- **US-03.1:** Là Sales, tôi xem Lịch Chung của team theo Tháng/Tuần/Ngày. Nếu dùng điện thoại, lịch tự thu về góc nhìn Ngày (Day View).
- **US-03.2:** Tôi double-click vào 1 ngày bất kỳ, một modal tạo Lịch hẹn sẽ hiện ra và mốc thời gian tự điền là ngày tôi đã nhấn.

### 🔔 Epic 4: Telegram Automation (Tương lai/Kế tiếp)
- **US-04.1:** Vào 8h sáng, Bot tổng hợp và nhắn vào Group Telegram chung: "Lịch hẹn hôm nay: X; Còn Y khách chưa thanh toán".
- **US-04.2:** Tương tự vào lúc 22h đêm, nhắc lại số công nợ hoặc các acc sắp hết hạn vào ngày mai.

### 📦 Epic 5: Inventory Bug Fix
- **US-05.1:** Là Quản lý Kho, tôi bật form Thêm Tài Khoản Kho mới và lưu bình thường.
- **US-05.2:** Ở trang tạo đơn, dropdown chọn Kho hiển thị số Slot thực tế lấy trực tiếp từ csdl chứ không hiển thị sai lệch.

---

## 🏗 3. Ràng buộc Kỹ thuật (Constraints)
- Chỉ sử dụng Supabase (PostgreSQL + RLS Auth nếu cần).
- Xóa file `schema.prisma`, tháo package `@prisma/client`.
- Sử dụng UI components đã xây dựng: Lucide React, CSS variables. 
- Mẫu Calendar lấy cảm hứng từ tài nguyên HTML thiết kế sẵn trước đó.
