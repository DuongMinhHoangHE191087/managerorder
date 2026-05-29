import { NextResponse, type NextRequest } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import { AuthRepository } from "@/lib/services/auth";
import { generateAccessToken, generateRefreshToken } from "@/lib/utils/jwt";
import { resolveAccountId } from "@/lib/api/with-account";
import { resolveInternalRedirectPath } from "@/widgets/pages/login/login-routing";

const authRepository = new AuthRepository();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

const GOOGLE_LOGIN_STATE_COOKIE = "google_login_oauth_state";
const GOOGLE_LOGIN_NEXT_COOKIE = "google_login_oauth_next";
const GOOGLE_CALENDAR_STATE_COOKIE = "google_calendar_oauth_state";
const GOOGLE_LEGACY_STATE_COOKIE = "google_oauth_state";
const GOOGLE_LEGACY_NEXT_COOKIE = "google_oauth_next";

type ParsedGoogleState =
  | { mode: "login"; nonce: string }
  | { mode: "calendar"; accountId: string; nonce: string };

function getRedirectUri() {
  return `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/auth/google/callback`;
}

function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

function clearOAuthCookies(response: NextResponse) {
  for (const cookieName of [
    GOOGLE_LOGIN_STATE_COOKIE,
    GOOGLE_LOGIN_NEXT_COOKIE,
    GOOGLE_CALENDAR_STATE_COOKIE,
    GOOGLE_LEGACY_STATE_COOKIE,
    GOOGLE_LEGACY_NEXT_COOKIE,
  ]) {
    response.cookies.set(cookieName, "", {
      ...COOKIE_OPTIONS,
      maxAge: 0,
    });
  }
}

