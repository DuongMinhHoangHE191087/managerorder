export const BASE_URL = "https://bot-api.zapps.me";
export const ZALO_GRAPH_API_BASE = "https://graph.zalo.me/v2.0";
export const ZALO_BUSINESS_API_BASE = "https://business.openapi.zalo.me";


export const DEFAULT_POLL_TIMEOUT_SECONDS = 30;
export const DEFAULT_RETRY_DELAY_MS = 1000;

export const ChatAction = {
  TYPING: "typing",
} as const;

export type ChatAction = (typeof ChatAction)[keyof typeof ChatAction];
