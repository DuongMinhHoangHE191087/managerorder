import type { CreateProviderInput } from "@/lib/domain/schemas";
import type { Provider } from "@/lib/domain/types";
import { mapProviderRow } from "@/lib/supabase/mappers";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { ValidationError } from "@/lib/utils/errors";
import {
  createProvider as createProviderRepo,
  deleteProvider as deleteProviderRepo,
  getProviderById as getProviderByIdRepo,
  listProviders as listProvidersRepo,
  updateProvider as updateProviderRepo,
} from "../repository";

export interface ProviderMutationInput extends Partial<CreateProviderInput> {
  reliabilityScore?: number;
  notes?: string | null;
  createdAt?: string;
}

function normalizeProviderContacts(
  contacts?: CreateProviderInput["contacts"],
): Record<string, unknown>[] | undefined {
  if (!contacts) {
    return undefined;
  }

  return contacts.map((contact) => ({
    id: contact.id || crypto.randomUUID(),
    type: contact.type,
    value: contact.value,
    isPrimary: contact.isPrimary ?? false,
    ...(contact.type === "facebook"
      ? {
          facebookId: contact.facebookId,
          facebookName: contact.facebookName,
        }
      : {}),
  }));
}

function normalizeReliabilityScore(
  value: unknown,
  fallback?: number,
): number | undefined {
  if (value === undefined) {
    return fallback;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
    throw new ValidationError("Điểm uy tín phải nằm trong khoảng 0-100", [
      { field: "reliabilityScore", message: "Giá trị phải là số từ 0 đến 100" },
    ]);
  }

  return Math.round(numericValue);
}

function normalizeNotes(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCreatedAt(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError("Ngày tạo không hợp lệ", [
      { field: "createdAt", message: "Không đúng định dạng ngày giờ" },
    ]);
  }

  return parsed.toISOString();
}

function mapProviders(rows: Array<Record<string, unknown>>): Provider[] {
  return rows.map((row) => mapProviderRow(row));
}

export async function listProvidersForAccount(accountId: string): Promise<Provider[]> {
  const rows = await listProvidersRepo(accountId);
  return mapProviders(rows as unknown as Array<Record<string, unknown>>);
}

export async function getProviderForAccount(
  id: string,
  accountId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<Provider> {
  const row = await getProviderByIdRepo(id, accountId, options);
  return mapProviderRow(row as unknown as Record<string, unknown>);
}

export async function createProviderForAccount(
  accountId: string,
  input: CreateProviderInput & Pick<ProviderMutationInput, "reliabilityScore" | "notes">,
  actorEmail?: string | null,
): Promise<Provider> {
  const row = await createProviderRepo(accountId, {
    name: input.name,
    contacts: normalizeProviderContacts(input.contacts) ?? [],
    tier: input.tier ?? "regular",
    reliability_score: normalizeReliabilityScore(input.reliabilityScore, 100) ?? 100,
    notes: normalizeNotes(input.notes),
  });

  const data = mapProviderRow(row as unknown as Record<string, unknown>);

  createActivityLog({
    account_id: accountId,
    action_type: "PROCUREMENT_UPDATED",
    created_by: actorEmail ?? undefined,
    details: {
      action: "provider_created",
      provider_id: data.id,
      provider_name: data.name,
    },
  }).catch(() => {});

  return data;
}

export async function updateProviderForAccount(
  id: string,
  accountId: string,
  input: ProviderMutationInput,
  actorEmail?: string | null,
): Promise<Provider> {
  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) updateData.name = input.name;
  if (input.tier !== undefined) updateData.tier = input.tier;

  const reliabilityScore = normalizeReliabilityScore(input.reliabilityScore);
  if (reliabilityScore !== undefined) {
    updateData.reliability_score = reliabilityScore;
  }

  const notes = normalizeNotes(input.notes);
  if (notes !== undefined) {
    updateData.notes = notes;
  }

  const createdAt = normalizeCreatedAt(input.createdAt);
  if (createdAt) {
    updateData.created_at = createdAt;
  }

  const contacts = normalizeProviderContacts(input.contacts);
  if (contacts !== undefined) {
    updateData.contacts = contacts;
  }

  const row = await updateProviderRepo(id, accountId, updateData);
  const data = mapProviderRow(row as unknown as Record<string, unknown>);

  createActivityLog({
    account_id: accountId,
    action_type: "PROCUREMENT_UPDATED",
    created_by: actorEmail ?? undefined,
    details: {
      action: "provider_updated",
      provider_id: id,
      provider_name: data.name,
    },
  }).catch(() => {});

  return data;
}

export async function deleteProviderForAccount(
  id: string,
  accountId: string,
  actorEmail?: string | null,
): Promise<void> {
  const provider = await getProviderByIdRepo(id, accountId);
  await deleteProviderRepo(id, accountId);

  createActivityLog({
    account_id: accountId,
    action_type: "PROCUREMENT_UPDATED",
    created_by: actorEmail ?? undefined,
    details: {
      action: "provider_deleted",
      provider_id: id,
      provider_name: provider.name,
    },
  }).catch(() => {});
}
