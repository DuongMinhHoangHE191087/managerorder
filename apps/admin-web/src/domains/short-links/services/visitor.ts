import { isIP } from "node:net";
import type { ShortLinkClickEventType, ShortLinkClickRecord } from "./click-log";

export type ShortLinkIpVersion = "IPv4" | "IPv6" | "unknown";

export interface ShortLinkVisitorFingerprint {
  ipAddress: string;
  ipVersion: ShortLinkIpVersion;
  ipSource: string;
  userAgent: string | null;
  referer: string | null;
  deviceType: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
  browser: string;
  isAutomated: boolean;
  suspiciousReason: string | null;
  trafficSource: string;
}

const EXPLICIT_BOT_PATTERNS =
  /bot|spider|crawler|crawl|slurp|facebookexternalhit|facebot|telegrambot|twitterbot|discordbot|linkedinbot|slackbot|skypeuripreview|curl|wget|python|httpie|postman|insomnia|headless|phantomjs|playwright|puppeteer|ia_archiver/i;
const SOCIAL_PREVIEW_PATTERNS = /zalo|whatsapp|preview/i;
const TABLET_PATTERNS = /tablet|ipad|nexus 7|nexus 10|kindle|silk/i;
const MOBILE_PATTERNS = /mobile|android|iphone|ipod|opera mini|iemobile|blackberry|windows phone/i;

const HEADER_PRIORITY: Array<{ name: string; split?: boolean }> = [
  { name: "cf-connecting-ip" },
  { name: "true-client-ip" },
  { name: "x-real-ip" },
  { name: "x-client-ip" },
  { name: "x-vercel-forwarded-for", split: true },
  { name: "x-forwarded-for", split: true },
];

function normalizeIpCandidate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  let candidate = value.trim().replace(/^"|"$/g, "");
  if (!candidate || candidate.toLowerCase() === "unknown") {
    return null;
  }

  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  }

  const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) {
    return ipv4WithPort[1] ?? null;
  }

  if (candidate.startsWith("::ffff:")) {
    const mappedIpv4 = candidate.slice("::ffff:".length);
    if (detectIpVersion(mappedIpv4) === "IPv4") {
      return mappedIpv4;
    }
  }

  return candidate;
}

function parseForwardedHeader(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.match(/(?:^|;)\s*for=([^;]+)/i)?.[1])
    .filter((entry): entry is string => Boolean(entry))
    .map((entry) => entry.trim());
}

function isIpv4(ip: string): boolean {
  return isIP(ip) === 4;
}

function isIpv6(ip: string): boolean {
  return isIP(ip) === 6;
}

export function detectIpVersion(ip: string | null | undefined): ShortLinkIpVersion {
  const normalized = normalizeIpCandidate(ip);
  if (!normalized) {
    return "unknown";
  }
  if (isIpv4(normalized)) {
    return "IPv4";
  }
  if (isIpv6(normalized)) {
    return "IPv6";
  }
  return "unknown";
}

export function extractVisitorIp(headers: Headers): Pick<
  ShortLinkVisitorFingerprint,
  "ipAddress" | "ipVersion" | "ipSource"
> {
  for (const header of HEADER_PRIORITY) {
    const raw = headers.get(header.name);
    const candidates = header.split ? (raw ?? "").split(",") : [raw];

    for (const candidate of candidates) {
      const ipAddress = normalizeIpCandidate(candidate);
      const ipVersion = detectIpVersion(ipAddress);
      if (ipAddress && ipVersion !== "unknown") {
        return { ipAddress, ipVersion, ipSource: header.name };
      }
    }
  }

  for (const candidate of parseForwardedHeader(headers.get("forwarded"))) {
    const ipAddress = normalizeIpCandidate(candidate);
    const ipVersion = detectIpVersion(ipAddress);
    if (ipAddress && ipVersion !== "unknown") {
      return { ipAddress, ipVersion, ipSource: "forwarded" };
    }
  }

  return { ipAddress: "0.0.0.0", ipVersion: "IPv4", ipSource: "fallback" };
}

export function detectDeviceType(userAgent: string | null | undefined): ShortLinkVisitorFingerprint["deviceType"] {
  const ua = userAgent?.trim();
  if (!ua) {
    return "unknown";
  }
  const looksMobile = MOBILE_PATTERNS.test(ua) || TABLET_PATTERNS.test(ua);
  if (EXPLICIT_BOT_PATTERNS.test(ua) || (SOCIAL_PREVIEW_PATTERNS.test(ua) && !looksMobile)) {
    return "bot";
  }
  if (TABLET_PATTERNS.test(ua)) {
    return "tablet";
  }
  if (MOBILE_PATTERNS.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

export function detectBrowser(userAgent: string | null | undefined): string {
  const ua = userAgent?.trim();
  if (!ua) {
    return "Không rõ";
  }

  const patterns: Array<[RegExp, string]> = [
    [/Zalo\//i, "Zalo"],
    [/TelegramBot/i, "Telegram Bot"],
    [/FBAN|FBAV|FacebookExternalHit|Facebot/i, "Facebook"],
    [/Edg\//i, "Edge"],
    [/OPR\/|Opera/i, "Opera"],
    [/Chrome\/[\d.]+.*Safari/i, "Chrome"],
    [/Version\/[\d.]+.*Safari/i, "Safari"],
    [/Firefox\//i, "Firefox"],
    [/curl|wget|python|httpie|postman|insomnia|headless|playwright|puppeteer/i, "CLI/Bot"],
  ];

  return patterns.find(([pattern]) => pattern.test(ua))?.[1] ?? "Khác";
}

export function parseTrafficSource(referer: string | null | undefined): string {
  if (!referer) {
    return "direct";
  }

  try {
    return new URL(referer).hostname;
  } catch {
    return "invalid_referer";
  }
}

export function getShortLinkVisitorFingerprint(headers: Headers): ShortLinkVisitorFingerprint {
  const { ipAddress, ipVersion, ipSource } = extractVisitorIp(headers);
  const userAgent = headers.get("user-agent");
  const referer = headers.get("referer");
  const deviceType = detectDeviceType(userAgent);
  const isAutomated = deviceType === "bot" || !userAgent;
  const suspiciousReason =
    !userAgent ? "empty_user_agent" : deviceType === "bot" ? "bot_user_agent" : null;

  return {
    ipAddress,
    ipVersion,
    ipSource,
    userAgent,
    referer,
    deviceType,
    browser: detectBrowser(userAgent),
    isAutomated,
    suspiciousReason,
    trafficSource: parseTrafficSource(referer),
  };
}

export function createShortLinkClickRecord(
  shortLinkId: string,
  eventType: ShortLinkClickEventType,
  visitor: ShortLinkVisitorFingerprint,
  overrides: Partial<Pick<ShortLinkClickRecord, "is_suspicious" | "suspicious_reason">> = {},
): ShortLinkClickRecord {
  return {
    short_link_id: shortLinkId,
    ip_address: visitor.ipAddress,
    user_agent: visitor.userAgent,
    referer: visitor.referer,
    device_type: visitor.deviceType,
    is_suspicious: overrides.is_suspicious ?? visitor.isAutomated,
    suspicious_reason: overrides.suspicious_reason ?? visitor.suspiciousReason,
    ip_version: visitor.ipVersion,
    event_type: eventType,
  };
}
