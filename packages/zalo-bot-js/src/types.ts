export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export type TimeoutProfile = "short" | "standard" | "long_poll";

export interface TimeoutPolicy {
  shortMs?: number;
  standardMs?: number;
  longPollMs?: number;
}

export type RetryErrorKind =
  | "timed_out"
  | "network_error"
  | "conflict"
  | "retry_after"
  | "bad_request"
  | "forbidden"
  | "invalid_token"
  | "zalo_error";

export interface RetryPolicy {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  retryOn?: RetryErrorKind[];
}

export interface RequestAttemptContext {
  url: string;
  method: "GET" | "POST";
  data?: Record<string, unknown>;
  attempt: number;
}

export interface RequestResponseContext extends RequestAttemptContext {
  durationMs: number;
  responseStatus?: number;
  responseBody?: string;
  error?: unknown;
}

export interface RequestHooks {
  beforeRequest?: (context: RequestAttemptContext) => Promise<void> | void;
  afterResponse?: (context: RequestResponseContext) => Promise<void> | void;
}

export interface RequestOptions {
  readTimeout?: number;
  writeTimeout?: number;
  connectTimeout?: number;
  poolTimeout?: number;
  signal?: AbortSignal;
  timeoutProfile?: TimeoutProfile;
  timeoutPolicy?: TimeoutPolicy;
  retryPolicy?: RetryPolicy;
  hooks?: RequestHooks;
  headers?: Record<string, string>;
}

export interface SocialProfile {
  id: string;
  name: string;
  picture?: {
    data: {
      url: string;
    };
  };
  birthday?: string;
  gender?: string;
  error?: number;
  message?: string;
}

export interface SocialFriend {
  id: string;
  name: string;
  picture?: {
    data: {
      url: string;
    };
  };
  birthday?: string;
  gender?: string;
}

export interface SocialFriendList {
  data: SocialFriend[];
  paging?: {
    next?: string;
    previous?: string;
  };
  summary?: {
    total_count: number;
  };
  error?: number;
  message?: string;
}

export interface SocialMessageOptions {
  link?: string;
  requestOptions?: RequestOptions;
}

export interface SocialPostFeedOptions {
  link?: string;
  requestOptions?: RequestOptions;
}
