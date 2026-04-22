import { NextResponse, type NextRequest } from "next/server";
import { google } from "googleapis";
import { withAccount } from "@/lib/api/with-account";

export const GET = withAccount(async (request: NextRequest, { accountId }) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Thieu thong tin GOOGLE_CLIENT_ID hoac GOOGLE_CLIENT_SECRET trong file mau" }, { status: 500 });
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const scopes = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly"
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent", // Force to get refresh_token
    state: accountId, // Securely pass verified account_id to callback
  });

  return NextResponse.redirect(authUrl);
});
