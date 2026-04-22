# onText

Trang này mô tả hàm `onText()` trong `zalo-bot-js`, dùng để đăng ký callback theo biểu thức chính quy áp dụng lên `message.text`.

Đây là cách phù hợp khi bạn cần bắt command, keyword hoặc pattern text cụ thể.

## Chữ ký hàm

```ts
onText(
  pattern: RegExp,
  callback: (message: Message, match: RegExpExecArray) => Promise<void> | void,
): this
```

## Callback nhận gì

Callback nhận:

- `message: Message`
- `match: RegExpExecArray`

Ví dụ dữ liệu thực tế:

```ts
bot.onText(/.*/, async (message, match) => {
  console.log("[onText]", {
    chatId: message.chat.id,
    match: match[0],
  });
});
```

## Khi nào nên dùng

- bắt command như `/start`
- bắt text có tham số
- match keyword bằng regex

## Ví dụ với command

```ts
bot.onText(/\/start(?:\s+(.+))?/, async (message, match) => {
  const payload = match[1]?.trim() ?? "bạn";
  await bot.sendMessage(message.chat.id, `Xin chào ${payload}!`);
});
```

## Khác nhau giữa `on("text")` và `onText()`

- `on("text")`: chạy với mọi message có text
- `onText()`: chỉ chạy khi regex match thành công

## Lưu ý thực tế

- `onText()` chỉ hoạt động khi message có `text`
- regex được áp lên `message.text` đã parse bởi SDK
- nếu cần bắt mọi text trước rồi tự `if/else`, dùng `on("text")`

## Kế tiếp

- Xem [on](./on.md) để đăng ký listener theo event.
- Xem [sendMessage](./send-message.md) để phản hồi từ callback.

Cập nhật lần cuối: 05/04/2026
