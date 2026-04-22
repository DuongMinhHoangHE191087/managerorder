/**
 * Auth Setup — Playwright Global Setup
 *
 * Logs in via Supabase email/password and saves session cookies
 * to storageState for all test projects to share.
 *
 * Requires env vars:
 *   SUPABASE_TEST_EMAIL
 *   SUPABASE_TEST_PASSWORD
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const AUTH_FILE = "e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const email = process.env.SUPABASE_TEST_EMAIL!;
  const password = process.env.SUPABASE_TEST_PASSWORD!;

  if (!email || !password) {
    console.warn(
      "⚠️  SUPABASE_TEST_EMAIL / SUPABASE_TEST_PASSWORD not set — skipping auth setup"
    );
    // Save empty state so tests still run (unauthenticated)
    await page.context().storageState({ path: AUTH_FILE });
    return;
  }

  // Sign in via Supabase SDK
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Auth setup failed: ${error.message}`);
  }

  expect(data.session).toBeTruthy();

  const { access_token, refresh_token } = data.session!;

  // Navigate to app and inject Supabase auth cookies
  await page.goto("/");

  // Set Supabase auth cookies matching @supabase/ssr cookie format
  const cookieBase = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;

  await page.context().addCookies([
    {
      name: cookieBase,
      value: JSON.stringify({
        access_token,
        refresh_token,
        expires_at: data.session!.expires_at,
        token_type: "bearer",
        user: data.user,
      }),
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  // Reload to pick up the session
  await page.goto("/");

  // Verify we are authenticated (should not redirect to login)
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 10_000,
  });

  // Save authenticated state
  await page.context().storageState({ path: AUTH_FILE });
});
