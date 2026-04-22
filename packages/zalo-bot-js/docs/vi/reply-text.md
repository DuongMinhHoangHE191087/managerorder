# replyText

Trang này mô tả helper `replyText()` trên `Message`, dùng để trả lời một tin nhắn bằng văn bản ngay trong cùng cuộc trò chuyện.

Đây là cách viết ngắn gọn hơn khi callback của bạn đã nhận sẵn một `Message`.

## Chữ ký hàm

```ts
replyText(text: string): Promise<Message>
```

## Khi nào nên dùng

- callback đang xử lý một `Message`
- muốn trả lời ngay vào cùng `chat.id`
- muốn code gọn hơn so với `bot.sendMessage(message.chat.id, ...)`

## Ví dụ

```ts
bot.on("text", async (message) => {
  await message.replyText("Mình đã nhận tin nhắn của bạn.");
});
```

## Quan hệ với `sendMessage()`

`replyText()` thực chất gọi lại `sendMessage()` với `message.chat.id` hiện tại.

## Lưu ý thực tế

- helper này yêu cầu `Message` đang gắn với một `Bot`
- nếu cần gửi sang chat khác hoặc cần kiểm soát tham số đầy đủ hơn, nên dùng [sendMessage](./send-message.md)

## Kế tiếp

- Xem [sendMessage](./send-message.md) để dùng API gốc của Bot.
- Xem [replyPhoto](./reply-photo.md) nếu bạn muốn reply bằng ảnh.

Cập nhật lần cuối: 05/04/2026
