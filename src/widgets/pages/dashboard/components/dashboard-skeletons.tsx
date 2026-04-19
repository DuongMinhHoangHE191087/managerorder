"use client";

function DashboardPanelSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`app-card flex min-h-[320px] flex-col overflow-hidden border border-[var(--border-soft)] p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] ${className}`}
    >
      <div className="mb-4 h-4 w-32 animate-pulse rounded-full bg-[var(--border-soft)]" />
      <div className="mt-auto space-y-3">
        <div className="h-3 w-4/5 animate-pulse rounded-full bg-[var(--border-soft)]" />
        <div className="h-3 w-3/5 animate-pulse rounded-full bg-[var(--border-soft)]" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-[var(--border-soft)]" />
      </div>
    </div>
  );
}

export function DashboardAnalyticsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
      <DashboardPanelSkeleton />
      <DashboardPanelSkeleton />
      <DashboardPanelSkeleton />
    </div>
  );
}

export function DashboardRevenueSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
      <div className="app-card flex min-h-[460px] flex-col overflow-hidden border border-[var(--border-soft)] p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] lg:col-span-2">
        <div className="mb-4 h-4 w-40 animate-pulse rounded-full bg-[var(--border-soft)]" />
        <div className="mt-2 flex-1 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-light)]/30" />
      </div>
      <div className="space-y-8 lg:col-span-2">
        <DashboardPanelSkeleton />
        <DashboardPanelSkeleton />
      </div>
    </div>
  );
}

export function DashboardOrdersSkeleton() {
  return (
    <section className="app-card overflow-hidden border border-[var(--border-soft)] shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] bg-[var(--bg-app)]/50 p-5 backdrop-blur-sm">
        <div className="h-4 w-48 animate-pulse rounded-full bg-[var(--border-soft)]" />
        <div className="h-3 w-20 animate-pulse rounded-full bg-[var(--border-soft)]" />
      </div>
      <div className="overflow-x-auto p-5">
        <div className="min-w-[780px] space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="grid grid-cols-6 gap-4 rounded-xl border border-[var(--border-soft)] p-4">
              <div className="h-4 w-20 animate-pulse rounded-full bg-[var(--border-soft)]" />
              <div className="h-4 w-32 animate-pulse rounded-full bg-[var(--border-soft)]" />
              <div className="h-4 w-28 animate-pulse rounded-full bg-[var(--border-soft)]" />
              <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--border-soft)]" />
              <div className="h-4 w-20 animate-pulse rounded-full bg-[var(--border-soft)]" />
              <div className="ml-auto h-8 w-16 animate-pulse rounded-full bg-[var(--border-soft)]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
