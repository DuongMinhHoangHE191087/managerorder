import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AuthRepository } from "@/lib/services/auth";
import { resolveInternalRedirectPath } from "@/widgets/pages/login/login-routing";

const authRepository = new AuthRepository();

function buildLoginErrorUrl(request: NextRequest, error: string, reason?: string) {
  const errorUrl = request.nextUrl.clone();
  errorUrl.pathname = "/login";
  errorUrl.search = "";
  errorUrl.searchParams.set("error", error);
  if (reason) {
    errorUrl.searchParams.set("reason", reason);
  }
  return errorUrl;
}

function clearSupabaseAuthCookies(response: NextResponse, request: NextRequest) {
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.startsWith("sb-")) {
      continue;
    }

    response.cookies.set({
      name: cookie.name,
      value: "",
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
  }
}

/**
 * Supabase Auth callback handler.
 * Exchanges the auth code for a session and redirects to the requested path.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");
  const providerErrorDescription = searchParams.get("error_description");
  const next = resolveInternalRedirectPath(searchParams.get("next"), searchParams.get("redirect"));

  if (providerError) {
    const errorUrl = buildLoginErrorUrl(
      request,
      providerError === "access_denied" ? "oauth_denied" : "oauth_error",
      providerErrorDescription ?? undefined,
    );
    return NextResponse.redirect(errorUrl);
  }

  if (code) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = next;
    redirectUrl.search = "";

    const response = NextResponse.redirect(redirectUrl);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      const { data, error: userError } = await supabase.auth.getUser();
      const email = data.user?.email?.trim().toLowerCase();

      if (userError || !email) {
        const errorResponse = NextResponse.redirect(
          buildLoginErrorUrl(
            request,
            "callback_failed",
            "Tai khoan Google khong tra ve email hop le.",
          ),
        );
        clearSupabaseAuthCookies(errorResponse, request);
        return errorResponse;
      }

      const adminUser = await authRepository.findUserByEmail(email);
      if (!adminUser) {
        const errorResponse = NextResponse.redirect(
          buildLoginErrorUrl(
            request,
            "callback_failed",
            "Tai khoan Google nay chua duoc cap quyen truy cap admin.",
          ),
        );
        clearSupabaseAuthCookies(errorResponse, request);
        return errorResponse;
      }

      return response;
    }

    console.error("[Auth Callback] exchangeCodeForSession failed:", exchangeError.message, "| code length:", code.length);
  } else {
    console.warn("[Auth Callback] No code provided in URL search params.");
  }

  const errorUrl = buildLoginErrorUrl(request, "auth_failed");
  return NextResponse.redirect(errorUrl);
}