function getOAuthCookieValue(request: NextRequest, names: string[]) {
  for (const name of names) {
    const value = request.cookies.get(name)?.value?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

function getStateCookieValue(request: NextRequest, mode: ParsedGoogleState["mode"]) {
  if (mode === "login") {
    return getOAuthCookieValue(request, [GOOGLE_LOGIN_STATE_COOKIE, GOOGLE_LEGACY_STATE_COOKIE]);
  }

  return getOAuthCookieValue(request, [GOOGLE_CALENDAR_STATE_COOKIE, GOOGLE_LEGACY_STATE_COOKIE]);
}

function getLoginNextCookieValue(request: NextRequest) {
  return getOAuthCookieValue(request, [GOOGLE_LOGIN_NEXT_COOKIE, GOOGLE_LEGACY_NEXT_COOKIE]);
}

function buildRedirectResponse(request: NextRequest, nextPath: string) {
  const redirectUrl = new URL(nextPath, request.url);
  return NextResponse.redirect(redirectUrl);
}

function buildLoginErrorRedirect(request: NextRequest, reason: string, error = "callback_failed") {
  const errorUrl = new URL("/login", request.url);
  errorUrl.searchParams.set("error", error);
  errorUrl.searchParams.set("reason", reason);
  return errorUrl;
}

function redirectLoginError(request: NextRequest, reason: string, error = "callback_failed") {
  const response = NextResponse.redirect(buildLoginErrorRedirect(request, reason, error));
  clearOAuthCookies(response);
  return response;
}

function parseState(state: string | null): ParsedGoogleState | null {
  if (!state) {
    return null;
  }

  if (state.startsWith("login:")) {
    const nonce = state.slice("login:".length).trim();
    return nonce ? { mode: "login", nonce } : null;
  }

  if (state.startsWith("calendar:")) {
    const remainder = state.slice("calendar:".length);
    const [accountId, nonce] = remainder.split(":");
    if (!accountId || !nonce) {
      return null;
    }
    return { mode: "calendar", accountId, nonce };
  }

  return null;
}

function buildAccessTokenResponse(
  request: NextRequest,
  nextPath: string,
  payload: { userId: string; accountId: string; role: string; email: string },
) {
  const response = buildRedirectResponse(request, nextPath);
  response.cookies.set("access_token", generateAccessToken({
    sub: payload.userId,
    accountId: payload.accountId,
    role: payload.role,
    email: payload.email,
  }), {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24,
  });
  response.cookies.set("refresh_token", generateRefreshToken({
    sub: payload.userId,
    accountId: payload.accountId,
    role: payload.role,
    email: payload.email,
  }), {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 7,
  });
  clearOAuthCookies(response);
  return response;
}

async function resolveGoogleLoginEmail(oauth2Client: InstanceType<typeof google.auth.OAuth2>, code: string) {
  const { tokens } = await oauth2Client.getToken(code);

  if (tokens.id_token) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error("Missing GOOGLE_CLIENT_ID");
    }

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

  if (tokens.access_token) {
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (userInfoResponse.ok) {
      const userInfo = (await userInfoResponse.json()) as { email?: string; verified_email?: boolean };
      const email = userInfo.email?.trim().toLowerCase() ?? null;
      if (email && userInfo.verified_email !== false) {
        return { email };
      }
    }
  }

  throw new Error("Google account did not return an email");
}

function getCallbackErrorMessage(error: string | null, description: string | null) {
  if (!error) {
    return null;
  }

  const mappedError = error === "access_denied" ? "oauth_denied" : "oauth_error";
  return {
    error: mappedError,
    reason: description ?? undefined,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams;
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");
  const providerErrorDescription = searchParams.get("error_description");
  const state = parseState(searchParams.get("state"));
  const oauth2Client = createOAuthClient();

  if (!oauth2Client) {
    return NextResponse.redirect(
      buildLoginErrorRedirect(
        request,
        "Google OAuth chua duoc cau hinh. Kiem tra GOOGLE_CLIENT_ID va GOOGLE_CLIENT_SECRET.",
      ),
    );
  }

  if (providerError) {
    if (state?.mode === "login") {
      const mapped = getCallbackErrorMessage(providerError, providerErrorDescription);
      return redirectLoginError(
        request,
        mapped?.reason ?? "Google OAuth dang bi tu choi.",
        mapped?.error ?? "oauth_error",
      );
    }

    return NextResponse.json({ error: `Google Auth Error: ${providerError}` }, { status: 400 });
  }

  if (!code || !state) {
    if (state?.mode === "login" || getLoginNextCookieValue(request)) {
      return redirectLoginError(
        request,
        "Missing code or state from Google OAuth.",
      );
    }

    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const expectedCookieNonce = state ? getStateCookieValue(request, state.mode) : null;
  if (!expectedCookieNonce || expectedCookieNonce !== state.nonce) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[Google OAuth Callback] State mismatch bypassed in development. Expected: ${expectedCookieNonce}, Got: ${state?.nonce}`);
    } else {
      if (state?.mode === "login") {
        return redirectLoginError(
          request,
          "State mismatch. Dang xac minh Google login that bai.",
        );
      }

      return NextResponse.json(
        { error: "State mismatch. Possible CSRF attack or invalid session." },
        { status: 403 },
      );
    }
  }

  try {
    if (state.mode === "login") {
      const nextPath = resolveInternalRedirectPath(
        getLoginNextCookieValue(request),
        null,
      );
      const { email } = await resolveGoogleLoginEmail(oauth2Client, code);
      const user = await authRepository.findUserByEmail(email);

      if (!user) {
        return redirectLoginError(
          request,
          "Tai khoan Google nay chua duoc cap quyen truy cap admin.",
        );
      }

      return buildAccessTokenResponse(request, nextPath, {
        userId: user.id,
        accountId: user.accountId,
        role: user.role,
        email: user.email,
      });
    }

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
      await supabase
        .from("integrations")
        .insert({
          account_id: sessionAccountId,
          provider: "google",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
        });
    }

    const uiUrl = new URL("/calendar", request.url);
    uiUrl.searchParams.set("gcal_connected", "true");

    const response = NextResponse.redirect(uiUrl);
    clearOAuthCookies(response);
    return response;
  } catch (error: unknown) {
    console.error("Google Callback Error:", error);

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
