// ============================================================
// SHARED SOURCE ACCOUNT MAPPER
// Single source of truth for Row → Domain mapping
// ============================================================

import type { SourceAccount } from '@/lib/domain/types';
import type { SourceAccountRow } from '@/lib/supabase/repositories/source-accounts.repo';

/**
 * Maps a Supabase row to the domain SourceAccount interface.
 * Used by all API routes to ensure consistent field mapping.
 */
export function mapRowToSourceAccount(row: SourceAccountRow): SourceAccount {
  const notesObj = (row.notes ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    email: row.email,
    provider: row.provider,
    productIds: row.product_ids ?? [],
    maxSlots: row.max_slots,
    usedSlots: row.used_slots,
    notes: row.notes as Record<string, string> | undefined,
    reservedNicks: row.reserved_nicks ?? [],
    expiresAt: row.expires_at,
    credentials: Array.isArray(notesObj.credentials) ? notesObj.credentials : undefined,
    purchaseCostVnd: row.purchase_cost_vnd ?? undefined,
    purchaseDate: row.purchase_date ?? undefined,
    purchaseSource: row.purchase_source ?? undefined,
  };
}

/**
 * Safely extracts the single order relation from Supabase's join result.
 * Supabase may return either an object or an array depending on the join type.
 */
export function parseOrderRelation<T>(orders: T | T[] | null): T | null {
  if (!orders) return null;
  return Array.isArray(orders) ? orders[0] ?? null : orders;
}
