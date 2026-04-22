import { deleteCache, getCache, setCache } from "../redis/client";
import type { ZaloMode, ZaloModeStore } from "./types";

const MODE_TTL_SECONDS = 60 * 60 * 24 * 30;
const KEY_PREFIX = "zalo:mode";

interface ModeRecord {
  mode: ZaloMode;
  updatedAt: string;
  updatedBy: string;
}

function modeKey(accountId: string, chatId: string): string {
  return `${KEY_PREFIX}:${accountId || "unset"}:${chatId}`;
}

export async function getZaloMode(accountId: string, chatId: string): Promise<ZaloMode> {
  const record = await getCache<ModeRecord>(modeKey(accountId, chatId));
  if (record?.mode === "human-handoff" || record?.mode === "sales-ai") {
    return record.mode;
  }
  return "sales-ai";
}

export async function setZaloMode(accountId: string, chatId: string, mode: ZaloMode, updatedBy = "system"): Promise<void> {
  const record: ModeRecord = {
    mode,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  await setCache(modeKey(accountId, chatId), record, MODE_TTL_SECONDS);
}

export async function clearZaloMode(accountId: string, chatId: string): Promise<void> {
  await deleteCache(modeKey(accountId, chatId));
}

export const zaloModeStore: ZaloModeStore = {
  getMode: getZaloMode,
  setMode: setZaloMode,
  clearMode: clearZaloMode,
};
