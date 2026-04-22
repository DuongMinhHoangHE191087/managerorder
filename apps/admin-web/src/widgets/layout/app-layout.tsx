"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { GlobalProviders } from "@/app/providers/global-providers";
import { useAdminChrome } from "@/shared/providers/admin-chrome-context";

const LazyAppNav = dynamic(
  () => import("./app-nav").then((module) => ({ default: module.AppNav })),
  { ssr: false, loading: () => <AppChromeSkeleton /> }
);

interface AppLayoutProps {
  children: ReactNode;
}

function AppChromeSkeleton() {
  return (
    <>
      <aside className="hidden border-r border-[var(--border-soft)] bg-[var(--bg-surface)] lg:row-span-2 lg:flex lg:h-screen lg:flex-col lg:sticky lg:top-0">
        <div className="border-b border-[var(--border-soft)] px-5 py-5">
          <div className="h-10 w-44 animate-pulse rounded-xl bg-[var(--border-soft)]" />
        </div>
        <div className="space-y-3 px-4 py-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-xl bg-[var(--border-soft)]" />
          ))}
        </div>
      </aside>
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 sm:px-6 lg:col-start-2 lg:px-8">
        <div className="size-10 animate-pulse rounded-xl bg-[var(--border-soft)] lg:hidden" />
        <div className="flex-1">
          <div className="mb-2 h-3 w-24 animate-pulse rounded-full bg-[var(--border-soft)]" />
          <div className="h-4 w-36 animate-pulse rounded-full bg-[var(--border-soft)]" />
        </div>
        <div className="hidden h-10 w-40 animate-pulse rounded-xl bg-[var(--border-soft)] md:block" />
        <div className="size-10 animate-pulse rounded-xl bg-[var(--border-soft)]" />
        <div className="h-10 w-28 animate-pulse rounded-xl bg-[var(--border-soft)]" />
      </header>
    </>
  );
}

export function AppChrome({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--fg-base)]">
      <GlobalProviders>
        <div className="min-h-screen lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
          <LazyAppNav />
          <main className="min-w-0 px-4 py-6 sm:px-6 lg:col-start-2 lg:px-8 lg:py-8 xl:px-10">
            {children}
          </main>
        </div>
      </GlobalProviders>
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const isInsideAdminChrome = useAdminChrome();

  if (isInsideAdminChrome) {
    return <>{children}</>;
  }

  return <AppChrome>{children}</AppChrome>;
}
