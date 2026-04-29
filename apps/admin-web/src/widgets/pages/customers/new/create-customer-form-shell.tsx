"use client";

import loadDynamic from "next/dynamic";

export const CreateCustomerFormShell = loadDynamic(
  () => import("@/widgets/pages/customers/components/create-customer-form").then((module) => module.CreateCustomerForm),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-5">
        <div className="rounded-[28px] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,250,244,0.88))] px-6 py-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
          <div className="h-3 w-28 animate-pulse rounded-full bg-[var(--border-soft)]" />
          <div className="mt-4 h-8 w-80 animate-pulse rounded-full bg-[var(--border-soft)]" />
          <div className="mt-3 h-4 w-[32rem] animate-pulse rounded-full bg-[var(--border-soft)]" />
        </div>
        <div className="space-y-5">
          <div className="h-40 animate-pulse rounded-[28px] bg-[var(--surface-light)]" />
          <div className="h-56 animate-pulse rounded-[28px] bg-[var(--surface-light)]" />
          <div className="h-44 animate-pulse rounded-[28px] bg-[var(--surface-light)]" />
        </div>
      </div>
    ),
  },
);
