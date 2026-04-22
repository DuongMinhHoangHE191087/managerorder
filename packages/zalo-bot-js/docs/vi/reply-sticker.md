# replySticker

Trang này mô tả helper `replySticker()` trên `Message`, dùng để gửi sticker về lại cùng cuộc trò chuyện của message hiện tại.

## Chữ ký hàm

```ts
replySticker(sticker: string): Promise<Message>
```

## Ví dụ

```ts
bot.on("text", async (message) => {
  await message.replySticker("sticker_id_here");
});
```

## Quan hệ với `sendSticker()`

`replySticker()` gọi lại `sendSticker()` với `message.chat.id`.

## Kế tiếp

- Xem [sendSticker](./send-sticker.md) để dùng API gốc của Bot.
- Xem [replyAction](./reply-action.md) nếu bạn muốn gửi chat action thay vì sticker.

Cập nhật lần cuối: 05/04/2026
