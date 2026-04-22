# setWebhook

Trang này mô tả hàm `setWebhook()` trong `zalo-bot-js`, dùng để đăng ký URL webhook để Zalo gửi update tới ứng dụng của bạn.

Nếu bạn đang chuyển bot sang mô hình production hoặc muốn nhận update theo kiểu push thay vì polling, đây là hàm cần dùng.

## Chữ ký hàm

```ts
setWebhook(url: string, secretToken: string): Promise<boolean>
```

## Khi nào nên dùng

- triển khai bot bằng webhook
- nhận update theo thời gian thực
- bảo vệ endpoint bằng secret token

## Tham số

| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| --- | --- | --- | --- |
| `url` | `string` | Có | URL public để nhận webhook |
| `secretToken` | `string` | Có | Secret dùng để xác minh request webhook |

## Giá trị trả về

Hàm trả về `Promise<boolean>`.

## Ví dụ tối thiểu

```ts
await bot.setWebhook(
  "https://your-domain.example/webhook",
  "your-secret-token",
);
```

## Ví dụ kết hợp với server webhook

```ts
import "dotenv/config";
import { createServer } from "node:http";
import { Bot } from "zalo-bot-js";

const bot = new Bot({ token: process.env.ZALO_BOT_TOKEN! });
const secretToken = process.env.ZALO_WEBHOOK_SECRET!;

await bot.setWebhook(process.env.ZALO_WEBHOOK_URL!, secretToken);

const server = createServer(async (req, res) => {
  if (req.headers["x-bot-api-secret-token"] !== secretToken) {
    res.statusCode = 403;
    res.end("unauthorized");
    return;
  }

  res.statusCode = 200;
  res.end("ok");
});

server.listen(3000);
```

## Alias tương thích

SDK vẫn giữ alias:

```ts
await bot.setWebHook(url, { secret_token: secretToken });
```

Nếu bắt đầu project mới, nên ưu tiên dùng `setWebhook()`.

## Lưu ý thực tế

- `url` phải là public URL mà Zalo có thể gọi tới
- nên luôn dùng `secretToken` và kiểm tra header tương ứng
- khi đã dùng webhook, thường không cần chạy polling song song

## Kế tiếp

- Xem [getWebhookInfo](./get-webhook-info.md) để kiểm tra cấu hình webhook.
- Xem [deleteWebhook](./delete-webhook.md) nếu bạn muốn gỡ webhook hiện tại.

Cập nhật lần cuối: 05/04/2026
