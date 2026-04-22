# 📋 Yêu cầu Nâng cấp UI/UX & Nghiệp vụ Toàn diện
> **Phiên bản:** 1.0 | **Ngày:** 2026-03-06 | **Người yêu cầu:** Admin System Owner

---

## 1. Executive Summary

Nâng cấp toàn diện UI/UX và nghiệp vụ phần mềm cho hệ thống Admin `premium-admin-web`, với **mục tiêu kép**:
1. **Cải thiện thẩm mỹ** – Phong cách "Ultra-Modern Glass & Glow" kết hợp Bento Box layout
2. **Tăng hiệu suất vận hành** – Giảm số bước thao tác, tăng mật độ thông tin có thể xem/thao tác trong 1 màn hình

> **Phạm vi:** Chỉ thao tác UI/UX (không thay đổi API backend, không thay đổi DB schema).

---

## 2. User Personas

| Persona | Vai trò | Thiết bị chính | Nhu cầu cốt lõi |
|---------|---------|----------------|-----------------|
| **Admin quản lý** | Quản lý cấp cao | Desktop 1440px | Xem tổng quan nhanh, xuất báo cáo |
| **Vận hành đơn hàng** | Nhân viên | Desktop 1280px | Ghi đơn nhanh, update trạng thái hàng loạt |
| **Mobile check** | Cả hai | Mobile 390px | Xem nhanh số liệu, tạo đơn cơ bản |

---

## 3. Pain Points Hiện Tại

| Trang | Vấn đề | Mức độ |
|-------|---------|--------|
| Tất cả | Bảng dữ liệu không có page size selector, không có phân trang thực | 🔴 Critical |
| Tạo đơn hàng | Phải thoát ra tạo khách hàng/sản phẩm rồi quay lại chọn | 🔴 Critical |
| Đơn hàng | Không tìm kiếm được theo tên khách, không lọc theo hạn | 🟡 High |
| Khách hàng | Không thấy ngay tình trạng hạn thanh toán / công nợ quá hạn | 🟡 High |
| Dashboard | Thiếu panel cảnh báo khách hàng sắp hết hạn / quá hạn | 🟡 High |
| Tất cả | Không có Micro-interactions mượt mà với Framer Motion | 🟢 Medium |

---

## 4. Yêu cầu Chức năng (Functional Requirements)

### 4.1 Data Table – Page Size & Pagination (ALL PAGES)

| ID | User Story | Acceptance Criteria |
|----|------------|---------------------|
| US-001 | Là admin, tôi muốn chọn số hàng hiển thị (20/50/100/500) để kiểm soát lượng dữ liệu | Có dropdown chọn 20/50/100/500 ở footer bảng |
| US-002 | Là admin, tôi muốn phân trang khi vượt quá số hàng đã chọn | Có nút Trước/Sau và số trang |
| US-003 | Khi cuộn xuống quá số lượng yêu cầu, hiển thị phân trang chuyển trang | Load dữ liệu tiếp theo theo trang |

### 4.2 Smart Customer/Product Selector (Orders Page & New Order Form)

| ID | User Story | Acceptance Criteria |
|----|------------|---------------------|
| US-010 | Khi tạo/sửa đơn, tôi muốn tìm khách hàng và tạo ngay nếu chưa có | Search combobox khách hàng + nút "Tạo khách hàng mới" mở modal inline |
| US-011 | Danh sách khách hàng trong combobox ưu tiên hiển thị khách hàng mới nhất | Sorted by `created_at DESC` |
| US-012 | Khi tạo/sửa đơn, tôi muốn tìm sản phẩm và tạo ngay nếu chưa có | Search combobox sản phẩm + nút "Tạo sản phẩm mới" mở modal inline |

### 4.3 Payment Due & Renewal Workflow (Customers Page)

| ID | User Story | Acceptance Criteria |
|----|------------|---------------------|
| US-020 | Tôi muốn thấy ngay tình trạng hạn thanh toán của từng khách hàng trong danh sách | Cột "Hạn thanh toán" với badge màu: AN TOÀN (xanh) / SẮP HẾT HẠN (cam) / QUÁ HẠN (đỏ) |
| US-021 | Tôi muốn gia hạn thanh toán cho khách hàng trực tiếp từ danh sách | Nút "Gia hạn" trong action menu, mở drawer với form nhập ngày gia hạn |
| US-022 | Tôi muốn xem tổng số khách hàng có tình trạng nguy hiểm trên dashboard | KPI card mới "Khách cần xử lý" trên Dashboard |

### 4.4 Dashboard Enhancement

