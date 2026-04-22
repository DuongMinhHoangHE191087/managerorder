# CallbackContext

Trang này mô tả `CallbackContext` trong `zalo-bot-js`, object ngữ cảnh được truyền vào callback của `CommandHandler` và `MessageHandler`.

`CallbackContext` giúp callback truy cập nhanh vào `application`, `bot` và danh sách `args` đã được tách sẵn từ command.

## Các thuộc tính chính

- `application`
- `bot`
- `args`

## Ví dụ với `CommandHandler`

```ts
app.addHandler(new CommandHandler("start", async (update, ctx) => {
  console.log(ctx.args);
  await ctx.bot.sendMessage(update.message!.chat.id, "Xin chào!");
}));
```

## `args` hoạt động thế nào

Ví dụ nếu người dùng gửi:

```text
/start demo value
```

thì `ctx.args` sẽ là:

```ts
["demo", "value"]
```

## Khi nào nên dùng

- callback cần dùng lại `bot`
- callback cần truy cập `application`
- callback của command cần đọc tham số sau command

## Kế tiếp

- Xem [CommandHandler](./command-handler.md) để biết `CallbackContext` được truyền vào lúc nào.
- Xem [Application](./application.md) để hiểu mối quan hệ giữa context và app.

Cập nhật lần cuối: 05/04/2026
