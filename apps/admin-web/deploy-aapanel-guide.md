# Hướng dẫn Deploy Next.js (Premium Admin Web) lên aaPanel

Dưới đây là hướng dẫn từng bước để đưa dự án này lên server cài đặt aaPanel bằng cách sử dụng **Node.js Deployment** (PM2).

## Yêu cầu chuẩn bị trên aaPanel
1. Truy cập vào giao diện aaPanel (thường là port `8888` hoặc `7800`).
2. Vào tab **App Store**.
3. Cài đặt các ứng dụng sau nếu chưa có:
   - **Nginx** (Bản mới nhất, ví dụ 1.24+).
   - **Node.js version manager** hoặc **PM2 Manager**.

## Bước 1: Build source code & Nén file
Việc build code ngay trên máy tính của bạn sau đó upload lên sẽ giúp tránh lỗi yếu RAM trên VSP/Server.

1. Tại máy tính của bạn, mở terminal tại thư mục dự án và chạy:
   ```bash
   npm install
   npm run build
   ```
2. Sau khi build xong, tiến hành **Zip (nén)** các thư mục & file sau:
   - Thư mục `.next/`
   - Thư mục `public/`
   - File `package.json`
   - File `package-lock.json`
   - File `next.config.mjs`
   - Bất kỳ file nào khác ở thư mục ngoài cùng mà hệ thống cần (nhưng không nén `node_modules` hay `src` để file nhẹ nhất nhé).
   
*(Lưu ý: Nếu bạn có sử dụng Redis Upstash và Supabase, hãy chắc chắn copy tay nội dung file `.env.local` của bạn vì mật khẩu không nên được truyền qua file zip).*

## Bước 2: Upload source code lên aaPanel
1. Vào aaPanel -> phần **Files**.
2. Nhanh chóng tạo 1 thư mục cho website, ví dụ: `/www/wwwroot/admin.managerorder.com`.
3. Upload file `zip` vừa nén ở Bước 1 vào thư mục này.
4. Giải nén (Unzip) trực tiếp trên aaPanel.
5. Tại thư mục `/www/wwwroot/admin.managerorder.com`, bấm **New File** và tạo mới mục tên là **`.env`** (hoặc `.env.local`), copy toàn bộ KEY cấu hình của dự án (Supabase, Upstash, JWT, v.v) dán vào.

## Bước 3: Cài đặt Node Project trên aaPanel
1. Trên thanh công cụ aaPanel, chọn **Websites** -> Chọn tab **Node project** (hoặc thông qua App Store -> PM2 Manager).
2. Click **Add Node project**.
3. Điền cấu hình như sau:
   - **Project directory**: Trỏ đường dẫn vào `/www/wwwroot/admin.managerorder.com`
   - **Run Command/Startup Command**: Bạn điền `npm run start` (hoặc `npx next start`).
   - **Project name**: Đặt tên bất kỳ, ví dụ: `premium-admin-web`
   - **Project port**: Chỉnh thành `3000` (Port mặc định của Next.js).
   - **Node version**: Chọn phiên bản NodeJS `v18` hoặc `v20`.
   - **Domain**: Nhập tên miền (VD: `admin.managerorder.com`). Hệ thống sẽ tự tạo Nginx config để proxy ngược domain về Port 3000.
4. Nhấn **Submit**.
   *(aaPanel sẽ tự động chạy `npm install --production` sau đó start project của bạn bằng PM2)*.

## Bước 4: Kiểm tra và cài SSL (HTTPS)
1. Vẫn ở phần **Websites** -> tab **Node project**. 
2. Nút trạng thái (Status) của Project phải xanh biểu thị là **Running**.
3. Click vào tên miền của bạn (cột Domains) hoặc cột **SSL**.
4. Chọn Certificate từ **Let's Encrypt** và tích vào thẻ xác nhận domain.
5. Click **Apply**.
6. Sau khi Apply thành công, nhớ **Bật force HTTPS** ở góc trên cùng bên phải bảng cấu hình SSL đó.

## Xử lý sự cố (Troubleshooting)

- **Lỗi 502 Bad Gateway:** 
  Dự án Next.js chưa start được. Vào mục cấu hình Node Project, xem tab **Logs**. Hãy chắc chắn là bạn đã upload đủ các file như yêu cầu ở Bước 1.1 và đã cấu hình đủ file `.env`.
- **Nếu cần update phiên bản mới:** 
  Chỉ việc chạy lệnh `npm run build` ở local, upload đè file `.zip`, giải nén đè và sau đó vào **Node project** nhấn nút **Restart** là hệ thống sẽ nạp code mới ngay lập tức.
