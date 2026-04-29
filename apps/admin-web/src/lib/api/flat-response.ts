import { NextRequest, NextResponse } from "next/server";
import { createSuccessResponse, withErrorHandler } from "@/lib/api/with-error-handler";
import { withAccount, type ApiHandler } from "@/lib/api/with-account";
import { normalizeFlatApiError, type FlatApiError } from "@/shared/lib/api-error";

export interface FlatApiSuccess<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export function createFlatErrorResponse(
  error: string,
  status = 400,
  code?: string,
) {
  return NextResponse.json(
    {
      error,
      ...(code ? { code } : {}),
    } satisfies FlatApiError,
    { status },
  );
}

export async function flattenErrorResponse(response: NextResponse | Response) {
  const fallback =
    response.status >= 500 ? "Lỗi máy chủ nội bộ" : "Yêu cầu không hợp lệ";

  if (process.env.CODEX_DEBUG_API_ERRORS === "1") {
    try {
      const raw = await response.clone().text();
      console.error("[API Flat Error]", response.status, raw);
    } catch (error) {
      console.error("[API Flat Error] Unable to inspect response body:", error);
    }
  }

  try {
    const payload = await response.clone().json();
    return NextResponse.json(normalizeFlatApiError(payload, fallback), {
      status: response.status,
    });
  } catch {
    return createFlatErrorResponse(fallback, response.status || 500);
  }
}

export function withFlatErrorHandler<TContext = unknown>(
  handler: (request: NextRequest, ctx: TContext) => Promise<NextResponse | Response>,
) {
  const wrapped = withErrorHandler(handler);

  return async (request: NextRequest, ctx: TContext) => {
    const response = await wrapped(request, ctx);
    if (response.ok) {
      return response;
    }
    return flattenErrorResponse(response);
  };
}

export function withFlatAccountHandler<TParams extends object = Record<string, never>>(
  handler: ApiHandler<TParams>,
) {
  return withFlatErrorHandler(withAccount(handler));
}

export function createFlatSuccessResponse<T>(
  data: T,
  options?: { status?: number; meta?: Record<string, unknown> },
) {
  return createSuccessResponse(data, options);
}
