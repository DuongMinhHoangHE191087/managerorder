# Kế hoạch Triển khai: Option A & Cải Tiến Toàn Diện Siêu Phẩm
Ngày lập kế hoạch: 05-03-2026
Mô hình quy chiếu: `ui-ux-pro-max` (Premium Aesthetic, Vercel Accessibility & Motion Standards)

## Mục Tiêu (Goal)
Áp dụng Option A (Dynamic Single-page Cart) cho Module Quản lý Đơn Hàng. Tái thiết kế toàn bộ các trang Quản lý Sản Phẩm, Kho Hàng, Hồ sơ Khách Hàng và CRM Calendar dựa trên layout mẫu của user để thành những màn hình "Siêu phẩm" UX/UI.

---

## Task Breakdown (Chi Tiết Công Việc)

### Task 1: Định hình Type Data & In-Memory Store
Tiếp tục quản lý trạng thái bằng `in-memory.ts`, cần cập nhật Model Types để phục vụ cho giao diện mới:
- Thiết kế lại `Order` schema: Cho phép chứa mảng `orderItems: { productId, note, inventoryId, quantity=1 }`.
- Thêm model `Event` để phục vụ ứng dụng Lịch (Calendar).

### Task 2: Siêu phẩm Form Tạo Đơn Hàng (Orders/New)
Triển khai kỹ thuật Option A (Data-Entry Speed):
1. **Search Customer Combo-Box**: Ứng dụng `cmdk` kết hợp `lucide-react` và `Framer Motion` (Popover) tìm khách hàng, cho phép chọn hoặc tạo ngay Popover.
2. **Product Search & Cart Engine**: Input Auto-complete rớt nhanh các Component "Product Card" xuống giỏ hàng bên dưới.
3. **Cart Item UI**: 
   - Không cho phép chỉnh sửa Quantity (cố định = 1).
   - Có Select/Combo lấy danh sách Kho hàng tương ứng với Sản phẩm (`filter bằng productId`).
   - Khung `Textarea` sang trọng ghi chú riêng cho Item.
   - Các Items có thể Drag & Drop hoặc chí ít có nút xoá mượt mà (Fade/Slide exit animation).

### Task 3: Ứng dụng Quản lý Khách hàng (Customer Profile)
- Add "Add New Customer" Trigger lên trên Header `customers/page.tsx`.
- Tuân thủ thiết kế hồ sơ (giống bản `code.html` Customer Profile) để xem chi phí Customer LTV (Lifetime value) & Active Subscriptions.

### Task 4: Module Quản lý Sản Phẩm (Products)
- Tạo bảng `DataTable` Product có hiển thị `Profit Margin` & `Giá Nhập/Xuất` với Format Number cực chuẩn (sử dụng feature `tabular-nums` đã được setting tại CSS).

### Task 5: Module Kho Lữu Trữ (Inventory)
- Cập nhật trang `inventory/page`.
- Component: Tạo thanh **Progress Bar** cực nghệ thuật làm nổi khối Data Slot Usage của từng account (ví dụ: dùng 4/6 slot Youtube Family \-> Progressbar màu Xanh, 6/6 \-> Red Full). 

### Task 6: Calendar CRM Widget
- Ứng dụng Calendar Grid thông minh. View hiển thị "Due for Renewal" ngay bên cạnh giúp Sale/Admin re-sub cho các user sắp hết hạn tài khoản.

---

## Agent Assignments

- **Frontend Specialist / Orchestrator**: Tham gia trực tiếp nâng cấp thư mục `src/components`, tái sử dụng `SlideUp` và `GlassHoverCard`. Xây dựng logic `react-hook-form` xử lý dữ liệu Form Option A. Tuân thủ `web-design-guidelines`.

---

## Verification Checklist (Chỉ dẫn nghiệm thu UX/UI Pro Max)

- [ ] (Visual Quality) Toàn bộ icon đều là SVG Lucide-react (không Emojis). 
- [ ] (Interaction) Toàn bộ các Item trong giỏ hàng (Cart Items) đều có hover focus `cursor-pointer` (và Ring-2 focus-visible).
- [ ] (Accessibility) Vận hành hoàn hảo trạng thái Dark Mode (Border Soft contrast lớn). 
- [ ] Tính năng tìm kiếm Input chạy real-time trong Form không Submit Form oan uổng. Mượt và Data phản hồi tốt (Dùng useMemo và Filter nội bộ DB tĩnh).

---

> Dành cho User:
> *Hãy đánh "Proceed" hoặc "/create" hoặc yêu cầu "Thực hiện ngay" để tôi chuyển sang chế độ EXECUTION viết code thật nhé!*
