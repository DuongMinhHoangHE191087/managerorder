// ============================================
// PACKAGES API - GET/UPDATE/DELETE SINGLE
// ============================================
// GET    /api/premium/packages/[id] - Get specific package
// PUT    /api/premium/packages/[id] - Update package
// DELETE /api/premium/packages/[id] - Soft delete package
// ============================================

import { NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import {
  successResponse,
  updatedResponse,
  deletedResponse,
  errorResponse,
  notFoundResponse,
  softDelete,
  validateSlug,
  badRequestResponse,
} from '@/lib/utils/api-helpers';
import { withAccount } from '@/lib/api/with-account';
import { withErrorHandler } from '@/lib/api/with-error-handler';
import type {
  PremiumPackage,
  UpdatePremiumPackage,
} from '@/lib/types/premium';
import { loadRowsByIds } from "@/app/api/premium/relation-fallback";

// ============================================
// GET - Get specific package
// ============================================

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;

    // Fetch package with service type info
    const { data: basePackage, error } = await supabase
      .from('premium_packages')
      .select('*')
      .eq('id', id)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .single();

    if (error || !basePackage) {
      return notFoundResponse('Package');
    }

    const serviceTypeMap = await loadRowsByIds<{
      id: string;
      name: string;
      slug: string;
    }>(
      supabase,
      "premium_service_types",
      accountId,
      [basePackage.service_type_id].filter((serviceTypeId): serviceTypeId is string => Boolean(serviceTypeId)),
      "id, name, slug",
    );

    return successResponse({
      ...basePackage,
      premium_service_types: serviceTypeMap.get(basePackage.service_type_id) ?? null,
    } as unknown as PremiumPackage);
  })
);

// ============================================
// PUT - Update package
// ============================================

export const PUT = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;

    // Parse body
    const body = await request.json();

    // Validate slug if provided
    if (body.slug && !validateSlug(body.slug)) {
      return badRequestResponse(
        'Slug must contain only lowercase letters, numbers, and hyphens'
      );
    }

    // Validate billing cycles if provided
    if (body.billing_cycles) {
      if (
        !Array.isArray(body.billing_cycles) ||
        body.billing_cycles.length === 0
      ) {
        return badRequestResponse(
          'billing_cycles must be a non-empty array'
        );
      }

      const validCycles = ['1month', '3months', '6months', '1year'];
      const invalidCycles = body.billing_cycles.filter(
        (cycle: string) => !validCycles.includes(cycle)
      );
      if (invalidCycles.length > 0) {
        return badRequestResponse(
          `Invalid billing cycles: ${invalidCycles.join(', ')}`
        );
      }
    }

    // Validate renewal price factor if provided
    if (
      body.renewal_price_factor !== undefined &&
      (body.renewal_price_factor < 0.9 || body.renewal_price_factor > 1.1)
    ) {
      return badRequestResponse(
        'renewal_price_factor must be between 0.9 and 1.1'
      );
    }

    // Prepare update data
    const updateData: UpdatePremiumPackage = {
      ...(body.name && { name: body.name }),
      ...(body.slug && { slug: body.slug }),
      ...(body.description !== undefined && {
        description: body.description,
      }),
      ...(body.total_slots !== undefined && {
        total_slots: body.total_slots,
      }),
      ...(body.default_price !== undefined && {
        default_price: body.default_price,
      }),
      ...(body.billing_cycles && { billing_cycles: body.billing_cycles }),
      ...(body.allow_flexible_renewal_pricing !== undefined && {
        allow_flexible_renewal_pricing: body.allow_flexible_renewal_pricing,
      }),
      ...(body.renewal_price_factor !== undefined && {
        renewal_price_factor: body.renewal_price_factor,
      }),
      ...(body.features !== undefined && { features: body.features }),
      ...(body.is_active !== undefined && { is_active: body.is_active }),
      ...(body.sort_order !== undefined && { sort_order: body.sort_order }),
      updated_at: new Date().toISOString(),
    };

    // Update in database
    const { data, error } = await supabase
      .from('premium_packages')
      .update(updateData)
      .eq('id', id)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return errorResponse(
          'Package with this slug already exists for your account',
          409
        );
      }

      console.error('[PUT /api/premium/packages/[id]] Error:', error);
      return errorResponse(error.message);
    }

    if (!data) {
      return notFoundResponse('Package');
    }

    return updatedResponse(
      data as PremiumPackage,
      'Package updated successfully'
    );
  })
);

// ============================================
// DELETE - Soft delete package
// ============================================

export const DELETE = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;

    // Soft delete (set deleted_at)
    const { data, error } = await supabase
      .from('premium_packages')
      .update(softDelete())
      .eq('id', id)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('[DELETE /api/premium/packages/[id]] Error:', error);
      return errorResponse(error.message);
    }

    if (!data) {
      return notFoundResponse('Package');
    }

    return deletedResponse('Package deleted successfully');
  })
);
