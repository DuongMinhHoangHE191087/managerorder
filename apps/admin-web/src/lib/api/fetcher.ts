import { normalizeFlatApiError } from "@/shared/lib/api-error";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 500;

export async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  let lastError: Error | null = null;
  const requestUrl = normalizeRequestUrl(url);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), DEFAULT_TIMEOUT_MS);
    const signal = composeAbortSignals(options?.signal, timeoutController.signal);
    const headers = buildRequestHeaders(options?.headers, options?.body);

    try {
      let res: Response;
      let payload: unknown = null;

      try {
        res = await fetch(requestUrl, {
          ...options,
          cache: "no-store",
          signal,
          headers,
        });

        const responseText = await readResponseBody(res);
        if (responseText !== null) {
          payload = responseText;
        }
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        const fallback =
          res.status >= 500 ? "Lỗi máy chủ nội bộ" : "Yêu cầu không hợp lệ";
        const normalized = normalizeFlatApiError(payload, fallback);
        throw new Error(normalized.error || fallback);
      }

      if (!payload || typeof payload !== "object") {
        return payload as T;
      }

      if ("meta" in payload && payload.meta !== undefined) {
        return payload as T;
      }

      return "data" in payload && payload.data !== undefined
        ? payload.data as T
        : payload as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Only retry on network errors, not HTTP errors
      const isNetworkError = lastError.name === "AbortError" || lastError.message.includes("fetch");
      if (attempt < MAX_RETRIES && isNetworkError) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError ?? new Error("Unexpected fetcher error");
}

function normalizeRequestUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
    return url;
  }

  return `/${url}`;
}

function buildRequestHeaders(headersInit: HeadersInit | undefined, _body: BodyInit | null | undefined) {
  const headers: Record<string, string> = {};

  for (const [key, value] of new Headers(headersInit).entries()) {
    headers[canonicalizeHeaderName(key)] = value;
  }

  if (!hasHeader(headers, "Accept")) {
    headers.Accept = "application/json";
  }

  if (!hasHeader(headers, "Cache-Control")) {
    headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
  }

  if (!hasHeader(headers, "Content-Type")) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function canonicalizeHeaderName(name: string) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("-");
}

function hasHeader(headers: Record<string, string>, name: string) {
  return Object.prototype.hasOwnProperty.call(headers, name);
}

function composeAbortSignals(
  primarySignal: AbortSignal | null | undefined,
  timeoutSignal?: AbortSignal,
): AbortSignal | undefined {
  if (!primarySignal) {
    return timeoutSignal;
  }

  if (!timeoutSignal) {
    return primarySignal;
  }

  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
    return AbortSignal.any([primarySignal, timeoutSignal]);
  }

  const controller = new AbortController();

  const abort = () => {
    if (!controller.signal.aborted) {
      controller.abort(primarySignal.reason ?? timeoutSignal.reason);
    }
  };

  if (primarySignal.aborted || timeoutSignal.aborted) {
    abort();
    return controller.signal;
  }

  primarySignal.addEventListener("abort", abort, { once: true });
  timeoutSignal.addEventListener("abort", abort, { once: true });

  return controller.signal;
}

async function readResponseBody(res: Response): Promise<unknown> {
  if (typeof res.text === "function") {
    const text = await res.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return text;
    }
  }

  if (typeof res.json === "function") {
    return await res.json();
  }

  return null;
}

