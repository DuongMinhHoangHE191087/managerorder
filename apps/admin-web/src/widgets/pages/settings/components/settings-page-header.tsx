"use client";

export function SettingsPageHeader() {
  return (
    <div className="mb-6 mt-2 flex flex-col gap-1">
      <h1 className="text-4xl font-bold tracking-tight text-[var(--fg-base)]">Cài đặt & Phân quyền</h1>
      <p className="text-[15px] font-medium text-[var(--fg-muted)]">
        Quản lý quyền truy cập, nguồn thanh toán, kênh bán hàng, nhắc nhở và webhooks.
      </p>
    </div>
  );
}
