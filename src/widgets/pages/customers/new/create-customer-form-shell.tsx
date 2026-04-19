"use client";

import loadDynamic from "next/dynamic";

export const CreateCustomerFormShell = loadDynamic(
  () => import("@/widgets/pages/customers/components/create-customer-form").then((module) => module.CreateCustomerForm),
  {
    ssr: false,
    loading: () => (
      <div className="app-card overflow-hidden border border-[var(--border-soft)] shadow-sm">
        <div className="border-b border-[var(--border-soft)] bg-[var(--surface-light)] px-6 py-5">
          <div className="h-4 w-56 animate-pulse rounded-full bg-[var(--border-soft)]" />
          <div className="mt-3 h-3 w-80 animate-pulse rounded-full bg-[var(--border-soft)]" />
        </div>
        <div className="space-y-4 p-6">
          <div className="h-36 animate-pulse rounded-2xl bg-[var(--surface-light)]" />
          <div className="h-44 animate-pulse rounded-2xl bg-[var(--surface-light)]" />
        </div>
      </div>
    ),
  },
);
