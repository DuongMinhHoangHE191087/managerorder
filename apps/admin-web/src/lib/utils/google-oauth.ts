/**
 * google-oauth.ts — Shared utilities for Custom Google OAuth (Mechanism 1).
 *
 * Single source of truth for:
 * - Cookie names and options
 * - Dynamic redirect URI resolution (supports reverse proxies / multi-domain)
 * - OAuth2 client factory
 * - State parse/encode for CSRF nonce
 * - Token expiry parsing (sync cookie maxAge with JWT env vars)
 */

import { google } from "googleapis";
import type { NextRequest, NextResponse } from "next/server";

// ─── Cookie Names ────────────────────────────────────────────────────────────

export const GOOGLE_COOKIE_NAMES = {
  LOGIN_STATE: "google_login_oauth_state",
  LOGIN_NEXT: "google_login_oauth_next",
  CALENDAR_STATE: "google_calendar_oauth_state",
  /** @deprecated use LOGIN_STATE */
  LEGACY_STATE: "google_oauth_state",
  /** @deprecated use LOGIN_NEXT */
  LEGACY_NEXT: "google_oauth_next",
} as const;

// ─── Cookie Options ───────────────────────────────────────────────────────────

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// ─── OAuth Scopes ─────────────────────────────────────────────────────────────

export const GOOGLE_LOGIN_SCOPES: string[] = ["openid", "email", "profile"];
export const GOOGLE_CALENDAR_SCOPES: string[] = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

// ─── Redirect URI Resolution ──────────────────────────────────────────────────

/**
 * Resolves the OAuth redirect URI.
 * Prioritizes canonical environment variables (e.g., NEXT_PUBLIC_APP_URL) in production
 * to prevent mismatch errors due to reverse proxies/tunnels not forwarding headers correctly.
 * Dynamically falls back to request headers for localhost development and Vercel previews.
 */
export function getRedirectUri(request: NextRequest): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.APP_URL;

  if (configuredUrl) {
    try {
      const parsed = new URL(configuredUrl);
      const requestUrl = new URL(request.url);

      // Local development auto-fallback: if request is local, use dynamic localhost origin
      // so developers don't have to manually swap .env values between dev and prod.
      const isLocalhostRequest =
        requestUrl.hostname === "localhost" ||
        requestUrl.hostname === "127.0.0.1" ||
        requestUrl.hostname.startsWith("192.168.");

      if (!isLocalhostRequest && parsed.protocol.startsWith("http")) {
        return `${parsed.protocol}//${parsed.host}/api/auth/google/callback`;
      }
    } catch {
      // Safely ignore parsing issues and fall back
    }
  }

  const url = new URL(request.url);
  const proto =
    request.headers.get("x-forwarded-proto") ||
    url.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    url.host;
  return `${proto}://${host}/api/auth/google/callback`;
}

// ─── OAuth Client Factory ─────────────────────────────────────────────────────

/**
 * Creates a Google OAuth2 client with dynamic redirect URI.
 * Returns `null` if env vars are missing (caller must handle gracefully).
 */
export function createOAuthClient(
  request: NextRequest,
): InstanceType<typeof google.auth.OAuth2> | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri(request));
}

// ─── State Parsing ────────────────────────────────────────────────────────────

export type ParsedGoogleState =
  | { mode: "login"; nonce: string }
  | { mode: "calendar"; accountId: string; nonce: string };

/**
 * Parses the OAuth state parameter.
 * Format: `login:<nonce>` or `calendar:<accountId>:<nonce>`
 */
export function parseGoogleState(state: string | null): ParsedGoogleState | null {
  if (!state) return null;

  if (state.startsWith("login:")) {
    const nonce = state.slice("login:".length).trim();
    return nonce ? { mode: "login", nonce } : null;
  }

  if (state.startsWith("calendar:")) {
    const remainder = state.slice("calendar:".length);
    const [accountId, nonce] = remainder.split(":");
    if (!accountId || !nonce) return null;
    return { mode: "calendar", accountId, nonce };
  }

  return null;
}

// ─── Cookie Helpers ───────────────────────────────────────────────────────────

/**
 * Clears all OAuth-related cookies (login state, next path, calendar state, and legacy).
 */
export function clearOAuthCookies(response: NextResponse): void {
  for (const name of Object.values(GOOGLE_COOKIE_NAMES)) {
    response.cookies.set(name, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  }
}

/**
 * Reads first non-empty cookie value from a list of cookie names.
 * Supports fallback to legacy cookie names.
 */
export function getOAuthCookieValue(
  request: NextRequest,
  names: string[],
): string | null {
  for (const name of names) {
    const value = request.cookies.get(name)?.value?.trim();
    if (value) return value;
  }
  return null;
}

// ─── Token Expiry Parsing ─────────────────────────────────────────────────────

/**
 * Parses a JWT expiry string (e.g., "24h", "7d", "3600") into seconds.
 * Falls back to `defaultSeconds` if parsing fails.
 *
 * Keeps cookie `maxAge` in sync with `JWT_ACCESS_TOKEN_EXPIRY` /
 * `JWT_REFRESH_TOKEN_EXPIRY` environment variables.
 */
export function parseExpiryToSeconds(
  value: string | undefined,
  defaultSeconds: number,
): number {
  if (!value) return defaultSeconds;
  const trimmed = value.trim();

  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return isNaN(n) || n <= 0 ? defaultSeconds : n;
  }

  const match = trimmed.match(/^(\d+)([smhd])$/i);
  if (!match) return defaultSeconds;

  const [, numStr, unit] = match;
  const num = parseInt(numStr, 10);
  if (isNaN(num) || num <= 0) return defaultSeconds;

  switch (unit.toLowerCase()) {
    case "s": return num;
    case "m": return num * 60;
    case "h": return num * 3600;
    case "d": return num * 86400;
    default:  return defaultSeconds;
  }
}

export const ACCESS_TOKEN_MAX_AGE = parseExpiryToSeconds(
  process.env.JWT_ACCESS_TOKEN_EXPIRY,
  60 * 60 * 24, // 24h default
);

export const REFRESH_TOKEN_MAX_AGE = parseExpiryToSeconds(
  process.env.JWT_REFRESH_TOKEN_EXPIRY,
  60 * 60 * 24 * 7, // 7d default
);
