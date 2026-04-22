---
layout: home

hero:
  name: "zalo-bot-js"
  text: "Cổng tài liệu tiếng Việt"
  tagline: "Bắt đầu nhanh với bot Zalo trên Node.js, tra cứu từng hàm của SDK, triển khai webhook, chạy polling và nối workflow thực tế."
  actions:
    - theme: brand
      text: Bắt đầu nhanh
      link: /vi/getting-started
    - theme: alt
      text: API Reference
      link: /vi/api-reference
    - theme: alt
      text: Xem tiếng Anh
      link: /en/

features:
  - title: Tạo bot
    details: Quét mã QR, mở trang quản lý bot, tạo bot mới và lấy token trước khi cấu hình `.env`.
    link: /vi/getting-started
  - title: Thiết lập bot
    details: Cài đặt, tạo `.env`, kiểm tra token và chạy bot đầu tiên bằng polling.
    link: /vi/getting-started
  - title: Tra cứu API
    details: Mỗi hàm chính của `Bot`, helper trên `Message`, webhook APIs và polling runtime đều có trang riêng.
    link: /vi/api-reference
  - title: Gửi dữ liệu
    details: Dùng `sendMessage`, `sendPhoto`, `sendSticker` và `sendChatAction` cho các flow phản hồi thực tế.
    link: /vi/send-message
  - title: Event và update
    details: Hiểu cách `on`, `onText`, `processUpdate` và `startPolling` vận hành trong SDK.
    link: /vi/on
  - title: Handler-based API
    details: Tổ chức bot bằng `ApplicationBuilder`, `Application`, `CommandHandler`, `MessageHandler` và `filters`.
    link: /vi/application-builder
  - title: Tích hợp thực tế
    details: Kết nối bot với webhook production, n8n và các workflow automation nhiều bước.
    link: /vi/n8n
---

## Giới thiệu

Tài liệu này dành cho nhà phát triển muốn xây dựng bot trên nền tảng Zalo bằng `zalo-bot-js`, một SDK TypeScript cho Node.js với các thành phần thực dụng như polling, webhook helpers, event listeners và các phương thức gửi tin nhắn cơ bản.

Thông qua bộ tài liệu này, bạn có thể nhanh chóng thiết lập bot, xác thực token, chạy thử các flow nhận và phản hồi tin nhắn, đồng thời nắm được kiến trúc hiện tại của SDK để mở rộng theo nhu cầu riêng.

## Bắt đầu từ đâu

Nếu bạn mới vào tài liệu lần đầu, hãy đi theo thứ tự sau:

1. [Bắt đầu nhanh](./getting-started.md) để cấu hình môi trường và chạy bot đầu tiên.
2. [API Reference](./api-reference.md) để tra cứu toàn bộ hàm chính của SDK.
3. [Ví dụ và test](./examples.md) để chọn giữa polling, webhook và các script kiểm tra.
4. [Tích hợp với n8n](./n8n.md) nếu bạn muốn nối bot vào workflow tự động hóa.

## Các nhóm nội dung nổi bật

- Bắt đầu và xác thực bot: cài đặt, `.env`, kiểm tra token, chạy polling
- API vận hành: `getMe`, `getUpdates`, `processUpdate`, `startPolling`
- API gửi dữ liệu: `sendMessage`, `sendPhoto`, `sendSticker`, `sendChatAction`
- Tích hợp thực tế: webhook, n8n, luồng automation và API nội bộ

## Kế tiếp

Bắt đầu với [Bắt đầu nhanh](./getting-started.md).

Cập nhật lần cuối: 05/04/2026
