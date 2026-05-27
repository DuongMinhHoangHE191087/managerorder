import { randomUUID } from "crypto";
import { google } from "googleapis";
import { NextResponse, type NextRequest } from "next/server";
import { resolveAccountId } from "@/lib/api/with-account";
import { resolveInternalRedirectPath } from "@/widgets/pages/login/login-routing";

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
const GOOGLE_LOGIN_SCOPES = ["openid", "email", "profile"];
const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

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

function buildLoginErrorRedirect(request: NextRequest, reason: string) {
  const errorUrl = new URL("/login", request.url);
  errorUrl.searchParams.set("error", "callback_failed");
  errorUrl.searchParams.set("reason", reason);
  return errorUrl;
}

function clearLegacyOAuthCookies(response: NextResponse) {
  response.cookies.set(GOOGLE_LEGACY_STATE_COOKIE, "", {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
  response.cookies.set(GOOGLE_LEGACY_NEXT_COOKIE, "", {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
}

function setLoginOAuthCookies(response: NextResponse, nonce: string, nextPath?: string) {
  response.cookies.set(GOOGLE_LOGIN_STATE_COOKIE, nonce, {
    ...COOKIE_OPTIONS,
    maxAge: 10 * 60,
  });

  if (nextPath) {
    response.cookies.set(GOOGLE_LOGIN_NEXT_COOKIE, nextPath, {
      ...COOKIE_OPTIONS,
      maxAge: 10 * 60,
    });
  } else {
    response.cookies.set(GOOGLE_LOGIN_NEXT_COOKIE, "", {
      ...COOKIE_OPTIONS,
      maxAge: 0,
    });
  }

  clearLegacyOAuthCookies(response);
}

function setCalendarOAuthCookies(response: NextResponse, nonce: string) {
  response.cookies.set(GOOGLE_CALENDAR_STATE_COOKIE, nonce, {
    ...COOKIE_OPTIONS,
    maxAge: 10 * 60,
  });

  clearLegacyOAuthCookies(response);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const oauth2Client = createOAuthClient();

  if (!oauth2Client) {
    if (mode === "login") {
      return NextResponse.redirect(
        buildLoginErrorRedirect(
          request,
          "Google OAuth chua duoc cau hinh. Kiem tra GOOGLE_CLIENT_ID va GOOGLE_CLIENT_SECRET.",
        ),
      );
    }

    return NextResponse.json(
      {
        error:
          "Thieu thong tin GOOGLE_CLIENT_ID hoac GOOGLE_CLIENT_SECRET trong file mau",
      },
      { status: 500 },
    );
  }

  if (mode === "login") {
    const nextPath = resolveInternalRedirectPath(url.searchParams.get("next"), url.searchParams.get("redirect"));
    const nonce = randomUUID();

    const authUrl = oauth2Client.generateAuthUrl({
      scope: GOOGLE_LOGIN_SCOPES,
      prompt: "select_account",
      state: `login:${nonce}`,
    });

    const response = NextResponse.redirect(authUrl);
    setLoginOAuthCookies(response, nonce, nextPath);
    return response;
  }

  const accountId = await resolveAccountId(request);
  if (!accountId) {
    return NextResponse.json(
      { error: "Unauthorized - phien dang nhap khong hop le" },
      { status: 401 },
    );
  }

  const nonce = randomUUID();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: GOOGLE_CALENDAR_SCOPES,
    prompt: "consent",
    state: `calendar:${accountId}:${nonce}`,
  });

  const response = NextResponse.redirect(authUrl);
  setCalendarOAuthCookies(response, nonce);
  return response;
}
