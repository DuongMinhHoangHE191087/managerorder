# getWebhookInfo

Trang này mô tả hàm `getWebhookInfo()` trong `zalo-bot-js`, dùng để lấy thông tin cấu hình webhook hiện tại của bot.

Đây là hàm phù hợp để kiểm tra bot đang chạy theo webhook hay chưa và debug cấu hình triển khai.

## Chữ ký hàm

```ts
getWebhookInfo(): Promise<WebhookInfo | undefined>
```

## Khi nào nên dùng

- kiểm tra webhook đã được cấu hình hay chưa
- xác minh URL webhook hiện tại
- debug môi trường production

## Giá trị trả về

Hàm trả về `Promise<WebhookInfo | undefined>`.

## Ví dụ

```ts
const info = await bot.getWebhookInfo();
console.log(info);
```

## Alias tương thích

SDK vẫn giữ alias:

```ts
const info = await bot.getWebHookInfo();
```

Nếu bắt đầu project mới, nên ưu tiên dùng `getWebhookInfo()`.

## Lưu ý thực tế

- hàm này chỉ đọc trạng thái, không thay đổi cấu hình
- thường dùng cùng `setWebhook()` và `deleteWebhook()`

## Kế tiếp

- Xem [setWebhook](./set-webhook.md) để đăng ký webhook.
- Xem [deleteWebhook](./delete-webhook.md) để gỡ webhook hiện tại.

Cập nhật lần cuối: 05/04/2026
