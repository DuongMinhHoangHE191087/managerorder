# on

Trang này mô tả hàm `on()` trong `zalo-bot-js`, dùng để đăng ký listener theo loại event đã được SDK chuẩn hóa.

Đây là cách chính để viết bot theo mô hình event listener.

## Chữ ký hàm

```ts
on(event: BotEvent, callback: BotEventCallback): this
```

## Các event hiện có

- `message`
- `text`
- `photo`
- `sticker`
- `command`

## Callback nhận gì

Callback nhận hai tham số:

- `message: Message`
- `metadata: { update: Update }`

Ví dụ dữ liệu thực tế:

```ts
bot.on("message", async (message, metadata) => {
  console.log("[message]", {
    updateId: metadata.update.updateId,
    chatId: message.chat.id,
    messageId: message.messageId,
    fromUserId: message.fromUser?.id,
    messageType: message.messageType,
    eventTypes: metadata.update.eventTypes,
    text: message.text ?? null,
    sticker: message.sticker ?? null,
    photoUrl: message.photoUrl ?? null,
  });
});
```

## Khi nào nên dùng

- tách xử lý theo loại event
- viết bot rõ ràng hơn thay vì tự parse payload thô
- gắn nhiều listener cho các loại nội dung khác nhau

## Ví dụ với `text`

```ts
bot.on("text", async (message) => {
  console.log("[text]", {
    chatId: message.chat.id,
    text: message.text,
  });
});
```

## Cách `eventTypes` được suy ra

SDK không trả raw event name từ Bot API. Thay vào đó:

- nếu có `message` thì có event `message`
- nếu có `message.text` thì có event `text`
- nếu `text` bắt đầu bằng `/` thì có thêm `command`
- nếu có `photoUrl` thì có `photo`
- nếu có `sticker` thì có `sticker`

## Lưu ý thực tế

- `on("message")` là listener tổng quát nhất
- `on("text")` chỉ chạy khi message có text
- nếu cần regex matching, dùng [onText](./on-text.md)

## Kế tiếp

- Xem [onText](./on-text.md) để match bằng regex.
- Xem [processUpdate](./process-update.md) để hiểu event được phát ra từ đâu.

Cập nhật lần cuối: 05/04/2026
