import { TimedOut, NetworkError } from "../errors";
import type { RequestOptions } from "../types";
import { BaseRequest, type RequestPayload, type TransportResponse } from "./BaseRequest";

export interface FetchRequestConfig {
  readTimeout?: number;
  timeoutPolicy?: {
    shortMs?: number;
    standardMs?: number;
    longPollMs?: number;
  };
}

export class FetchRequest extends BaseRequest {
  readonly readTimeout?: number;

  constructor(private readonly config: FetchRequestConfig = {}) {
    super();
    this.readTimeout = config.readTimeout ?? 15000;
  }

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {}

  protected async doRequest(
    url: string,
    method: "GET" | "POST",
    data?: RequestPayload,
    options?: RequestOptions,
  ): Promise<TransportResponse> {
    const timeoutMs = this.resolveTimeout(options);
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const signal = mergeSignals(options?.signal, timeoutController.signal);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "zalo-bot-js",
          ...options?.headers,
        },
        body: method === "POST" ? JSON.stringify(this.compactPayload(data)) : undefined,
        signal,
      });

      return {
        status: response.status,
        body: await response.text(),
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        if (options?.signal?.aborted) {
          throw new TimedOut("Request aborted");
        }
        throw new TimedOut();
      }
      throw new NetworkError(`fetch.${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private resolveTimeout(options?: RequestOptions): number {
    const explicitPolicy = options?.timeoutPolicy;
    const configPolicy = this.config.timeoutPolicy;
    const profile = options?.timeoutProfile ?? "standard";
    const profileTimeout =
      profile === "short"
        ? explicitPolicy?.shortMs ?? configPolicy?.shortMs
        : profile === "long_poll"
          ? explicitPolicy?.longPollMs ?? configPolicy?.longPollMs
          : explicitPolicy?.standardMs ?? configPolicy?.standardMs;
    if (typeof profileTimeout === "number" && Number.isFinite(profileTimeout)) {
      return Math.max(profileTimeout, 0);
    }

    const readTimeoutSeconds = options?.readTimeout;

    if (typeof readTimeoutSeconds === "number" && Number.isFinite(readTimeoutSeconds)) {
      return Math.max(readTimeoutSeconds, 0) * 1000;
    }

    return this.readTimeout ?? 5000;
  }

  private compactPayload(data?: RequestPayload): Record<string, string | number | boolean> {
    if (!data) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined && value !== null),
    ) as Record<string, string | number | boolean>;
  }
}

function mergeSignals(signalA?: AbortSignal, signalB?: AbortSignal): AbortSignal | undefined {
  if (!signalA) {
    return signalB;
  }
  if (!signalB) {
    return signalA;
  }
  if (signalA.aborted || signalB.aborted) {
    const controller = new AbortController();
    controller.abort();
    return controller.signal;
  }

  const controller = new AbortController();
  const abort = () => {
    controller.abort();
    signalA.removeEventListener("abort", abort);
    signalB.removeEventListener("abort", abort);
  };
  signalA.addEventListener("abort", abort, { once: true });
  signalB.addEventListener("abort", abort, { once: true });
  return controller.signal;
}
