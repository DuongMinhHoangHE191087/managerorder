// ============================================
// MIGRATIONS HELPERS
// Business logic utilities for account migrations
// Date: March 5, 2026
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { createMigrationRequest as createMigrationRequestRepo } from '@/lib/supabase/repositories/migrations.repo';

// ============================================
// TYPES
// ============================================

export interface MigrationValidation {
  isValid: boolean;
  error?: string;
}

export interface MigrationContext {
  migrationId: string;
  accountId: string;
  supabase: SupabaseClient<Database>;
}

interface MigrationAccountSnapshot {
  id: string;
  primary_email: string;
  service_type_id: string;
  total_slots: number;
  used_slots: number;
  status: string | null;
}

export interface CreateMigrationRequestInput {
  subscriptionId: string;
  targetAccountId: string;
  reason: string;
  notes?: string | null;
  initiatedBy?: string | null;
}

export type CreateMigrationRequestResult =
  Database['public']['Tables']['account_migrations']['Row'] & {
  customer_name: string;
  source_account: MigrationAccountSnapshot & { available_slots: number };
  target_account: MigrationAccountSnapshot & { available_slots: number };
};

// ============================================
// VALIDATION
// ============================================

/** Check that a subscription can be migrated (active status, correct account) */
export async function validateMigrationEligibility(
  supabase: SupabaseClient<Database>,
  subscriptionId: string,
  accountId: string,
  sourceAccountId: string,
  targetAccountId: string
): Promise<MigrationValidation> {
  const { data: subscription } = await supabase
    .from('customer_premium_subscriptions')
    .select('id, status, premium_account_id')
    .eq('id', subscriptionId)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .single();

  if (!subscription) return { isValid: false, error: 'Subscription not found' };
  if (subscription.status === 'cancelled') {
    return { isValid: false, error: 'Cannot migrate a cancelled subscription' };
  }
  if (subscription.premium_account_id !== sourceAccountId) {
    return {
      isValid: false,
      error: 'Subscription does not belong to the source premium account',
    };
  }
  if (sourceAccountId === targetAccountId) {
    return { isValid: false, error: 'Source and target accounts must be different' };
  }

  return { isValid: true };
}

/** Check that target account has available slot capacity */
export async function checkTargetCapacity(
  supabase: SupabaseClient<Database>,
  targetAccountId: string,
  accountId: string
): Promise<MigrationValidation> {
  const { data: target } = await supabase
    .from('premium_accounts')
    .select('id, status, total_slots, used_slots')
    .eq('id', targetAccountId)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .single();

  if (!target) return { isValid: false, error: 'Target premium account not found' };
  if (target.status !== 'active') {
    return { isValid: false, error: 'Target premium account is not active' };
  }
  if (target.used_slots >= target.total_slots) {
    return { isValid: false, error: 'Target premium account has no available slots' };
  }

  return { isValid: true };
}

/** Check if there's already a pending migration for this subscription */
export async function checkNoPendingMigration(
  supabase: SupabaseClient<Database>,
  subscriptionId: string
): Promise<MigrationValidation> {
  const { data: existing } = await supabase
    .from('account_migrations')
    .select('id, status')
    .eq('subscription_id', subscriptionId)
    .in('status', ['pending', 'in_progress'])
    .maybeSingle();

  if (existing) {
    return {
      isValid: false,
      error: `A migration is already ${existing.status} for this subscription`,
    };
  }

  return { isValid: true };
}

// ============================================
// STEP MANAGEMENT
// ============================================

/** Update a migration step status */
export async function setStepStatus(
  ctx: MigrationContext,
  stepNumber: number,
  status: 'pending' | 'in_progress' | 'completed' | 'failed',
  options?: { details?: Record<string, unknown>; errorMessage?: string }
) {
  await ctx.supabase
    .from('account_migration_history')
    .update({
      step_status: status,
      ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
      ...(options?.details ? { details: options.details } : {}),
      ...(options?.errorMessage ? { error_message: options.errorMessage } : {}),
    })
    .eq('migration_id', ctx.migrationId)
    .eq('step_number', stepNumber);
}

/** Mark migration as failed and record error */
export async function markMigrationFailed(
  ctx: MigrationContext,
  failedStep: number,
  errorMessage: string
) {
  await setStepStatus(ctx, failedStep, 'failed', { errorMessage });
  await ctx.supabase
    .from('account_migrations')
    .update({ status: 'failed', error_log: errorMessage })
    .eq('id', ctx.migrationId);
}

/** Mark migration as completed */
export async function markMigrationCompleted(
  ctx: MigrationContext,
  targetUserId: string
) {
  await ctx.supabase
    .from('account_migrations')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      target_user_id: targetUserId,
    })
    .eq('id', ctx.migrationId);
}

// ============================================
// SLOT MANAGEMENT
// ============================================

/** Safely decrement used_slots (never goes below 0) */
export async function decrementUsedSlots(
  supabase: SupabaseClient<Database>,
  premiumAccountId: string
) {
  const { data } = await supabase
    .from('premium_accounts')
    .select('used_slots')
    .eq('id', premiumAccountId)
    .single();

  if (data && data.used_slots > 0) {
    await supabase
      .from('premium_accounts')
      .update({ used_slots: data.used_slots - 1 })
      .eq('id', premiumAccountId);
  }
}

/** Increment used_slots */
export async function incrementUsedSlots(
  supabase: SupabaseClient<Database>,
  premiumAccountId: string
) {
  const { data } = await supabase
    .from('premium_accounts')
    .select('used_slots')
    .eq('id', premiumAccountId)
    .single();

  if (data) {
    await supabase
      .from('premium_accounts')
      .update({ used_slots: data.used_slots + 1 })
      .eq('id', premiumAccountId);
  }
}

// ============================================
// HISTORY
// ============================================

/** Get full migration details including steps */
export async function getMigrationWithSteps(
  supabase: SupabaseClient<Database>,
  migrationId: string,
  accountId: string
) {
  const { data: migration } = await supabase
    .from('account_migrations')
    .select('*')
    .eq('id', migrationId)
    .eq('account_id', accountId)
    .single();

  if (!migration) return null;

  const { data: steps } = await supabase
    .from('account_migration_history')
    .select('*')
    .eq('migration_id', migrationId)
    .order('step_number', { ascending: true });

  return { ...migration, steps: steps ?? [] };
}

/** Get all migrations for a subscription */
export async function getMigrationsForSubscription(
  supabase: SupabaseClient<Database>,
  subscriptionId: string,
  accountId: string
) {
  const { data } = await supabase
    .from('account_migrations')
    .select('id, status, started_at, completed_at, source_account_id, target_account_id')
    .eq('subscription_id', subscriptionId)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

// ============================================
// REQUEST CREATION
// ============================================

export async function createMigrationRequest(
  supabase: SupabaseClient<Database>,
  accountId: string,
  input: CreateMigrationRequestInput
): Promise<CreateMigrationRequestResult> {
  return createMigrationRequestRepo(supabase, accountId, input);
}
