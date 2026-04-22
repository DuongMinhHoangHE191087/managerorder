# Gửi chat action

Trang này mô tả hàm `sendChatAction()` trong `zalo-bot-js`, dùng để gửi trạng thái hành động tạm thời như đang xử lý hoặc đang nhập tới một cuộc trò chuyện.

Hàm này hữu ích khi bot cần vài giây để hoàn thành xử lý nhưng bạn vẫn muốn người dùng thấy hệ thống đang hoạt động.

## Chữ ký hàm

```ts
sendChatAction(
  chatId: string,
  action: string,
  options?: RequestOptions,
): Promise<boolean>
```

## Khi nào nên dùng

- báo cho người dùng biết bot đang xử lý
- tạo cảm giác phản hồi tự nhiên hơn trước khi gửi message thật
- dùng trước các workflow chậm như AI, webhook ngoài hoặc truy vấn dữ liệu

## Tham số

| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| --- | --- | --- | --- |
| `chatId` | `string` | Có | ID người nhận hoặc cuộc trò chuyện |
| `action` | `string` | Có | Tên action muốn gửi |
| `options` | `RequestOptions` | Không | Tùy chọn request nội bộ |

## Giá trị trả về

Hàm trả về `Promise<boolean>`.

## Ví dụ tối thiểu

```ts
await bot.sendChatAction("abc.xyz", "typing");
```

## Ví dụ trong event

```ts
bot.on("text", async (message) => {
  await bot.sendChatAction(message.chat.id, "typing");
  await bot.sendMessage(message.chat.id, "Mình đang xử lý yêu cầu của bạn.");
});
```

## Dùng qua `Message.replyAction()`

```ts
bot.on("text", async (message) => {
  await message.replyAction("typing");
});
```

## Lưu ý thực tế

- đây không phải là message thật, mà là trạng thái tạm thời
- thường dùng kết hợp với `sendMessage()` hoặc `sendPhoto()`
- tên action phải phù hợp với Bot API mà SDK đang gọi phía dưới

## Kế tiếp

- Xem [sendMessage](./send-message.md) để gửi nội dung văn bản sau action.
- Xem [on](./on.md) để hiểu callback nào thường dùng action này.

Cập nhật lần cuối: 05/04/2026
