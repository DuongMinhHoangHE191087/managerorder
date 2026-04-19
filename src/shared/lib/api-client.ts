import { normalizeFlatApiError, type FlatApiError } from "@/shared/lib/api-error";

export interface ApiEnvelope<T> {
  data?: T;
  meta?: Record<string, unknown>;
  error?: string;
  code?: string;
}

export function normalizeApiError(
  payload: unknown,
  fallback = "Lỗi máy chủ nội bộ",
): FlatApiError {
  return normalizeFlatApiError(payload, fallback);
}

export async function readApiEnvelope<T>(
  response: Response,
): Promise<ApiEnvelope<T>> {
  try {
    const payload = (await response.json()) as ApiEnvelope<T> | unknown;

    if (!response.ok) {
      return normalizeApiError(payload);
    }

    if (!payload || typeof payload !== "object") {
      return {};
    }

    return payload as ApiEnvelope<T>;
  } catch {
    if (!response.ok) {
      return {
        error: response.status >= 500 ? "Lỗi máy chủ nội bộ" : "Yêu cầu không hợp lệ",
      };
    }

    return {};
  }
}
