import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const accountId = req.headers.get("x-account-id");
  if (!accountId) {
    return NextResponse.json({ error: "Missing x-account-id" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("calendar_notes")
    .select("content")
    .eq("account_id", accountId)
    .single();

  if (error && error.code !== "PGRST116") { // Ignore 'no rows'
    throw error;
  }

  return NextResponse.json({ data: data?.content || "" });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const accountId = req.headers.get("x-account-id");
  if (!accountId) {
    return NextResponse.json({ error: "Missing x-account-id" }, { status: 401 });
  }

  const { content } = await req.json();

  const { error } = await supabaseAdmin
    .from("calendar_notes")
    .upsert({
      account_id: accountId,
      content: content,
      updated_at: new Date().toISOString()
    }, { onConflict: "account_id" });

  if (error) throw error;
  return NextResponse.json({ success: true });
});
