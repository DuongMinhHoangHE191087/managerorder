// ============================================
// PREMIUM ACCOUNTS UTILITIES
// ============================================
// Encryption, decryption, slots management
// Date: March 5, 2026
// ============================================

import "server-only";
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  calculateAvailableSlots,
  calculateProratedRefund,
  getDaysRemaining,
  hasAvailableSlots,
  isExpired,
  isExpiringSoon,
} from '@/lib/domain/premium-account-math';

// ============================================
// PASSWORD ENCRYPTION (Supabase pgp_sym_encrypt)
// ============================================

/**
 * Encrypt password using Supabase pgp_sym_encrypt
 * This is used for storing premium account passwords securely
 * @param password Plain text password
 * @param encryptionKey Encryption key from environment
 * @returns Encrypted password for database storage
 */
export async function encryptPassword(
  password: string,
  encryptionKey: string
): Promise<Uint8Array> {
  // In production, this would use pgp_sym_encrypt
  // For now, we prepare the data that Supabase will encrypt
  // The actual encryption happens via the SQL function
  
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('Invalid encryption key: must be at least 32 characters');
  }

  // Return the password - Supabase will handle encryption via pgp_sym_encrypt
  return new TextEncoder().encode(password);
}

/**
 * Decrypt password using Supabase pgp_sym_decrypt
 * Query example: SELECT pgp_sym_decrypt(primary_password_encrypted, 'encryption-key') as password
 * @param accountId Account ID to fetch password from
 * @param accountIdParam Account ID from request
 * @returns Decrypted password
 */
export async function decryptPassword(
  accountId: string,
  accountIdParam: string
): Promise<string> {
  if (accountId !== accountIdParam) {
    throw new Error('Unauthorized: Account ID mismatch');
  }

  // This query uses pgp_sym_decrypt from Supabase
  // Note: You need to call this from backend with service role to decrypt
  const encryptionKey = process.env.PREMIUM_PASSWORD_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('Encryption key not configured');
  }

  // Example: SELECT pgp_sym_decrypt(primary_password_encrypted, 'key') FROM premium_accounts
  // This is typically called in sensitive operations only
  return ''; // Replace with actual decryption call
}

// ============================================
// SLOTS MANAGEMENT
// ============================================

export {
  calculateAvailableSlots,
  calculateProratedRefund,
  getDaysRemaining,
  hasAvailableSlots,
  isExpired,
  isExpiringSoon,
};

/**
 * Get accounts with available slots
 */
export async function getAvailableAccounts(
  accountId: string,
  limit = 20,
  offset = 0
) {
  const { data, error, count } = await supabaseAdmin
    .from('premium_accounts')
    .select('*, premium_service_types(name, slug)', { count: 'exact' })
    .eq('account_id', accountId)
    .lt('used_slots', supabaseAdmin.from('premium_accounts').select('total_slots'))
    .eq('status', 'active')
    .is('deleted_at', null)
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return { data, total: count };
}

// ============================================
// STATUS MANAGEMENT
// ============================================

/**
 * Auto-update account status based on expiry date
 */
export async function updateAccountStatusIfExpired(
  accountId: string,
  expiryDate: string
) {
  if (isExpired(expiryDate)) {
    const { error } = await supabaseAdmin
      .from('premium_accounts')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId)
      .is('deleted_at', null);

    if (error) throw error;
    return 'expired';
  }
  return 'active';
}

// ============================================
// REFUND CALCULATION
// ============================================

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate premium account data
 */
export function validatePremiumAccount(data: Record<string, unknown>): {
  isValid: boolean;
  errors?: Record<string, string[]>;
} {
  const errors: Record<string, string[]> = {};

  // Required fields
  if (!data.primary_email) {
    errors.primary_email = ['Primary email is required'];
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.primary_email))) {
    errors.primary_email = ['Invalid email format'];
  }

  if (!data.primary_password) {
    errors.primary_password = ['Password is required'];
  } else if (String(data.primary_password).length < 6) {
    errors.primary_password = ['Password must be at least 6 characters'];
  }

  if (!data.subscription_start_date) {
    errors.subscription_start_date = ['Start date is required'];
  }

  if (!data.subscription_expiry_date) {
    errors.subscription_expiry_date = ['Expiry date is required'];
  } else {
    const startDate = new Date(String(data.subscription_start_date));
    const expiryDate = new Date(String(data.subscription_expiry_date));
    if (expiryDate <= startDate) {
      errors.subscription_expiry_date = ['Expiry date must be after start date'];
    }
  }

  if (data.total_slots != null) {
    const slots = Number(data.total_slots);
    if (slots < 1 || slots > 100) {
      errors.total_slots = ['Total slots must be between 1 and 100'];
    }
  }

  if (
    data.status != null &&
    !['active', 'expired', 'suspended', 'cancelled'].includes(String(data.status))
  ) {
    errors.status = ['Invalid status'];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    ...(Object.keys(errors).length > 0 && { errors }),
  };
}

// ============================================
// RELATIONSHIP VALIDATION
// ============================================

/**
 * Validate that service_type_id and package_id belong to same account
 */
export async function validateServiceAndPackageRelationship(
  accountId: string,
  serviceTypeId: string,
  packageId: string
) {
  // Check service type
  const { data: service, error: serviceError } = await supabaseAdmin
    .from('premium_service_types')
    .select('id')
    .eq('id', serviceTypeId)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .single();

  if (serviceError || !service) {
    throw new Error('Service type not found or does not belong to this account');
  }

  // Check package
  const { data: pkg, error: pkgError } = await supabaseAdmin
    .from('premium_packages')
    .select('id')
    .eq('id', packageId)
    .eq('service_type_id', serviceTypeId)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .single();

  if (pkgError || !pkg) {
    throw new Error('Package not found or does not belong to this service');
  }

  return true;
}
