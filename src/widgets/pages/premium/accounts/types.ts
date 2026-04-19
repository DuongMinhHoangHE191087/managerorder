"use client";

import type { PremiumAccount, PremiumPackage, PremiumServiceType } from "@/lib/types/premium";

export type PremiumAccountRow = PremiumAccount & {
  subscription_start_date: string | null;
  subscription_expiry_date: string | null;
  service: { name: string; slug: string; logo_url: string | null } | null;
  package: { name: string; slug: string; total_slots: number } | null;
};

export type PremiumAccountService = PremiumServiceType;
export type PremiumAccountPackage = PremiumPackage;
