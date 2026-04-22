# replyPhoto

Trang này mô tả helper `replyPhoto()` trên `Message`, dùng để gửi ảnh về lại cùng cuộc trò chuyện của message hiện tại.

Helper này phù hợp khi callback của bạn đang xử lý một message và cần trả lời bằng ảnh ngay lập tức.

## Chữ ký hàm

```ts
replyPhoto(photo: string, caption = ""): Promise<Message>
```

## Ví dụ

```ts
bot.on("text", async (message) => {
  await message.replyPhoto("https://example.com/image.jpg", "Ảnh minh họa");
});
```

## Quan hệ với `sendPhoto()`

`replyPhoto()` thực chất gọi `sendPhoto()` với `message.chat.id`.

## Kế tiếp

- Xem [sendPhoto](./send-photo.md) để dùng API gốc của Bot.
- Xem [replyText](./reply-text.md) nếu bạn chỉ cần phản hồi bằng text.

Cập nhật lần cuối: 05/04/2026
