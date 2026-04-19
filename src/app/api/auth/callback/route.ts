import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase Auth callback handler.
 * Exchanges the auth code for a session and redirects to the requested path.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");
  const providerErrorDescription = searchParams.get("error_description");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (providerError) {
    const errorUrl = request.nextUrl.clone();
    errorUrl.pathname = "/login";
    errorUrl.search = "";
    errorUrl.searchParams.set(
      "error",
      providerError === "access_denied" ? "oauth_denied" : "oauth_error"
    );
    if (providerErrorDescription) {
      errorUrl.searchParams.set("reason", providerErrorDescription);
    }
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

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return response;
    }

    console.error("[Auth Callback] exchangeCodeForSession failed:", error.message, "| code length:", code.length);
  } else {
    console.warn("[Auth Callback] No code provided in URL search params.");
  }

  const errorUrl = request.nextUrl.clone();
  errorUrl.pathname = "/login";
  errorUrl.search = "";
  errorUrl.searchParams.set("error", "auth_failed");

  return NextResponse.redirect(errorUrl);
}
