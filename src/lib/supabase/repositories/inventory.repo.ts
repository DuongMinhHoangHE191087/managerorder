// ============================================================
// INVENTORY (LICENSE KEYS) REPOSITORY — Supabase
// Replaces in-memory: listLicenseKeys, createLicenseKey,
//                     deleteLicenseKey
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';

type LicenseKeyRow = Database['public']['Tables']['license_keys']['Row'];
type LicenseKeyInsert = Database['public']['Tables']['license_keys']['Insert'];

export async function listLicenseKeys(accountId: string): Promise<LicenseKeyRow[]> {
  const { data, error } = await supabase
    .from('license_keys')
    .select('*')
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getLicenseKeysByProduct(
  accountId: string,
  productId: string
): Promise<LicenseKeyRow[]> {
  const { data, error } = await supabase
    .from('license_keys')
    .select('*')
    .eq('account_id', accountId)
    .eq('product_id', productId)
    .eq('status', 'available')
    .is('deleted_at', null);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createLicenseKey(
  accountId: string,
  input: { key_code: string; product_id: string; status?: LicenseKeyRow['status'] }
): Promise<LicenseKeyRow> {
  const { data, error } = await supabase
    .from('license_keys')
    .insert({
      account_id: accountId,
      key_code: input.key_code,
      product_id: input.product_id,
      status: input.status ?? 'available',
    } satisfies LicenseKeyInsert)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateLicenseKeyStatus(
  id: string,
  accountId: string,
  status: LicenseKeyRow['status'],
  orderId?: string
): Promise<LicenseKeyRow> {
  const { data, error } = await supabase
    .from('license_keys')
    .update({
      status,
      order_id: orderId ?? null,
      assigned_at: status === 'used' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('License key not found');
  return data;
}

export async function deleteLicenseKey(id: string, accountId: string): Promise<void> {
  const { error } = await supabase
    .from('license_keys')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);
}
