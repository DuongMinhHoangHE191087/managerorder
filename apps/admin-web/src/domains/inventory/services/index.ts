import type { Database } from "@/lib/supabase/database.types";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import {
  createLicenseKey as createLicenseKeyRepo,
  deleteLicenseKey as deleteLicenseKeyRepo,
  getLicenseKeyById as getLicenseKeyByIdRepo,
  getLicenseKeysByProduct as getLicenseKeysByProductRepo,
  listLicenseKeys as listLicenseKeysRepo,
  updateLicenseKeyStatus as updateLicenseKeyStatusRepo,
} from "../repository";

type LicenseKeyRow = Database["public"]["Tables"]["license_keys"]["Row"];
type CreateLicenseKeyInput = {
  keyCode: string;
  productId: string;
  status?: LicenseKeyRow["status"];
};

export async function listInventoryKeysForAccount(accountId: string): Promise<LicenseKeyRow[]> {
  return listLicenseKeysRepo(accountId);
}

export async function getInventoryKeyForAccount(
  id: string,
  accountId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<LicenseKeyRow | null> {
  return getLicenseKeyByIdRepo(id, accountId, options);
}

export async function getAvailableInventoryKeysForProduct(
  accountId: string,
  productId: string,
): Promise<LicenseKeyRow[]> {
  return getLicenseKeysByProductRepo(accountId, productId);
}

export async function createInventoryKeyForAccount(
  accountId: string,
  input: CreateLicenseKeyInput,
  actorEmail?: string | null,
): Promise<LicenseKeyRow> {
  const row = await createLicenseKeyRepo(accountId, {
    key_code: input.keyCode,
    product_id: input.productId,
    status: input.status,
  });

  createActivityLog({
    account_id: accountId,
    action_type: "INVENTORY_KEY_CREATED",
    created_by: actorEmail ?? undefined,
    details: {
      product_id: input.productId,
      key_code: input.keyCode,
      status: input.status ?? "available",
    },
  }).catch((error) => {
    console.warn("[activity-log] Failed to log INVENTORY_KEY_CREATED:", error);
  });

  return row;
}

export async function updateInventoryKeyStatusForAccount(
  id: string,
  accountId: string,
  status: LicenseKeyRow["status"],
  orderId?: string,
): Promise<LicenseKeyRow> {
  return updateLicenseKeyStatusRepo(id, accountId, status, orderId);
}

export async function deleteInventoryKeyForAccount(
  id: string,
  accountId: string,
): Promise<void> {
  await deleteLicenseKeyRepo(id, accountId);
}

export * from "./allocation";
export * from "./analytics";