| ID | User Story | Acceptance Criteria |
|----|------------|---------------------|
| US-030 | Tôi muốn xem panel cảnh báo khách hàng sắp hết hạn hoặc quá hạn | Section "Cần Xử Lý Ngay" với list khách hàng, link đến profile |
| US-031 | Tôi muốn xem đơn hàng cần xử lý (pending_payment) trực tiếp từ dashboard | Panel "Đơn hàng chờ" với action nhanh cập nhật trạng thái |
| US-032 | Tôi muốn có Quick Actions để tạo đơn/thêm khách hàng ngay từ dashboard | Bento block "Quick Actions" với các shortcut buttons |

### 4.5 Orders Page Enhancement

| ID | User Story | Acceptance Criteria |
|----|------------|---------------------|
| US-040 | Tôi muốn tìm kiếm đơn hàng theo tên khách hàng (live search, debounce 300ms) | Search input hoạt động thực sự với debounce, filter on client |
| US-041 | Tôi muốn xem/sửa ngày hết hạn (expires_at) của đơn ngay trong drawer | Cột "Ngày HH" trong bảng + form gia hạn trong drawer chi tiết đơn |
| US-042 | Tôi muốn đổi trạng thái nhiều đơn hàng một lúc (Bulk Actions) | Checkbox đầu mỗi hàng + action bar nổi khi có hàng được chọn |

---

## 5. Yêu cầu Phi chức năng (Non-Functional Requirements)

| Yêu cầu | Chi tiết |
|---------|----------|
| **Hiệu suất** | Không làm tăng First Contentful Paint > 20%, lazy load dữ liệu khi cần |
| **Mobile** | Responsive tốt ở 375px–390px, layout stack columns, touch-friendly buttons (min 44px) |
| **Desktop** | Tối ưu cho 1280px–1440px, ưu tiên mật độ thông tin cao hơn mobile |
| **Animations** | Sử dụng Framer Motion variants, `prefers-reduced-motion` được tôn trọng |
| **Accessibility** | Contrast ratio 4.5:1 tối thiểu, focus states visible, cursor-pointer rõ ràng |
| **Dark Mode** | KHÔNG yêu cầu, giữ Light mode làm chủ đạo |

---

## 6. Design System Tokens (Giữ nguyên hệ màu hiện tại)

```css
/* Giữ nguyên Variables định nghĩa tại globals.css */
--accent: #55CA02;          /* Xanh lá chủ đạo */
--accent-strong: #3da800;   /* Xanh lá đậm hơn */
--warning: #FF9500;         /* Cam cảnh báo */
--danger: #FF3B30;          /* Đỏ nguy hiểm */
--fg-base: (dark text);     /* Text chính */
--fg-muted: (lighter text); /* Text phụ */
--border-soft: (subtle border);
```

**Style Direction: "Ultra-Modern Glass & Glow" (Option A)**
- Cards: Opaque `bg-white` với `shadow-sm` + `hover:shadow-[accent]/15`
- Accent glow khi hover: `hover:border-[var(--accent)]/40`
- Rounded: `rounded-2xl` (16px) cho cards, `rounded-full` cho badges/buttons
- Micro-animations: Framer Motion `spring` transition (stiffness 400, damping 25)
- Typography: Giữ font hiện tại, thêm `tracking-tight` cho headings lớn

---

## 7. Danh sách Trang & Phạm vi Nâng cấp

| Trang | UI/UX | Nghiệp vụ mới |
|-------|-------|---------------|
| Dashboard | Bento layout, Quick Actions, Alert panels | KPI cảnh báo khách hàng, Đơn hàng pending |
| Orders `/orders` | Filter real search, bulk select | `expires_at` column, gia hạn từ drawer |
| Tạo đơn `/orders/new` | Smart selectors | Inline tạo khách hàng/sản phẩm |
| Customers `/customers` | Search/filter real, debt badge | Gia hạn thanh toán workflow |
| Products `/products` | Upgrade product cards | Inline create từ Orders |
| Inventory `/inventory` | Page size, status filter | Quick add button ở header |
| Calendar `/calendar` | Giữ nguyên UI logic | Không thay đổi |
| Settings `/settings` | Minor polish | Không thay đổi |

---

## 8. Out of Scope

- Thay đổi API backend hoặc database schema
- Tích hợp thanh toán mới
- Email/notification system
- Dark Mode (không được yêu cầu)
- Reports/Export PDF

---

## 9. Definition of Done

- [ ] TypeScript không có lỗi (`npx tsc --noEmit`)
- [ ] Tất cả pages load được, không có console error
- [ ] Page size selector hoạt động ở tất cả trang có bảng
- [ ] Inline create customer/product hoạt động từ form tạo đơn
- [ ] Dashboard hiển thị cảnh báo khách hàng quá hạn
- [ ] Mobile responsive ở 390px không bị overflow
- [ ] Animations smooth, không giật

---

*Document lưu tại: `docs/requirements-ui-ux-upgrade.md`*
*Phê duyệt bởi: Admin System Owner – 2026-03-06*
