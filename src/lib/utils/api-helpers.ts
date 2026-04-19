// ============================================
// API RESPONSE UTILITIES
// ============================================
// Helper functions for consistent API responses
// Date: March 5, 2026
// ============================================

import { NextResponse } from 'next/server';
import type { ApiResponse, PaginatedResponse } from '../types/premium';

// ============================================
// SUCCESS RESPONSES
// ============================================

export function successResponse<T>(
  data: T,
  message?: string,
  status = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message }),
    },
    { status }
  );
}

export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  status = 200
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
    { status }
  );
}

export function createdResponse<T>(
  data: T,
  message = 'Resource created successfully'
): NextResponse<ApiResponse<T>> {
  return successResponse(data, message, 201);
}

export function updatedResponse<T>(
  data: T,
  message = 'Resource updated successfully'
): NextResponse<ApiResponse<T>> {
  return successResponse(data, message, 200);
}

export function deletedResponse(
  message = 'Resource deleted successfully'
): NextResponse<ApiResponse<null>> {
  return successResponse(null, message, 200);
}

// ============================================
// ERROR RESPONSES
// ============================================

export function errorResponse(
  error: string,
  status = 400
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

export function badRequestResponse(
  error: string
): NextResponse<ApiResponse> {
  return errorResponse(error, 400);
}

export function unauthorizedResponse(
  error = 'Unauthorized access'
): NextResponse<ApiResponse> {
  return errorResponse(error, 401);
}

export function forbiddenResponse(
  error = 'Forbidden'
): NextResponse<ApiResponse> {
  return errorResponse(error, 403);
}

export function notFoundResponse(
  resource = 'Resource'
): NextResponse<ApiResponse> {
  return errorResponse(`${resource} not found`, 404);
}

export function conflictResponse(
  error: string
): NextResponse<ApiResponse> {
  return errorResponse(error, 409);
}

export function validationErrorResponse(
  errors: Record<string, string[]>
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: 'Validation failed',
      errors,
    },
    { status: 422 }
  );
}

export function serverErrorResponse(
  error = 'Internal server error'
): NextResponse<ApiResponse> {
  if (process.env.NODE_ENV === 'development') {
    console.error('[API Error]', error);
  }
  return errorResponse(error, 500);
}

// ============================================
// ERROR HANDLER WRAPPER
// ============================================

export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  if (process.env.NODE_ENV === 'development') {
    console.error('[API Error]', error);
  }

  if (error instanceof Error) {
    // Known error
    return errorResponse(error.message, 500);
  }

  if (typeof error === 'string') {
    return errorResponse(error, 500);
  }

  return serverErrorResponse();
}

// ============================================
// VALIDATION HELPERS
// ============================================

export function validateRequiredFields(
  data: Record<string, unknown>,
  requiredFields: string[]
): { isValid: boolean; errors: Record<string, string[]>; missingFields: string[] } {
  const errors: Record<string, string[]> = {};
  const missingFields: string[] = [];

  requiredFields.forEach((field) => {
    if (data[field] == null || data[field] === '') {
      errors[field] = [`${field} is required`];
      missingFields.push(field);
    }
  });

  return {
    isValid: missingFields.length === 0,
    errors,
    missingFields,
  };
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9-]+$/;
  return slugRegex.test(slug);
}

// ============================================
// PAGINATION HELPERS
// ============================================

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function getPaginationParams(
  searchParams: URLSearchParams
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('limit') || '20', 10))
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

// ============================================
// QUERY HELPERS
// ============================================

export function getSortParams(searchParams: URLSearchParams): {
  sort: string;
  order: 'asc' | 'desc';
} {
  const sort = searchParams.get('sort') || 'created_at';
  const order =
    (searchParams.get('order') as 'asc' | 'desc') || 'desc';

  return { sort, order };
}

export function getSearchParam(searchParams: URLSearchParams): string | null {
  return searchParams.get('search') || null;
}


export function validateAccountAccess(
  accountId: string | null
): { isValid: boolean; error?: string } {
  if (!accountId) {
    return {
      isValid: false,
      error: 'Account ID is required (multi-tenant isolation)',
    };
  }

  return { isValid: true };
}

// ============================================
// SOFT DELETE HELPERS
// ============================================

export function getSoftDeleteFilter() {
  return { deleted_at: null };
}

export function softDelete() {
  return { deleted_at: new Date().toISOString() };
}

// ============================================
// PASSWORD ENCRYPTION
// ============================================

export interface PasswordEncryption {
  encrypted: string;
  key: string;
}

export function getEncryptionKey(): string {
  const key = process.env.PREMIUM_PASSWORD_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('PREMIUM_PASSWORD_ENCRYPTION_KEY is not set');
  }
  return key;
}

// Note: Actual encryption will be done in Supabase using pgp_sym_encrypt
// This is just a placeholder for the API layer

// ============================================
// DATE HELPERS
// ============================================

export function addMonths(date: Date, months: number): Date {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
}

export function getDaysRemaining(expiryDate: string): number {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isExpiringSoon(expiryDate: string, daysThreshold = 7): boolean {
  const daysRemaining = getDaysRemaining(expiryDate);
  return daysRemaining > 0 && daysRemaining <= daysThreshold;
}

// ============================================
// REFUND CALCULATION
// ============================================

export function calculateProratedRefund(
  originalPrice: number,
  startDate: string,
  expiryDate: string
): number {
  const now = new Date();
  const start = new Date(startDate);
  const expiry = new Date(expiryDate);

  const totalDays = Math.ceil(
    (expiry.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const remainingDays = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (remainingDays <= 0) {
    return 0; // Already expired
  }

  const refund = (remainingDays / totalDays) * originalPrice;
  return Math.round(refund * 100) / 100; // Round to 2 decimals
}

// ============================================
// BILLING CYCLE HELPERS
// ============================================

export function getMonthsFromBillingCycle(
  cycle: '1month' | '3months' | '6months' | '1year'
): number {
  const map: Record<string, number> = {
    '1month': 1,
    '3months': 3,
    '6months': 6,
    '1year': 12,
  };
  return map[cycle] || 1;
}

export function calculateExpiryDate(
  startDate: Date,
  billingCycle: '1month' | '3months' | '6months' | '1year'
): Date {
  const months = getMonthsFromBillingCycle(billingCycle);
  return addMonths(startDate, months);
}
