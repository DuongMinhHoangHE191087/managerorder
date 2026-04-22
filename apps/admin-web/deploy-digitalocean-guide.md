# Hướng Dẫn Deploy Next.js Lên DigitalOcean

DigitalOcean (DO) là một nền tảng tuyệt vời và ổn định để chạy các ứng dụng Next.js. Có 2 cách phổ biến nhất để triển khai (Deploy) dự án của bạn lên DO:

## Cách 1: Sử dụng DigitalOcean App Platform (Khuyên Dùng - Dễ Nhất)

Đây là dịch vụ PaaS (Platform as a Service) cực kỳ nhàn hạ tương tự như Vercel hoặc Heroku. Ưu điểm là bạn **không cần lo lắng bị thiếu RAM khi Build, không cần bận tâm về máy chủ, PM2 hay cài đặt cấu hình Nginx**. Bạn chỉ cần đẩy code lên GitHub, cài đặt và DigitalOcean sẽ tự động gánh hết mọi thứ tốn tài nguyên nhất. SSL/HTTPS tên miền cũng được lo tự động 100%.

### Các bước thực hiện:
1. Đẩy toàn bộ source code của bạn lên một kho lưu trữ (Repository) Private trên **GitHub** hoặc **GitLab**.
2. Đăng nhập vào tài khoản [DigitalOcean](https://cloud.digitalocean.com/).
3. Tại menu bên trái, chọn **Apps** -> Bấm tạo **Create App**.
4. Chọn **GitHub** làm nguồn lấy Code (Source), cấp quyền cho DigitalOcean liên kết với kho chứa code của bạn.
5. Chọn Repository và nhánh code bạn muốn dùng (ví dụ: nhánh `main`).
6. Ở bước cấu hình tiếp theo (**Configure**), hệ thống AI của nền tảng sẽ tự động nhận diện thiết lập đây là dự án Node.js/Next.js. Bạn chỉ cần rà soát lại xem đã đúng chưa:
   - **Build Command**: `npm run build`
   - **Run Command**: `npm start`
   - **Environment Variables**: Nhập tất cả các biến môi trường từ file `.env.local` của bạn vào đây (ví dụ: `REDIS_URL`, `DATABASE_URL`, v.v...).
7. Chọn gói cước (Gói cơ bản Basic Plan từ khoảng $5/tháng là đã khá đủ dùng) và bấm nút **Launch App** màu xanh lá.
8. Cứ mỗi lần bạn sửa code và gõ lệnh `git push` đưa code mới lên GitHub, hệ thống của DigitalOcean sẽ tự động tiến hành quá trình tự Build và cập nhật Website (Deploy) mà người dùng vào không hề bị đứng trang hay mất kết nối (Zero-Downtime)!

---

## Cách 2: Sử dụng Droplet (Máy chủ ảo chạy VPS) + PM2 (Dành cho người thích làm chủ hệ thống)

Cách này tái lập luồng giống y hệt như những gì bạn đã cực khổ thao tác trên aaPanel lúc nãy. Điểm khác duy nhất là bạn sẽ thao tác 100% bằng câu lệnh trên hệ điều hành Ubuntu nguyên bản (trống không, gọi là Droplet) để tiết kiệm và linh hoạt phân bổ tối đa RAM/CPU (không bị hao một đống tài nguyên để "đẩy" cái giao diện đồ họa trình quản lý của aaPanel nặng nề).

### Các bước thực hiện:
1. Tạo một máy chủ Droplet trên bảng điều khiển DigitalOcean (chọn OS là Ubuntu 24.04, với nhu cầu NextJS, bạn nên chọn gói Server có RAM ít nhất 1GB).
2. Mở ứng dụng Terminal/PuTTY và kết nối SSH vào Droplet: `ssh root@<IP_cua_Droplet>`
3. Cài đặt gốc Node.js và NPM mới nhất cho Ubuntu:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
4. Cài đặt quy trình PM2 (công cụ bắt buộc để giữ cho ứng dụng web luôn được Online chạy ngầm 24/7 kể cả khi bạn tắt cửa sổ Server đi):
   ```bash
   sudo npm install -g pm2
   ```
5. Clone code của bạn từ kho GitHub về hẳn máy chủ VPS:
   ```bash
   git clone <đường-dẫn-repo-github> /var/www/premium-admin-web
   cd /var/www/premium-admin-web
   ```
6. Bắt đầu tải và Cài đặt thư viện cùng với quy trình Build (giống hệt aaPanel trước đó):
   ```bash
   npm install
   npm run build
   ```
7. Gọi PM2 để khởi động và cấu hình để luôn tự động chay dự án mỗi khi Máy chủ khởi động lại:
   ```bash
   pm2 start npm --name "nextjs-app" -- start
   pm2 startup
   pm2 save
   ```

### (Tùy chọn) Cài đặt Nginx làm cầu nối Reverse Proxy:
Theo mặc định, ứng dụng NextJS của bạn sẽ cắm rễ chạy tại cổng local 3000 (`http://localhost:3000`). Để đưa nó hòa lưới tên miền Web chính thức (bằng cổng HTTPS 443 hoặc 80), bạn phải cài thêm công cụ Nginx.

```bash
sudo apt install nginx
```

Mở cấu hình thiết lập của file Nginx: `nano /etc/nginx/sites-available/default`
Và nhập các dòng cấu hình proxy để chuyển hướng:
```nginx
server {
    listen 80;
    server_name duongminhhoang.id.vn www.duongminhhoang.id.vn;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Lưu file vào và gõ lệnh kích hoạt cấu hình để web vào mạng: `sudo systemctl restart nginx`.
