import { NextResponse, type NextRequest } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import { withAccount } from "@/lib/api/with-account";

export const GET = withAccount(async (request: NextRequest, { accountId: sessionAccountId }) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateAccountId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.json({ error: `Google Auth Error: ${error}` }, { status: 400 });
  }

  if (!code || !stateAccountId) {
    return NextResponse.json({ error: "Missing code or state(account_id)" }, { status: 400 });
  }

  // SECURITY CHECK: Ensure the state returned aligns with the logged in user's account_id!
  if (stateAccountId !== sessionAccountId) {
     return NextResponse.json({ error: "State mismatch. Possible CSRF attack or invalid session." }, { status: 403 });
  }

  const accountId = sessionAccountId; // securely verified

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    // Check if integration already exists
    const { data: existing } = await supabase
      .from("integrations")
      .select("id")
      .eq("account_id", accountId)
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
          refresh_token: tokens.refresh_token || undefined, // don't wipe out refresh token if not provided
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("integrations")
        .insert({
          account_id: accountId,
          provider: "google",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
        });
    }

    // Redirect to calendar page with success
    const uiUrl = new URL("/calendar", request.url);
    uiUrl.searchParams.set("gcal_connected", "true");
    
    return NextResponse.redirect(uiUrl);
  } catch (error: unknown) {
    console.error("Google Callback Error:", error);
    return NextResponse.json({ error: "Failed to exchange token", details: (error as Error).message }, { status: 500 });
  }
});
