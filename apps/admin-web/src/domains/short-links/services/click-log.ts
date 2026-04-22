import { isMissingColumnError } from "@/lib/supabase/schema-errors";

export type ShortLinkClickEventType =
  | "bot_preview"
  | "landing_view"
  | "redirect_click"
  | "blocked";

export interface ShortLinkClickRecord {
  short_link_id: string;
  ip_address: string;
  user_agent: string | null;
  referer: string | null;
  device_type: string;
  is_suspicious: boolean;
  suspicious_reason: string | null;
  country?: string | null;
  city?: string | null;
  country_region?: string | null;
  ip_version?: string | null;
  browser?: string | null;
  event_type: ShortLinkClickEventType;
}

type ShortLinkClickInsertResult = {
  error?: unknown;
};

type ShortLinkClickInsertBuilder = {
  insert(values: Record<string, unknown>): PromiseLike<ShortLinkClickInsertResult>;
};

export type ShortLinkClickInsertClient = {
  from(table: "short_link_clicks"): ShortLinkClickInsertBuilder;
};

function stripEventType(
  record: ShortLinkClickRecord,
): Omit<ShortLinkClickRecord, "event_type"> {
  const { event_type: _eventType, ...rest } = record;
  return rest;
}

async function insertClickRecord(
  db: ShortLinkClickInsertClient,
  record: ShortLinkClickRecord | Omit<ShortLinkClickRecord, "event_type">,
): Promise<unknown | null> {
  const result = await db
    .from("short_link_clicks")
    .insert(record as Record<string, unknown>);
  return result.error ?? null;
}

export async function logShortLinkClick(
  db: ShortLinkClickInsertClient,
  record: ShortLinkClickRecord,
  logPrefix = "[ShortLink]",
): Promise<void> {
  try {
    const error = await insertClickRecord(db, record);
    if (!error) {
      return;
    }

    if (!isMissingColumnError(error, "event_type", "short_link_clicks")) {
      console.error(`${logPrefix} Click log error:`, error);
      return;
    }
  } catch (error) {
    if (!isMissingColumnError(error, "event_type", "short_link_clicks")) {
      console.error(`${logPrefix} Click log exception:`, error);
      return;
    }
  }

  try {
    const fallbackError = await insertClickRecord(db, stripEventType(record));
    if (fallbackError) {
      console.error(`${logPrefix} Click log error:`, fallbackError);
    }
  } catch (error) {
    console.error(`${logPrefix} Click log exception:`, error);
  }
}
