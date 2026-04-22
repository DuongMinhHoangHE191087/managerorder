# replyAction

Trang này mô tả helper `replyAction()` trên `Message`, dùng để gửi chat action về lại cùng cuộc trò chuyện của message hiện tại.

## Chữ ký hàm

```ts
replyAction(action: string): Promise<boolean>
```

## Ví dụ

```ts
bot.on("text", async (message) => {
  await message.replyAction("typing");
});
```

## Quan hệ với `sendChatAction()`

`replyAction()` gọi lại `sendChatAction()` với `message.chat.id`.

## Kế tiếp

- Xem [sendChatAction](./send-chat-action.md) để dùng API gốc của Bot.
- Xem [replyText](./reply-text.md) để gửi nội dung thật sau action.

Cập nhật lần cuối: 05/04/2026
