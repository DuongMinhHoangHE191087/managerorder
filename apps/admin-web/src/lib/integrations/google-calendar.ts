import { google, calendar_v3 } from "googleapis";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";

// Structured result from GCal sync operations
export type GCalSyncResult = {
  gcalEventId?: string;
  error?: string;
  errorCode?: number;
  status: "synced" | "failed" | "not_connected";
};

export async function getGoogleCalendarClient(accountId: string) {
  if (process.env.CODEX_USE_LOCAL_FALLBACK === "1") {
    return null;
  }

  const { data: integration } = await supabase
    .from("integrations")
    .select("*")
    .eq("account_id", accountId)
    .eq("provider", "google")
    .single();

  if (!integration || (!integration.access_token && !integration.refresh_token)) {
    return null;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) return null;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
    expiry_date: integration.expires_at ? new Date(integration.expires_at).getTime() : null,
  });
  
  // Listen to token refresh and save to db 
  oauth2Client.on('tokens', async (tokens) => {
    const updatePayload: Record<string, unknown> = {
      access_token: tokens.access_token,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    };
    if (tokens.refresh_token) {
      updatePayload.refresh_token = tokens.refresh_token;
    }
    await supabase
      .from("integrations")
      .update(updatePayload)
      .eq("id", integration.id);
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

/**
 * Parse GCal API error into user-friendly message
 */
function parseGCalError(error: unknown): { message: string; code: number } {
  const err = error as { code?: number; status?: number; message?: string; errors?: { message: string }[] };
  const code = err.code ?? err.status ?? 500;

  if (code === 403) {
    const msg = err.message ?? "";
    if (msg.includes("has not been used") || msg.includes("is disabled")) {
      return {
        code: 403,
        message: "Google Calendar API chưa được kích hoạt trong dự án Google Cloud. Vui lòng bật API và thử lại.",
      };
    }
    return { code: 403, message: "Không có quyền truy cập Google Calendar. Vui lòng kết nối lại." };
  }

  if (code === 401) {
    return { code: 401, message: "Phiên Google Calendar đã hết hạn. Vui lòng kết nối lại." };
  }

  if (code === 404) {
    return { code: 404, message: "Sự kiện không tìm thấy trên Google Calendar." };
  }

  return { code, message: `Lỗi đồng bộ Google Calendar (${code})` };
}

export async function syncEventToGCal(
  accountId: string,
  event: {
    id: string;
    title: string;
    due_at: string;
    notes?: string;
    is_done?: boolean;
    gcal_event_id?: string | null;
  },
  action: "create" | "update" | "delete"
): Promise<GCalSyncResult> {
  try {
    const calendar = await getGoogleCalendarClient(accountId);
    if (!calendar) {
      return { status: "not_connected" };
    }

    // Build event body
    const isAllDay = event.due_at.endsWith("00:00:00") || event.due_at.endsWith("00:00:00Z");
    
    const startDate = new Date(event.due_at);
    const endDate = new Date(startDate);
    
    if (isAllDay) {
      endDate.setDate(endDate.getDate() + 1);
    } else {
      endDate.setHours(endDate.getHours() + 1);
    }

    let description = event.notes || "";
    if (event.is_done) {
      description = `✅ [ĐÃ HOÀN THÀNH]\n` + description;
    }

    const requestBody: calendar_v3.Schema$Event = {
      summary: (event.is_done ? "✅ " : "") + event.title,
      description,
      start: isAllDay ? { date: startDate.toISOString().split("T")[0] } : { dateTime: startDate.toISOString() },
      end: isAllDay ? { date: endDate.toISOString().split("T")[0] } : { dateTime: endDate.toISOString() },
    };

    if (action === "create") {
      const res = await calendar.events.insert({
        calendarId: "primary",
        requestBody,
      });
      return { gcalEventId: res.data.id || undefined, status: "synced" };
    } 
    
    if (action === "update" && event.gcal_event_id) {
      await calendar.events.patch({
        calendarId: "primary",
        eventId: event.gcal_event_id,
        requestBody,
      });
      return { gcalEventId: event.gcal_event_id, status: "synced" };
    }
    
    if (action === "delete" && event.gcal_event_id) {
      await calendar.events.delete({
        calendarId: "primary",
        eventId: event.gcal_event_id,
      });
      return { status: "synced" };
    }

    return { status: "not_connected" };
  } catch (error) {
    const parsed = parseGCalError(error);
    console.error("GCal Sync Error:", parsed.message, error);
    return {
      status: "failed",
      error: parsed.message,
      errorCode: parsed.code,
    };
  }
}
