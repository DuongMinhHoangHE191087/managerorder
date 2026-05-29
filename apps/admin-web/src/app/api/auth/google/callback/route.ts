import { NextResponse, type NextRequest } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import { AuthRepository } from "@/lib/services/auth";
import { generateAccessToken, generateRefreshToken } from "@/lib/utils/jwt";
import { resolveAccountId } from "@/lib/api/with-account";
import { resolveInternalRedirectPath } from "@/widgets/pages/login/login-routing";
import { checkAuthRateLimit, getClientIp } from "@/lib/api/rate-limiter";
import {
  COOKIE_OPTIONS,
  GOOGLE_COOKIE_NAMES,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  clearOAuthCookies,
  createOAuthClient,
  getOAuthCookieValue,
  parseGoogleState,
  type ParsedGoogleState,
} from "@/lib/utils/google-oauth";

// ─── Repository ───────────────────────────────────────────────────────────────

const authRepository = new AuthRepository();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStateCookieValue(
  request: NextRequest,
  mode: ParsedGoogleState["mode"],
): string | null {
  if (mode === "login") {
    return getOAuthCookieValue(request, [
      GOOGLE_COOKIE_NAMES.LOGIN_STATE,
      GOOGLE_COOKIE_NAMES.LEGACY_STATE,
    ]);
  }
  return getOAuthCookieValue(request, [
    GOOGLE_COOKIE_NAMES.CALENDAR_STATE,
    GOOGLE_COOKIE_NAMES.LEGACY_STATE,
  ]);
}

function getLoginNextCookieValue(request: NextRequest): string | null {
  return getOAuthCookieValue(request, [
    GOOGLE_COOKIE_NAMES.LOGIN_NEXT,
    GOOGLE_COOKIE_NAMES.LEGACY_NEXT,
  ]);
}

function buildLoginErrorRedirect(
  request: NextRequest,
  reason: string,
  error = "callback_failed",
) {
  const errorUrl = new URL("/login", request.url);
  errorUrl.searchParams.set("error", error);
  errorUrl.searchParams.set("reason", reason);
  return errorUrl;
}

function redirectLoginError(
  request: NextRequest,
  reason: string,
  error = "callback_failed",
) {
  const response = NextResponse.redirect(
    buildLoginErrorRedirect(request, reason, error),
  );
  clearOAuthCookies(response);
  return response;
}

function buildRedirectResponse(request: NextRequest, nextPath: string) {
  return NextResponse.redirect(new URL(nextPath, request.url));
}

function buildAccessTokenResponse(
  request: NextRequest,
  nextPath: string,
  payload: { userId: string; accountId: string; role: string; email: string },
) {
  const response = buildRedirectResponse(request, nextPath);

  response.cookies.set(
    "access_token",
    generateAccessToken({
      sub: payload.userId,
      accountId: payload.accountId,
      role: payload.role,
      email: payload.email,
    }),
    { ...COOKIE_OPTIONS, maxAge: ACCESS_TOKEN_MAX_AGE },
  );

  response.cookies.set(
    "refresh_token",
    generateRefreshToken({
      sub: payload.userId,
      accountId: payload.accountId,
      role: payload.role,
      email: payload.email,
    }),
    { ...COOKIE_OPTIONS, maxAge: REFRESH_TOKEN_MAX_AGE },
  );

  clearOAuthCookies(response);
  return response;
}

function getCallbackErrorMessage(
  error: string | null,
  description: string | null,
) {
  if (!error) return null;
  return {
    error: error === "access_denied" ? "oauth_denied" : "oauth_error",
    reason: description ?? undefined,
  };
}

async function resolveGoogleLoginEmail(
  oauth2Client: InstanceType<typeof google.auth.OAuth2>,
  code: string,
): Promise<{ email: string }> {
  const { tokens } = await oauth2Client.getToken(code);

  // Prefer id_token (JWT signed by Google — more trustworthy, avoids extra network hop)
  if (tokens.id_token) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error("Missing GOOGLE_CLIENT_ID");

    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    const email = payload?.email?.trim().toLowerCase() ?? null;

    if (!email || payload?.email_verified === false) {
      throw new Error("Google account did not return a verified email");
    }

    return { email };
  }

  // Fallback: userinfo endpoint (for edge cases where id_token is absent)
  if (tokens.access_token) {
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );

    if (userInfoResponse.ok) {
      const userInfo = (await userInfoResponse.json()) as {
        email?: string;
        verified_email?: boolean;
      };
      const email = userInfo.email?.trim().toLowerCase() ?? null;
      if (email && userInfo.verified_email !== false) {
        return { email };
      }
    }
  }

  throw new Error("Google account did not return an email");
}

// ─── CSRF State Verification ──────────────────────────────────────────────────

/**
 * Verifies the OAuth state nonce against the cookie.
 *
 * Rules:
 * 1. Cookie MISSING → always error (session expired — even in dev).
 *    This prevents accepting arbitrary requests with no prior login attempt.
 * 2. Nonce MISMATCH in production → error (possible CSRF attack).
 * 3. Nonce MISMATCH in development → log warning and allow through.
 *    Useful when cookies behave differently on localhost across ports.
 *
 * Returns an error string if verification fails, or null if OK.
 */
