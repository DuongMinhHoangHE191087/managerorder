# processUpdate

Trang này mô tả hàm `processUpdate()` trong `zalo-bot-js`, dùng để đưa một update vào hệ xử lý event của SDK.

Đây là hàm trung tâm trong mô hình webhook: ứng dụng HTTP nhận payload, sau đó chuyển payload vào `processUpdate()` để SDK parse và phát các listener phù hợp.

## Chữ ký hàm

```ts
processUpdate(update: Update | JsonObject): Promise<void>
```

## Khi nào nên dùng

- tích hợp webhook
- nhận payload JSON từ HTTP server rồi giao cho SDK xử lý
- đẩy `Update` đã parse sẵn vào hệ event

## Hàm này làm gì

Khi được gọi, SDK sẽ:

1. parse payload thành `Update` nếu cần
2. bỏ qua update không có `message`
3. cập nhật `nextUpdateOffset` nếu có `updateId`
4. phát listener cho từng `eventType`
5. chạy thêm các listener đã đăng ký qua `onText()`

## Ví dụ tối thiểu

```ts
await bot.processUpdate(payload);
```

## Ví dụ trong webhook server

```ts
import { createServer } from "node:http";
import { Bot } from "zalo-bot-js";

const bot = new Bot({ token: process.env.ZALO_BOT_TOKEN! });

bot.on("text", async (message) => {
  await bot.sendMessage(message.chat.id, "Đã nhận update từ webhook.");
});

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/webhook") {
    res.statusCode = 404;
    res.end("not found");
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  await bot.processUpdate(payload);

  res.statusCode = 200;
  res.end("ok");
});

server.listen(3000);
```

## Quan hệ với event listener

`processUpdate()` là điểm bắt đầu của:

- `on("message")`
- `on("text")`
- `on("photo")`
- `on("sticker")`
- `on("command")`
- `onText()`

Nói cách khác, nếu không có `processUpdate()` trong webhook flow, listener sẽ không được kích hoạt.

## Dữ liệu thực tế sau khi parse

Sau khi parse, callback của bạn làm việc với object kiểu SDK như:

- `message.chat.id`
- `message.messageId`
- `message.fromUser?.id`
- `message.text`
- `metadata.update.eventTypes`

Thay vì làm việc trực tiếp với raw JSON từ Bot API.

## Lưu ý thực tế

- update không có `message` sẽ bị bỏ qua
- webhook server nên tự xử lý xác thực request trước khi gọi hàm này
- nếu bạn đang dùng polling bằng `startPolling()`, SDK sẽ tự gọi `processUpdate()` nội bộ

## Kế tiếp

- Xem [setWebhook](./set-webhook.md) để cấu hình webhook.
- Xem [on](./on.md) và [onText](./on-text.md) để đăng ký listener cho update đã parse.

Cập nhật lần cuối: 05/04/2026
