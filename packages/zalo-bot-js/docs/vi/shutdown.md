# shutdown

Trang này mô tả hàm `shutdown()` trong `zalo-bot-js`, dùng để đóng các transport nội bộ đã được khởi tạo trước đó.

Hàm này hữu ích khi ứng dụng dừng tiến trình hoặc khi bạn muốn giải phóng tài nguyên một cách rõ ràng.

## Chữ ký hàm

```ts
shutdown(): Promise<void>
```

## Khi nào nên dùng

- ứng dụng chuẩn bị thoát
- worker hoặc service cần dọn dẹp kết nối
- bạn tự quản lý vòng đời bot bằng `initialize()` và `shutdown()`

## Ví dụ

```ts
await bot.initialize();

process.on("SIGINT", async () => {
  await bot.shutdown();
  process.exit(0);
});
```

## Lưu ý thực tế

- nếu bot chưa được khởi tạo, `shutdown()` sẽ thoát an toàn
- trong polling runtime, SDK cũng sẽ gọi `shutdown()` khi vòng polling kết thúc

## Kế tiếp

- Xem [initialize](./initialize.md) để khởi tạo bot đúng vòng đời.
- Xem [startPolling](./start-polling.md) để hiểu khi nào polling tự đóng transport.

Cập nhật lần cuối: 05/04/2026