function verifyStateCsrf(
  expectedCookieNonce: string | null,
  parsedState: ParsedGoogleState,
): string | null {
  if (!expectedCookieNonce) {
    // Cookie missing or expired — ALWAYS block regardless of NODE_ENV
    return "Session expired or cookie missing. Please try logging in again.";
  }

  if (expectedCookieNonce !== parsedState.nonce) {
    if (process.env.NODE_ENV !== "development") {
      return "State mismatch. Possible CSRF attack or stale session.";
    }
    // Dev-only bypass — log but allow
    console.warn(
      `[GoogleAuth:callback] State nonce mismatch bypassed in development.`,
    );
  }

  return null; // ✅ verified
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Rate limiting — prevents brute-force code exchange attacks
  const ip = getClientIp(request);
  const rateLimit = await checkAuthRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) },
      },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");
  const providerErrorDescription = searchParams.get("error_description");
  const state = parseGoogleState(searchParams.get("state"));
  const oauth2Client = createOAuthClient(request);

  if (!oauth2Client) {
    return NextResponse.redirect(
      buildLoginErrorRedirect(
        request,
        "Google OAuth chua duoc cau hinh. Kiem tra GOOGLE_CLIENT_ID va GOOGLE_CLIENT_SECRET.",
      ),
    );
  }

  // ── Provider returned an error ──────────────────────────────────────────────
  if (providerError) {
    if (state?.mode === "login") {
      const mapped = getCallbackErrorMessage(providerError, providerErrorDescription);
      return redirectLoginError(
        request,
        mapped?.reason ?? "Google OAuth dang bi tu choi.",
        mapped?.error ?? "oauth_error",
      );
    }
    return NextResponse.json(
      { error: `Google Auth Error: ${providerError}` },
      { status: 400 },
    );
  }

  // ── Missing code or state ───────────────────────────────────────────────────
  if (!code || !state) {
    if (state?.mode === "login" || getLoginNextCookieValue(request)) {
      return redirectLoginError(request, "Missing code or state from Google OAuth.");
    }
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  // ── CSRF State Verification ────────────────────────────────────────────────
  const expectedCookieNonce = getStateCookieValue(request, state.mode);
  const csrfError = verifyStateCsrf(expectedCookieNonce, state);
  if (csrfError) {
    if (state.mode === "login") {
      return redirectLoginError(request, csrfError);
    }
    return NextResponse.json(
      { error: csrfError },
      { status: 403 },
    );
  }

  // ── Process callback ───────────────────────────────────────────────────────
  try {
    // Login flow
    if (state.mode === "login") {
      const nextPath = resolveInternalRedirectPath(
        getLoginNextCookieValue(request),
        null,
      );

      const { email } = await resolveGoogleLoginEmail(oauth2Client, code);
      console.info(`[GoogleAuth:callback] Login attempt — email=${email} ip=${ip}`);

      const user = await authRepository.findUserByEmail(email);
      if (!user) {
        console.warn(`[GoogleAuth:callback] Email not in admin_users — email=${email}`);
        return redirectLoginError(
          request,
          "Tai khoan Google nay chua duoc cap quyen truy cap admin.",
        );
      }

      console.info(`[GoogleAuth:callback] Login success — userId=${user.id} accountId=${user.accountId}`);
      return buildAccessTokenResponse(request, nextPath, {
        userId: user.id,
        accountId: user.accountId,
        role: user.role,
        email: user.email,
      });
    }

    // Calendar flow
    const sessionAccountId = await resolveAccountId(request);
    if (!sessionAccountId) {
      return NextResponse.json(
        { error: "Unauthorized - phien dang nhap khong hop le" },
        { status: 401 },
      );
    }

    if (sessionAccountId !== state.accountId) {
      return NextResponse.json(
        { error: "State mismatch. Possible CSRF attack or invalid session." },
        { status: 403 },
      );
    }

    const { tokens } = await oauth2Client.getToken(code);

    const { data: existing } = await supabase
      .from("integrations")
      .select("id")
      .eq("account_id", sessionAccountId)
      .eq("provider", "google")
      .single();

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null;

    if (existing) {
      await supabase
        .from("integrations")
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || undefined,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("integrations").insert({
        account_id: sessionAccountId,
        provider: "google",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
      });
    }

    console.info(`[GoogleAuth:callback] Calendar connected — accountId=${sessionAccountId}`);

    const uiUrl = new URL("/calendar", request.url);
    uiUrl.searchParams.set("gcal_connected", "true");
    const response = NextResponse.redirect(uiUrl);
    clearOAuthCookies(response);
    return response;
  } catch (error: unknown) {
    console.error("[GoogleAuth:callback] Error:", error);

    if (state.mode === "login") {
      return redirectLoginError(
        request,
        error instanceof Error ? error.message : "Failed to exchange token",
      );
    }

    return NextResponse.json(
      {
        error: "Failed to exchange token",
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
