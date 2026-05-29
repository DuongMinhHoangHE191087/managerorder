import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { resolveAccountId } from "@/lib/api/with-account";
import { checkAuthRateLimit, getClientIp } from "@/lib/api/rate-limiter";
import { resolveInternalRedirectPath } from "@/widgets/pages/login/login-routing";
import {
  COOKIE_OPTIONS,
  GOOGLE_COOKIE_NAMES,
  GOOGLE_CALENDAR_SCOPES,
  GOOGLE_LOGIN_SCOPES,
  clearOAuthCookies,
  createOAuthClient,
} from "@/lib/utils/google-oauth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildLoginErrorRedirect(request: NextRequest, reason: string) {
  const errorUrl = new URL("/login", request.url);
  errorUrl.searchParams.set("error", "callback_failed");
  errorUrl.searchParams.set("reason", reason);
  return errorUrl;
}

function setLoginOAuthCookies(
  response: NextResponse,
  nonce: string,
  nextPath?: string,
) {
  // Clear legacy cookies before setting new ones
  clearOAuthCookies(response);

  response.cookies.set(GOOGLE_COOKIE_NAMES.LOGIN_STATE, nonce, {
    ...COOKIE_OPTIONS,
    maxAge: 10 * 60,
  });

  if (nextPath) {
    response.cookies.set(GOOGLE_COOKIE_NAMES.LOGIN_NEXT, nextPath, {
      ...COOKIE_OPTIONS,
      maxAge: 10 * 60,
    });
  } else {
    response.cookies.set(GOOGLE_COOKIE_NAMES.LOGIN_NEXT, "", {
      ...COOKIE_OPTIONS,
      maxAge: 0,
    });
  }
}

function setCalendarOAuthCookies(response: NextResponse, nonce: string) {
  clearOAuthCookies(response);
  response.cookies.set(GOOGLE_COOKIE_NAMES.CALENDAR_STATE, nonce, {
    ...COOKIE_OPTIONS,
    maxAge: 10 * 60,
  });
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Rate limiting — 5 requests / minute per IP (shared with auth bucket)
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

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const oauth2Client = createOAuthClient(request);

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
      { error: "Thieu thong tin GOOGLE_CLIENT_ID hoac GOOGLE_CLIENT_SECRET trong file mau" },
      { status: 500 },
    );
  }

  // ── Login Mode ──────────────────────────────────────────────────────────────
  if (mode === "login") {
    const nextPath = resolveInternalRedirectPath(
      url.searchParams.get("next"),
      url.searchParams.get("redirect"),
    );
    const nonce = randomUUID();

    const authUrl = oauth2Client.generateAuthUrl({
      scope: GOOGLE_LOGIN_SCOPES,
      prompt: "select_account",
      state: `login:${nonce}`,
    });

    console.info(`[GoogleAuth:login] Initiating OAuth flow — ip=${ip}`);

    const response = NextResponse.redirect(authUrl);
    setLoginOAuthCookies(response, nonce, nextPath);
    return response;
  }

  // ── Calendar Mode (requires authenticated session) ──────────────────────────
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

  console.info(`[GoogleAuth:calendar] Initiating OAuth flow — accountId=${accountId} ip=${ip}`);

  const response = NextResponse.redirect(authUrl);
  setCalendarOAuthCookies(response, nonce);
  return response;
}
