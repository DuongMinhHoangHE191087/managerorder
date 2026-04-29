"use client";

export function SettingsPageHeader() {
  return (
    <div className="mb-6 mt-2 flex flex-col gap-1" data-testid="settings-page-header">
      <h1 className="text-4xl font-bold tracking-tight text-[var(--fg-base)]" data-testid="settings-page-title">
        CÃ i Ä‘áº·t & PhÃ¢n quyá»n
      </h1>
      <p className="text-[15px] font-medium text-[var(--fg-muted)]">
        Quáº£n lÃ½ quyá»n truy cáº­p, nguá»“n thanh toÃ¡n, kÃªnh bÃ¡n hÃ ng, nháº¯c nhá»Ÿ vÃ  webhooks.
      </p>
    </div>
  );
}
