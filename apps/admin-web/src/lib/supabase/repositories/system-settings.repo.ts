import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { DEFAULT_SYSTEM_SETTINGS, normalizeSystemSettings } from "@/lib/settings/system-settings";

type SystemSettingsRow = Database["public"]["Tables"]["system_settings"]["Row"];

export async function getSystemSettings(): Promise<ReturnType<typeof normalizeSystemSettings>> {
  const { data, error } = await supabase.from("system_settings").select("*").limit(1);
  if (error) {
    throw new Error(error.message);
  }

  const firstRow = data?.[0] as SystemSettingsRow | undefined;
  return normalizeSystemSettings(firstRow ?? DEFAULT_SYSTEM_SETTINGS);
}
