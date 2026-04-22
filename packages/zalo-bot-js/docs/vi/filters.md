# filters

Trang này mô tả `filters` trong `zalo-bot-js`, nhóm bộ lọc dựng sẵn dùng với `MessageHandler` hoặc bất kỳ luồng nào cần kiểm tra `Update`.

Các filter trong SDK là các hàm có thể kết hợp với nhau bằng `and`, `or`, `not`.

## Các filter dựng sẵn

- `filters.TEXT`
- `filters.COMMAND`
- `filters.PHOTO`
- `filters.STICKER`
- `filters.ALL`

## Ví dụ cơ bản

```ts
app.addHandler(new MessageHandler(filters.TEXT, async (update) => {
  await update.message?.replyText("Đây là text message.");
}));
```

## Kết hợp filter

Các filter có thể kết hợp:

```ts
const textButNotCommand = filters.TEXT.and(filters.COMMAND.not());
```

```ts
const media = filters.PHOTO.or(filters.STICKER);
```

## Khi nào nên dùng

- muốn tái sử dụng logic kiểm tra update
- muốn viết handler rõ ràng hơn
- muốn tránh lặp điều kiện `if` trong callback

## Kế tiếp

- Xem [MessageHandler](./message-handler.md) để dùng filter trong handler.
- Xem [Application](./application.md) để biết filter được đưa vào flow xử lý thế nào.

Cập nhật lần cuối: 05/04/2026
