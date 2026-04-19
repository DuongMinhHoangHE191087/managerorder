import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { isApplicationError, ApplicationError } from "@/lib/utils/errors";

/**
 * Standardize API Error response
 */
export function createErrorResponse(message: string, code: string, status: number = 400, details?: Record<string, unknown>) {
  return NextResponse.json(
    { 
      error: {
        message,
        code,
        details: Object.keys(details || {}).length > 0 ? details : undefined
      } 
    }, 
    { status }
  );
}

/**
 * Standardize API Success response
 */
export function createSuccessResponse<T>(
  data: T,
  options?: { status?: number; meta?: Record<string, unknown> }
) {
  const { status = 200, meta } = options ?? {};
  return NextResponse.json(
    { data, ...(meta ? { meta } : {}) },
    { status }
  );
}

/**
 * HOC to catch all errors (Zod, Supabase, internal)
 */
export function withErrorHandler<TContext = unknown>(
  handler: (request: NextRequest, ctx: TContext) => Promise<NextResponse | Response>
) {
  return async (request: NextRequest, ctx: TContext) => {
    try {
      return await handler(request, ctx);
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'development') {
        console.error("[API Error]", error);
      }

      // Handle custom Application errors
      if (isApplicationError(error)) {
        return createErrorResponse(
          error.message,
          error.code,
          error.statusCode,
          (error as ApplicationError & { details?: Record<string, unknown> }).details
        );
      }

      // Handle Zod Validation Errors
      if (error instanceof ZodError) {
        return createErrorResponse(
          "Dữ liệu đầu vào không hợp lệ",
          "VALIDATION_ERROR",
          400,
          error.flatten().fieldErrors
        );
      }

      // Determine error message safely for unknown type
      const errorMsg = error instanceof Error ? error.message : "Lỗi máy chủ nội bộ";

      // Fallback 500
      return createErrorResponse(
        errorMsg,
        "INTERNAL_SERVER_ERROR",
        500
      );
    }
  };
}
