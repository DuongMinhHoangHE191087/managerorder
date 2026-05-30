"use client";

export function SettingsPageHeader() {
  return (
    <div className="mb-6 mt-2 flex flex-col gap-1" data-testid="settings-page-header">
      <h1 className="text-4xl font-bold tracking-tight text-[var(--fg-base)]" data-testid="settings-page-title">
        Cài đặt & Phân quyền
      </h1>
    </div>
  );
}
