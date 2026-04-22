import { vi } from "@/shared/messages/vi";

export interface FlatApiError {
  error: string;
  code?: string;
}

export function normalizeFlatApiError(
  payload: unknown,
  fallback: string = vi.common.serverError,
): FlatApiError {
  if (typeof payload === "string" && payload.trim()) {
    return { error: payload };
  }

  if (!payload || typeof payload !== "object") {
    return { error: fallback };
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.error === "string" && record.error.trim()) {
    return {
      error: record.error,
      ...(typeof record.code === "string" ? { code: record.code } : {}),
    };
  }

  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.message === "string" && nested.message.trim()) {
      return {
        error: nested.message,
        ...(typeof nested.code === "string" ? { code: nested.code } : {}),
      };
    }
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return {
      error: record.message,
      ...(typeof record.code === "string" ? { code: record.code } : {}),
    };
  }

  return { error: fallback };
}
