import type { SourceAccount } from "@/lib/domain/types";
import { mapRowToSourceAccount } from "@/lib/mappers/source-account.mapper";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import {
  addReservedNick as addReservedNickRepo,
  createSourceAccount as createSourceAccountRepo,
  deleteSourceAccount as deleteSourceAccountRepo,
  disconnectSourceAccount as disconnectSourceAccountRepo,
  getConnectionsEnriched as getConnectionsEnrichedRepo,
  getSlotBreakdown as getSlotBreakdownRepo,
  getSourceAccountById as getSourceAccountByIdRepo,
  getSourceAccountConnections as getSourceAccountConnectionsRepo,
  listSourceAccounts as listSourceAccountsRepo,
  recalculateAllSlots as recalculateAllSlotsRepo,
  recalculateUsedSlots as recalculateUsedSlotsRepo,
  reconnectSourceAccount as reconnectSourceAccountRepo,
  removeReservedNick as removeReservedNickRepo,
  updateSourceAccount as updateSourceAccountRepo,
  type SourceAccountRow,
} from "@/lib/supabase/repositories/source-accounts.repo";
import { decryptNotes, encryptNotes } from "@/lib/utils/credential-crypto";
import {
  scanSmartMatches,
  searchUnconnectedByNickOrNote,
  type SmartMatchSuggestion,
  type UnconnectedSearchResult,
} from "@/lib/services/smart-matching.service";
import { formatMoney } from "@/lib/utils";

type SourceAccountCredentialInput = {
  type: string;
  value: string;
  label?: string;
};

export interface DecryptedSourceAccountCredential {
  id: string;
  type: string;
  value: string;
  label?: string;
}

export interface DecryptedSourceAccountSecrets {
  id: string;
  email: string;
  password: string | null;
  credentials: DecryptedSourceAccountCredential[];
}

export interface SourceAccountCreateInput {
  email: string;
  password?: string;
  provider: string;
  productIds?: string[];
  maxSlots?: number;
  expiresAt: string;
  credentials?: SourceAccountCredentialInput[];
  purchaseCostVnd?: number;
  purchaseDate?: string;
  purchaseSource?: string;
}

export interface SourceAccountUpdateInput {
  email?: string;
  password?: string;
  provider?: string;
  productIds?: string[];
  maxSlots?: number;
  usedSlots?: number;
  notes?: Record<string, string>;
  expiresAt?: string;
  credentials?: SourceAccountCredentialInput[];
  purchaseCostVnd?: number;
  purchaseDate?: string;
  purchaseSource?: string;
}

function toDomainSourceAccount(row: SourceAccountRow | null): SourceAccount | null {
  return row ? mapRowToSourceAccount(row) : null;
}

function normalizeDecryptedCredentials(
  credentials: unknown,
  sourceAccountId: string,
): DecryptedSourceAccountCredential[] {
  if (!Array.isArray(credentials)) {
    return [];
  }

  return credentials.map((credential, index) => {
    if (credential && typeof credential === "object") {
      const raw = credential as Record<string, unknown>;
      const id =
        typeof raw.id === "string" && raw.id.trim()
          ? raw.id
          : `${sourceAccountId}-cred-${index + 1}`;
      const normalized: DecryptedSourceAccountCredential = {
        id,
        type: typeof raw.type === "string" ? raw.type : "unknown",
        value: typeof raw.value === "string" ? raw.value : "",
      };

      if (typeof raw.label === "string" && raw.label.trim()) {
        normalized.label = raw.label;
      }

      return normalized;
    }

    return {
      id: `${sourceAccountId}-cred-${index + 1}`,
      type: "unknown",
      value: "",
    };
  });
}

function buildPersistedNotes(
  input: Pick<SourceAccountCreateInput, "credentials" | "password"> | Pick<SourceAccountUpdateInput, "credentials" | "password" | "notes">,
  existingNotes?: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
  const hasCredentials = Array.isArray(input.credentials) && input.credentials.length > 0;
  const hasPassword = Boolean(input.password);

  if ("notes" in input && input.notes !== undefined && !hasCredentials && !hasPassword) {
    return input.notes;
  }

  if (!hasCredentials && !hasPassword) {
    return undefined;
  }

  const notes: Record<string, unknown> = { ...(existingNotes ?? {}) };
  if (hasCredentials) {
    notes.credentials = input.credentials;
  }
  if (hasPassword) {
    notes.password = input.password;
  }

  try {
    return encryptNotes(notes);
  } catch (error) {
    console.warn("[Source Accounts] Encryption skipped:", (error as Error).message);
    return notes;
  }
}

async function logSourceAccountActivity(
  accountId: string,
  action_type: string,
  details: Record<string, string | number | boolean | object | null>,
  actorEmail?: string | null,
  sourceAccountId?: string,
) {
  await createActivityLog({
    account_id: accountId,
    action_type,
    created_by: actorEmail ?? undefined,
    ...(sourceAccountId ? { source_account_id: sourceAccountId } : {}),
    details,
  }).catch(() => {});
}

