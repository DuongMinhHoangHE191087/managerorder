import { deleteCache, getCache, setCache } from "../redis/client";
import type { ZaloOrderWizardState, ZaloOrderWizardStore } from "./types";

const SESSION_TTL_SECONDS = 60 * 60 * 12;
const KEY_PREFIX = "zalo:order";

interface OrderWizardRecord {
  state: ZaloOrderWizardState;
  updatedAt: string;
}

function sessionKey(accountId: string, chatId: string): string {
  return `${KEY_PREFIX}:${accountId || "unset"}:${chatId}`;
}

export async function getZaloOrderWizardSession(accountId: string, chatId: string): Promise<ZaloOrderWizardState | null> {
  const record = await getCache<OrderWizardRecord>(sessionKey(accountId, chatId));
  if (!record?.state?.step || !Array.isArray(record.state.items)) {
    return null;
  }
  return record.state;
}

export async function setZaloOrderWizardSession(
  accountId: string,
  chatId: string,
  state: ZaloOrderWizardState,
): Promise<void> {
  const record: OrderWizardRecord = {
    state,
    updatedAt: new Date().toISOString(),
  };
  await setCache(sessionKey(accountId, chatId), record, SESSION_TTL_SECONDS);
}

export async function clearZaloOrderWizardSession(accountId: string, chatId: string): Promise<void> {
  await deleteCache(sessionKey(accountId, chatId));
}

export const zaloOrderWizardStore: ZaloOrderWizardStore = {
  getSession: getZaloOrderWizardSession,
  setSession: setZaloOrderWizardSession,
  clearSession: clearZaloOrderWizardSession,
};
