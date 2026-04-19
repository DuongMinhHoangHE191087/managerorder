// ============================================================
// INVENTORY DASHBOARD API — Aggregated metrics
// Returns KPI data for source accounts + license keys
// ============================================================

import { NextResponse } from "next/server";
import { listSourceAccounts } from "@/lib/supabase/repositories/source-accounts.repo";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";

export const dynamic = "force-dynamic";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const GET = withErrorHandler(
  withAccount(async (_request, { accountId }) => {
    const [sourceAccounts, keysResult] = await Promise.all([
      listSourceAccounts(accountId),
      supabaseAdmin
        .from("license_keys")
        .select("id, status, product_id")
        .eq("account_id", accountId),
    ]);

    const now = Date.now();
    const licenseKeys = keysResult.data ?? [];

    // Source account metrics
    const totalAccounts = sourceAccounts.length;
    const expiredAccounts = sourceAccounts.filter(
      (a) => new Date(a.expires_at).getTime() < now,
    ).length;
    const activeAccounts = totalAccounts - expiredAccounts;
    const expiringSoon7d = sourceAccounts.filter((a) => {
      const exp = new Date(a.expires_at).getTime();
      return exp > now && exp - now <= SEVEN_DAYS_MS;
    }).length;
    const expiringSoon30d = sourceAccounts.filter((a) => {
      const exp = new Date(a.expires_at).getTime();
      return exp > now && exp - now <= THIRTY_DAYS_MS;
    }).length;

    // Slot metrics
    const totalSlots = sourceAccounts.reduce((s, a) => s + a.max_slots, 0);
    const usedSlots = sourceAccounts.reduce((s, a) => s + a.used_slots, 0);
    const availableSlots = totalSlots - usedSlots;
    const avgUtilization =
      totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;

    // Low capacity accounts (< 20% free slots remaining, non-expired)
    const lowCapacityAccounts = sourceAccounts.filter((a) => {
      if (new Date(a.expires_at).getTime() < now) return false;
      if (a.max_slots === 0) return false;
      const freeSlots = a.max_slots - a.used_slots;
      const freePercent = (freeSlots / a.max_slots) * 100;
      return freePercent < 20 && freePercent >= 0;
    });

    // License key metrics
    const availableKeys = licenseKeys.filter(
      (k) => k.status === "available",
    ).length;
    const reservedKeys = licenseKeys.filter(
      (k) => k.status === "reserved",
    ).length;
    const usedKeys = licenseKeys.filter((k) => k.status === "used").length;

    // Accounts expiring in 7 days (for alert banner)
    const expiringSoonList = sourceAccounts
      .filter((a) => {
        const exp = new Date(a.expires_at).getTime();
        return exp > now && exp - now <= SEVEN_DAYS_MS;
      })
      .map((a) => ({
        id: a.id,
        email: a.email,
        expiresAt: a.expires_at,
        daysLeft: Math.ceil(
          (new Date(a.expires_at).getTime() - now) / (1000 * 60 * 60 * 24),
        ),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft);

    // Low capacity list (for alert banner)
    const lowCapacityList = lowCapacityAccounts
      .map((a) => ({
        id: a.id,
        email: a.email,
        freeSlots: a.max_slots - a.used_slots,
        maxSlots: a.max_slots,
        freePercent: Math.round(
          ((a.max_slots - a.used_slots) / a.max_slots) * 100,
        ),
      }))
      .sort((a, b) => a.freePercent - b.freePercent);

    // Cost metrics
    const totalPurchaseCostVnd = sourceAccounts.reduce(
      (s, a) => s + (a.purchase_cost_vnd ?? 0),
      0,
    );

    return NextResponse.json({
      totalAccounts,
      activeAccounts,
      expiredAccounts,
      expiringSoon7d,
      expiringSoon30d,
      totalSlots,
      usedSlots,
      availableSlots,
      avgUtilization,
      totalPurchaseCostVnd,
      lowCapacityCount: lowCapacityAccounts.length,
      lowCapacityList,
      expiringSoonList,
      keys: {
        total: licenseKeys.length,
        available: availableKeys,
        reserved: reservedKeys,
        used: usedKeys,
      },
    });
  }),
);