export async function listSourceAccountsForAccount(accountId: string): Promise<SourceAccount[]> {
  const rows = await listSourceAccountsRepo(accountId);
  return rows.map((row) => mapRowToSourceAccount(row));
}

export async function getSourceAccountForAccount(
  id: string,
  accountId: string,
): Promise<SourceAccount | null> {
  const row = await getSourceAccountByIdRepo(id, accountId);
  return toDomainSourceAccount(row);
}

export async function createSourceAccountForAccount(
  accountId: string,
  input: SourceAccountCreateInput,
  actorEmail?: string | null,
): Promise<SourceAccount> {
  const notes = buildPersistedNotes(
    {
      credentials: input.credentials,
      password: input.password,
    },
  );

  const row = await createSourceAccountRepo(accountId, {
    account_id: accountId,
    email: input.email,
    provider: input.provider,
    max_slots: input.maxSlots ?? 1,
    used_slots: 0,
    product_ids: input.productIds ?? [],
    expires_at: input.expiresAt,
    ...(notes !== undefined ? { notes } : {}),
    ...(input.purchaseCostVnd !== undefined ? { purchase_cost_vnd: input.purchaseCostVnd } : {}),
    ...(input.purchaseDate !== undefined ? { purchase_date: input.purchaseDate } : {}),
    ...(input.purchaseSource !== undefined ? { purchase_source: input.purchaseSource } : {}),
  });

  await logSourceAccountActivity(
    accountId,
    "INVENTORY_STATUS_CHANGED",
    {
      action: "Created new source account",
      email: row.email,
      provider: row.provider,
    },
    actorEmail,
    row.id,
  );

  return mapRowToSourceAccount(row);
}

export async function updateSourceAccountForAccount(
  id: string,
  accountId: string,
  input: SourceAccountUpdateInput,
  actorEmail?: string | null,
): Promise<SourceAccount> {
  const existing = await getSourceAccountByIdRepo(id, accountId);
  if (!existing) {
    throw new Error("Source account not found");
  }

  const notes = buildPersistedNotes(
    {
      notes: input.notes,
      credentials: input.credentials,
      password: input.password,
    },
    (existing.notes ?? {}) as Record<string, unknown>,
  );

  const updated = await updateSourceAccountRepo(id, accountId, {
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.provider !== undefined ? { provider: input.provider } : {}),
    ...(input.productIds !== undefined ? { product_ids: input.productIds } : {}),
    ...(input.maxSlots !== undefined ? { max_slots: input.maxSlots } : {}),
    ...(input.usedSlots !== undefined ? { used_slots: input.usedSlots } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(input.expiresAt !== undefined ? { expires_at: input.expiresAt } : {}),
    ...(input.purchaseCostVnd !== undefined ? { purchase_cost_vnd: input.purchaseCostVnd } : {}),
    ...(input.purchaseDate !== undefined ? { purchase_date: input.purchaseDate } : {}),
    ...(input.purchaseSource !== undefined ? { purchase_source: input.purchaseSource } : {}),
  });

  const changesSummary: Record<string, string> = {};
  if (input.email !== undefined) changesSummary.email = input.email;
  if (input.provider !== undefined) changesSummary.provider = input.provider;
  if (input.maxSlots !== undefined) changesSummary.max_slots = String(input.maxSlots);
  if (input.usedSlots !== undefined) changesSummary.used_slots = String(input.usedSlots);
  if (input.expiresAt !== undefined) changesSummary.expires_at = input.expiresAt;
  if (input.purchaseCostVnd !== undefined) changesSummary.purchase_cost_vnd = formatMoney(Number(input.purchaseCostVnd));
  if (input.purchaseDate !== undefined) changesSummary.purchase_date = input.purchaseDate;
  if (input.purchaseSource !== undefined) changesSummary.purchase_source = input.purchaseSource;
  if (input.productIds !== undefined) {
    changesSummary.products = Array.isArray(input.productIds)
      ? `${input.productIds.length} sản phẩm`
      : String(input.productIds);
  }
  if (input.credentials !== undefined) changesSummary.credentials = "Đã cập nhật";
  if (input.password !== undefined) changesSummary.password = "Đã cập nhật";
  if (input.notes !== undefined && input.credentials === undefined && input.password === undefined) {
    changesSummary.notes = "Đã cập nhật";
  }

  await logSourceAccountActivity(
    accountId,
    "INVENTORY_STATUS_CHANGED",
    {
      action: "Updated source account",
      ...changesSummary,
    },
    actorEmail,
    id,
  );

  return mapRowToSourceAccount(updated);
}

export async function deleteSourceAccountForAccount(
  id: string,
  accountId: string,
  actorEmail?: string | null,
): Promise<void> {
  const existing = await getSourceAccountByIdRepo(id, accountId);
  await deleteSourceAccountRepo(id, accountId);

  await logSourceAccountActivity(
    accountId,
    "INVENTORY_STATUS_CHANGED",
    {
      action: "Deleted source account",
      email: existing?.email ?? "unknown",
      provider: existing?.provider ?? "unknown",
    },
    actorEmail,
    id,
  );
}

