// ============================================
// PREMIUM SUBSCRIPTIONS — PURE UTILITIES
// ============================================
// Validation and calculation helpers with no DB access.
// DB operations live in subscriptions.repo.ts.

import {
  calculateProratedRefund,
} from './premium-accounts-helpers';
import { getRenewalRequest, persistRefund } from '@/lib/supabase/repositories/subscriptions.repo';

// Re-export DB operations for backward compatibility
// New code should import from '@/lib/supabase/repositories/subscriptions.repo' directly.
export {
  getActiveSubscriptions,
  getExpiringSubscriptions,
  getSubscriptionById,
  getRenewalRequest,
  createRenewalRequest,
  confirmRenewalRequest,
  denyRenewalRequest,
} from '@/lib/supabase/repositories/subscriptions.repo';

// ============================================
// REFUND CALCULATION (business logic)
// ============================================

/**
 * Calculate refund for denied renewal
 * Uses prorated calculation based on remaining days
 */
export async function calculateRefundForRenewal(
  renewalId: string,
  accountId: string,
  method: 'prorated' | 'full' | 'partial' = 'prorated',
  customAmount?: number
): Promise<number> {
  const renewal = await getRenewalRequest(renewalId, accountId);

  if (!renewal) {
    throw new Error('Renewal not found');
  }

  const originalSub = renewal.customer_premium_subscriptions;
  if (!originalSub) {
    throw new Error('Original subscription not found');
  }

  let refundAmount = 0;

  if (method === 'prorated') {
    refundAmount = calculateProratedRefund(
      originalSub.original_price,
      originalSub.start_date,
      originalSub.expiry_date
    );
  } else if (method === 'full') {
    refundAmount = originalSub.original_price;
  } else if (method === 'partial' && customAmount !== undefined) {
    refundAmount = Math.min(customAmount, originalSub.original_price);
  }

  await persistRefund(renewalId, originalSub.id, refundAmount, method);

  return refundAmount;
}

// ============================================
// VALIDATION HELPERS (pure functions)
// ============================================

/**
 * Validate subscription creation data
 */
export function validateSubscriptionData(data: Record<string, unknown>): {
  isValid: boolean;
  errors?: Record<string, string[]>;
} {
  const errors: Record<string, string[]> = {};

  if (!data.premium_account_id) {
    errors.premium_account_id = ['Premium account ID is required'];
  }

  if (!data.service_type_id) {
    errors.service_type_id = ['Service type ID is required'];
  }

  if (!data.package_id) {
    errors.package_id = ['Package ID is required'];
  }

  const billingCycle = String(data.billing_cycle ?? '');
  if (!data.billing_cycle || !['1month', '3months', '6months', '1year'].includes(billingCycle)) {
    errors.billing_cycle = ['Valid billing cycle is required (1month, 3months, 6months, 1year)'];
  }

  if (!data.start_date) {
    errors.start_date = ['Start date is required'];
  }

  if (!data.expiry_date) {
    errors.expiry_date = ['Expiry date is required'];
  } else {
    const startDate = new Date(String(data.start_date));
    const expiryDate = new Date(String(data.expiry_date));
    if (expiryDate <= startDate) {
      errors.expiry_date = ['Expiry date must be after start date'];
    }
  }

  if (!data.original_price || Number(data.original_price) <= 0) {
    errors.original_price = ['Valid original price is required'];
  }

  if (!data.final_price || Number(data.final_price) <= 0) {
    errors.final_price = ['Valid final price is required'];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    ...(Object.keys(errors).length > 0 && { errors }),
  };
}

/**
 * Get cycle months from billing cycle string
 */
export function getCycleMonths(billingCycle: string): number {
  const cycles: Record<string, number> = {
    '1month': 1,
    '3months': 3,
    '6months': 6,
    '1year': 12,
  };
  return cycles[billingCycle] || 1;
}

/**
 * Calculate expiry date from start date + billing cycle
 */
export function calculateExpiryDate(startDate: string, billingCycle: string): string {
  const start = new Date(startDate);
  const months = getCycleMonths(billingCycle);
  const expiry = new Date(start);
  expiry.setMonth(expiry.getMonth() + months);
  return expiry.toISOString().split('T')[0];
}
