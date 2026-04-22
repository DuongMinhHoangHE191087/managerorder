# cachedUser

Trang này mô tả thuộc tính `cachedUser` trong `zalo-bot-js`, dùng để đọc lại thông tin bot đã được cache sau khi `getMe()` hoặc `initialize()` chạy thành công.

Đây là cách thuận tiện để lấy thông tin bot mà không cần gọi API thêm một lần nữa.

## Chữ ký thuộc tính

```ts
get cachedUser(): User | undefined
```

## Khi nào nên dùng

- đọc nhanh thông tin bot sau khi đã initialize
- hiển thị profile bot trong log hoặc dashboard nội bộ
- tránh gọi lặp `getMe()` khi không cần

## Ví dụ

```ts
await bot.initialize();
console.log(bot.cachedUser);
```

## Lưu ý thực tế

- nếu bạn chưa gọi `getMe()` hoặc `initialize()`, giá trị có thể là `undefined`
- đây là dữ liệu cache trong bộ nhớ, không phải một API call mới

## Kế tiếp

- Xem [getMe](./get-me.md) để biết dữ liệu này được nạp từ đâu.
- Xem [initialize](./initialize.md) nếu bạn muốn đảm bảo cache đã có trước khi dùng.

Cập nhật lần cuối: 05/04/2026