export async function connectSourceAccountToOrderItemForAccount(
  sourceAccountId: string,
  orderItemId: string,
  accountId: string,
  actorEmail?: string | null,
): Promise<void> {
  await reconnectSourceAccountRepo(sourceAccountId, orderItemId, accountId);

  await logSourceAccountActivity(
    accountId,
    "INVENTORY_ASSIGNED",
    {
      action: "Connected source account",
      order_item_id: orderItemId,
      method: "manual",
    },
    actorEmail,
    sourceAccountId,
  );
}

export async function disconnectSourceAccountFromOrderItemForAccount(
  sourceAccountId: string,
  orderItemId: string,
  accountId: string,
  actorEmail?: string | null,
): Promise<void> {
  await disconnectSourceAccountRepo(sourceAccountId, orderItemId, accountId);

  await logSourceAccountActivity(
    accountId,
    "INVENTORY_STATUS_CHANGED",
    {
      action: "Disconnected source account",
      order_item_id: orderItemId,
    },
    actorEmail,
    sourceAccountId,
  );
}

export async function addReservedNickForSourceAccount(
  id: string,
  accountId: string,
  nick: string,
  actorEmail?: string | null,
): Promise<SourceAccount> {
  const row = await addReservedNickRepo(id, accountId, nick);

  await logSourceAccountActivity(
    accountId,
    "RESERVED_NICK_ADDED",
    {
      nick,
      used_slots: row.used_slots,
      max_slots: row.max_slots,
    },
    actorEmail,
    id,
  );

  return mapRowToSourceAccount(row);
}

export async function removeReservedNickForSourceAccount(
  id: string,
  accountId: string,
  nick: string,
  actorEmail?: string | null,
): Promise<SourceAccount> {
  const row = await removeReservedNickRepo(id, accountId, nick);

  await logSourceAccountActivity(
    accountId,
    "RESERVED_NICK_REMOVED",
    {
      nick,
      used_slots: row.used_slots,
      max_slots: row.max_slots,
    },
    actorEmail,
    id,
  );

  return mapRowToSourceAccount(row);
}

export async function recalculateSourceAccountSlotsForAccount(
  id: string,
  accountId: string,
  actorEmail?: string | null,
): Promise<{ previous: number; recalculated: number; changed: boolean }> {
  const result = await recalculateUsedSlotsRepo(id, accountId);

  if (result.changed) {
    await logSourceAccountActivity(
      accountId,
      "SLOTS_RECALCULATED",
      {
        previous_slots: result.previous,
        recalculated_slots: result.recalculated,
        action: "Auto-synced used_slots from actual connections + reserved nicks",
      },
      actorEmail,
      id,
    );
  }

  return result;
}

export async function recalculateAllSourceAccountsForAccount(
  accountId: string,
  actorEmail?: string | null,
): Promise<{ total: number; changed: number; results: Array<{ id: string; email: string; previous: number; recalculated: number }> }> {
  const result = await recalculateAllSlotsRepo(accountId);

  if (result.changed > 0) {
    await logSourceAccountActivity(
      accountId,
      "SLOTS_RECALCULATED",
      {
        action: "Batch recalculate all source accounts",
        total: result.total,
        changed: result.changed,
        results: result.results,
      },
      actorEmail,
    );
  }

  return result;
}

export async function getSourceAccountConnectionsForAccount(id: string, accountId: string) {
  return getSourceAccountConnectionsRepo(id, accountId);
}

export async function getSourceAccountConnectionsEnrichedForAccount(id: string, accountId: string) {
  return getConnectionsEnrichedRepo(id, accountId);
}

export async function getSourceAccountSlotBreakdownForAccount(id: string, accountId: string) {
  return getSlotBreakdownRepo(id, accountId);
}

export async function getDecryptedSourceAccountSecretsForAccount(
  id: string,
  accountId: string,
): Promise<DecryptedSourceAccountSecrets | null> {
  const row = await getSourceAccountByIdRepo(id, accountId);
  if (!row) {
    return null;
  }

  const notes = (row.notes ?? {}) as Record<string, unknown>;
  let decryptedNotes: Record<string, unknown> = notes;
  try {
    decryptedNotes = decryptNotes(notes);
  } catch {
    // Backward compatible: return raw notes when decryption is not available.
  }

  return {
    id: row.id,
    email: row.email,
    password: typeof decryptedNotes.password === "string" ? decryptedNotes.password : null,
    credentials: normalizeDecryptedCredentials(decryptedNotes.credentials, row.id),
  };
}

export async function scanSmartMatchesForAccount(
  accountId: string,
): Promise<SmartMatchSuggestion[]> {
  return scanSmartMatches(accountId);
}

export async function searchUnconnectedSourceAccountsForAccount(
  sourceAccountId: string,
  accountId: string,
  query: string,
): Promise<UnconnectedSearchResult[]> {
  return searchUnconnectedByNickOrNote(sourceAccountId, accountId, query);
}
