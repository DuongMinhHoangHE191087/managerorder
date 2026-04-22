# [Cập nhật Kho hàng và Chi tiết Đơn hàng]

Cải thiện giao diện Thêm mới tài khoản kho hàng để có thể cuộn được khi nội dung dài, đồng thời tạo trang Chi tiết đơn hàng toàn diện tương tự như trang Chi tiết khách hàng.

## User Review Required

KHÔNG CÓ TÍNH NĂNG ĐỘT PHÁ CẦN REVIEW TRƯỚC.

## Proposed Changes

### Thay đổi Component Modal và Layout

#### [MODIFY] src/shared/ui/modal.tsx
- Kiểm tra lại thuộc tính overflow-y-auto trên body của Modal để đảm bảo các form dài trong modal (ví dụ form Thêm tài khoản Nguồn) có thể scroll được.

#### [MODIFY] src/app/inventory/page.tsx
- Có thể thêm vùng scrollable cụ thể cho form Thêm tài khoản nguồn và Sửa tài khoản nguồn để UX tốt hơn. Thay vì để cả modal scroll, phần `DynamicCredentialList` có thể được chứa trong một div có `max-h-[60vh] overflow-y-auto custom-scrollbar`.

### Trang Chi tiết Đơn hàng (Order Details Page)

#### [NEW] src/app/orders/[id]/page.tsx
- Tạo trang xem chi tiết đơn hàng dành riêng (`/orders/{id}`).
- Load dữ liệu đơn hàng và khách hàng bằng `useOrder` / API.
- Hiển thị đầy đủ thông tin: Mã đơn, Thời gian, Trạng thái (Thanh toán, Cấp phát), Lịch sử thanh toán chi tiết.
- Hiển thị danh sách items (sản phẩm), giá tiền, nicks tương ứng đã cấp phát.
- Tham khảo form UI từ `customers/[customerId]/page.tsx` để duy trì thiết kế thống nhất.

## Verification Plan

### Automated Tests
- Build lại TypeScript `npx tsc --noEmit` để đảm bảo code không lỗi.
- Check linter bằng `npm run lint`.

### Manual Verification
- Truy cập UI tại `/inventory`, click Thêm tài khoản, thêm vài fields vào Credentials và xem có scroll được không.
- Bấm vào một đơn hàng bất kỳ để vào trang `/orders/[id]` và xem chi tiết, Layout có chuẩn UI Pro Max không.
