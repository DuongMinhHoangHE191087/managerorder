import { randomBytes } from "node:crypto";
import { getDecryptedSourceAccountSecretsForAccount } from "@/domains/source-accounts";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import { getSourceAccountById } from "@/lib/supabase/repositories/source-accounts.repo";
import { ValidationError } from "@/lib/utils/errors";
import {
  createUnlockCookieValue,
  hashPasscode,
  verifyPasscode,
  verifyUnlockCookieValue,
} from "./crypto";
import {
  createAccountShareLink,
  consumeAccountShareUnlock,
  consumeAccountShareView,
  getAccountShareLinkById,
  getAccountShareLinkBySlug,
  listAccountShareAccessLogs,
  listAccountShareLinks,
  lockAccountShareIp,
  logAccountShareAccess,
  softDeleteAccountShareLink,
  updateAccountShareLink,
} from "./repository";
import { generateTotp, isTotpCredentialValue } from "./totp";
import type {
  AccountShareAccessPolicy,
  AccountShareAccessLog,
  AccountShareAccessLogRow,
  AccountShareCreateInput,
  AccountShareCredentialPayload,
  AccountShareExposurePolicy,
  AccountShareFieldType,
  AccountShareLink,
  AccountShareLinkRow,
  AccountSharePayload,
  AccountSharePublicSummary,
  AccountShareUpdateInput,
  ShareVisitorContext,
} from "./types";

const SLUG_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const DEFAULT_FIELDS: AccountShareFieldType[] = ["email", "password", "link_join", "duolingo_id", "2fa", "2fa_backup"];
const DEFAULT_MAX_VIEWS = 20;
const DEFAULT_MAX_UNLOCKS = 10;

type OrderItemScopeRow = {
  id: string;
  order_id: string;
  assigned_source_account_id: string | null;
};

type OrderScopeRow = {
  id: string;
  account_id: string;
  customer_id: string | null;
};

type DecryptedSourceAccountSecrets = NonNullable<Awaited<ReturnType<typeof getDecryptedSourceAccountSecretsForAccount>>>;
type DecryptedShareCredential = DecryptedSourceAccountSecrets["credentials"][number];

function generateSlug(length = 12) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => SLUG_CHARS[byte % SLUG_CHARS.length]).join("");
}

function getPublicBaseUrl(origin?: string | null) {
  // Priority: request origin (actual deploy domain) > env var > empty
  // This ensures share links always use the correct domain regardless of env config
  const requestOrigin = (origin || '').replace(/\/$/, '');
  const envBase = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  // Prefer request origin so deployed URL auto-adapts to production domain
  return requestOrigin || envBase;
}

function toPublicUrl(slug: string, origin?: string | null) {
  const baseUrl = getPublicBaseUrl(origin);
  return baseUrl ? `${baseUrl}/share/${slug}` : `/share/${slug}`;
}

function normalizeExposurePolicy(input: AccountShareExposurePolicy | undefined): AccountShareExposurePolicy {
  const fields = input?.fields?.length ? input.fields : DEFAULT_FIELDS;
  const uniqueFields = [...new Set(fields)].filter(isShareField);
  return {
    fields: uniqueFields.length ? uniqueFields : DEFAULT_FIELDS,
    credentialIds: input?.credentialIds?.filter(Boolean),
    includeLabels: input?.includeLabels ?? true,
    shareTotpSecret: input?.shareTotpSecret === true,
  };
}

function normalizeAccessPolicy(input: {
  passcode?: string | null;
  allowNoPasscode?: boolean;
  lockToIp?: boolean;
}): AccountShareAccessPolicy {
  const requirePasscode = Boolean(input.passcode?.trim()) || input.allowNoPasscode !== true;
  return {
    requirePasscode,
    allowNoPasscode: input.allowNoPasscode === true,
    lockToIp: input.lockToIp === true,
  };
}

function isShareField(value: string): value is AccountShareFieldType {
  return value === "email"
    || value === "password"
    || value === "link_join"
    || value === "2fa"
    || value === "2fa_backup"
    || value === "duolingo_id"
    || value === "other";
}

function getShareCredentialType(credential: DecryptedShareCredential): AccountShareCredentialPayload["type"] | null {
  if (!isShareField(credential.type) || credential.type === "email" || credential.type === "password") {
    return null;
  }
  return credential.type as AccountShareCredentialPayload["type"];
}

function getAllowedShareCredentialType(
  credential: DecryptedShareCredential,
  exposurePolicy: AccountShareExposurePolicy,
): AccountShareCredentialPayload["type"] | null {
  if (credential.shareable === false) {
    return null;
  }

  const credentialType = getShareCredentialType(credential);
  if (!credentialType) {
    return null;
  }

  if (exposurePolicy.credentialIds?.length) {
    return exposurePolicy.credentialIds.includes(credential.id) ? credentialType : null;
  }

  return exposurePolicy.fields.includes(credentialType) ? credentialType : null;
}

function parseExposurePolicy(value: unknown): AccountShareExposurePolicy {
  if (!value || typeof value !== "object") {
    return normalizeExposurePolicy(undefined);
  }
  const raw = value as Record<string, unknown>;
  return normalizeExposurePolicy({
    fields: Array.isArray(raw.fields) ? raw.fields.filter((item): item is AccountShareFieldType => typeof item === "string" && isShareField(item)) : [],
    credentialIds: Array.isArray(raw.credentialIds) ? raw.credentialIds.filter((item): item is string => typeof item === "string") : undefined,
    includeLabels: typeof raw.includeLabels === "boolean" ? raw.includeLabels : undefined,
    shareTotpSecret: typeof raw.shareTotpSecret === "boolean" ? raw.shareTotpSecret : undefined,
  });
}

function parseAccessPolicy(value: unknown, hasPasscode: boolean): AccountShareAccessPolicy {
  if (!value || typeof value !== "object") {
    return { requirePasscode: hasPasscode, allowNoPasscode: !hasPasscode, lockToIp: false };
  }
  const raw = value as Record<string, unknown>;
  return {
    requirePasscode: typeof raw.requirePasscode === "boolean" ? raw.requirePasscode : hasPasscode,
    allowNoPasscode: typeof raw.allowNoPasscode === "boolean" ? raw.allowNoPasscode : !hasPasscode,
    lockToIp: raw.lockToIp === true,
  };
}

function mapAccountShareAccessLog(row: AccountShareAccessLogRow): AccountShareAccessLog {
  return {
    id: row.id,
    linkId: row.account_share_link_id,
    accountId: row.account_id,
    eventType: row.event_type,
    ipAddress: row.ip_address,
    ipVersion: row.ip_version,
    userAgent: row.user_agent,
    reason: row.reason,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export function mapAccountShareLink(row: AccountShareLinkRow, origin?: string | null): AccountShareLink {
  const exposurePolicy = parseExposurePolicy(row.exposure_policy);
  const accessPolicy = parseAccessPolicy(row.access_policy, Boolean(row.passcode_hash));

  return {
    id: row.id,
    accountId: row.account_id,
    sourceAccountId: row.source_account_id,
    orderId: row.order_id,
    orderItemId: row.order_item_id,
    customerId: row.customer_id,
    shortLinkId: row.short_link_id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    expiresAt: row.expires_at,
    maxViews: row.max_views,
    viewCount: row.view_count,
    maxUnlocks: row.max_unlocks,
    unlockCount: row.unlock_count,
    passcodeRequired: Boolean(row.passcode_hash) || accessPolicy.requirePasscode,
    exposurePolicy,
    accessPolicy,
    lockedIp: row.locked_ip,
    lockedIpv6: row.locked_ipv6,
    publicUrl: toPublicUrl(row.slug, origin),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAccountSharesForAccount(
  accountId: string,
  filters: { sourceAccountId?: string | null } = {},
  origin?: string | null,
) {
  const rows = await listAccountShareLinks(accountId, filters);
  return rows.map((row) => mapAccountShareLink(row, origin));
}

export async function getAccountShareForAccount(id: string, accountId: string, origin?: string | null) {
  const row = await getAccountShareLinkById(id, accountId);
  return row ? mapAccountShareLink(row, origin) : null;
}

export async function listAccountShareLogsForAccount(id: string, accountId: string) {
  const row = await getAccountShareLinkById(id, accountId);
  if (!row) {
    return null;
  }

  const logs = await listAccountShareAccessLogs(id, accountId);
  return logs.map(mapAccountShareAccessLog);
}

export async function createAccountShareForAccount(
  accountId: string,
  input: AccountShareCreateInput,
  actorEmail?: string | null,
  origin?: string | null,
) {
  await assertShareScope(accountId, input.sourceAccountId, {
    orderId: input.orderId,
    orderItemId: input.orderItemId,
    customerId: input.customerId,
  });

  const passcode = input.passcode?.trim() || null;
  const exposurePolicy = normalizeExposurePolicy(input.exposurePolicy);
  const accessPolicy = normalizeAccessPolicy({
    passcode,
    allowNoPasscode: input.allowNoPasscode,
    lockToIp: input.lockToIp,
  });
  await assertAccessPolicyIsSafe(accountId, input.sourceAccountId, exposurePolicy, accessPolicy, Boolean(passcode));

  const row = await createAccountShareLink({
    account_id: accountId,
    source_account_id: input.sourceAccountId,
    order_id: input.orderId ?? null,
    order_item_id: input.orderItemId ?? null,
    customer_id: input.customerId ?? null,
    slug: generateSlug(),
    title: input.title ?? null,
    expires_at: input.expiresAt ?? null,
    max_views: input.maxViews ?? DEFAULT_MAX_VIEWS,
    max_unlocks: input.maxUnlocks ?? DEFAULT_MAX_UNLOCKS,
    passcode_hash: passcode ? hashPasscode(passcode) : null,
    exposure_policy: exposurePolicy,
    access_policy: accessPolicy,
    created_by: actorEmail ?? null,
  });

  return mapAccountShareLink(row, origin);
}

export async function updateAccountShareForAccount(
  id: string,
  accountId: string,
  input: AccountShareUpdateInput,
  origin?: string | null,
) {
  const existing = await getAccountShareLinkById(id, accountId);
  if (!existing) {
    return null;
  }

  const existingAccess = parseAccessPolicy(existing.access_policy, Boolean(existing.passcode_hash));
  const passcode = input.passcode?.trim();
  const nextExposurePolicy = input.exposurePolicy !== undefined
    ? normalizeExposurePolicy(input.exposurePolicy)
    : parseExposurePolicy(existing.exposure_policy);
  const nextAccessPolicy: AccountShareAccessPolicy = {
    ...existingAccess,
    ...(input.lockToIp !== undefined ? { lockToIp: input.lockToIp } : {}),
    ...(input.clearPasscode ? { requirePasscode: false, allowNoPasscode: true } : {}),
    ...(passcode ? { requirePasscode: true, allowNoPasscode: false } : {}),
  };
  const nextHasPasscode = Boolean(passcode || (!input.clearPasscode && existing.passcode_hash));
  await assertAccessPolicyIsSafe(accountId, existing.source_account_id, nextExposurePolicy, nextAccessPolicy, nextHasPasscode);

  const updated = await updateAccountShareLink(id, accountId, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.expiresAt !== undefined ? { expires_at: input.expiresAt } : {}),
    ...(input.maxViews !== undefined ? { max_views: input.maxViews } : {}),
    ...(input.maxUnlocks !== undefined ? { max_unlocks: input.maxUnlocks } : {}),
    ...(input.exposurePolicy !== undefined ? { exposure_policy: nextExposurePolicy } : {}),
    ...(input.clearPasscode ? { passcode_hash: null } : {}),
    ...(passcode ? { passcode_hash: hashPasscode(passcode) } : {}),
    access_policy: nextAccessPolicy,
  });

  return mapAccountShareLink(updated, origin);
}

export async function deleteAccountShareForAccount(id: string, accountId: string) {
  await softDeleteAccountShareLink(id, accountId);
}

export async function resolveAccountShareSummary(
  slug: string,
  unlockCookie: string | null | undefined,
  visitor: ShareVisitorContext,
): Promise<AccountSharePublicSummary> {
  const row = await getAccountShareLinkBySlug(slug);
  if (!row) {
    return {
      slug,
      title: null,
      status: "not_found",
      passcodeRequired: false,
      expiresAt: null,
      locked: true,
      reason: "not_found",
    };
  }

  const validation = validateShareRow(row, visitor);
  const accessPolicy = parseAccessPolicy(row.access_policy, Boolean(row.passcode_hash));
  const hasUnlock = Boolean(verifyUnlockCookieValue(unlockCookie, { slug, userAgent: visitor.userAgent }));
  const passcodeRequired = Boolean(row.passcode_hash) || accessPolicy.requirePasscode;
  const locked = Boolean(validation.reason) || (passcodeRequired && !hasUnlock);

  return {
    slug,
    title: row.title,
    status: validation.reason ? row.status : row.status,
    passcodeRequired,
    expiresAt: row.expires_at,
    locked,
    reason: validation.reason ?? (locked ? "locked" : undefined),
  };
}

export async function unlockAccountShare(
  slug: string,
  passcode: string | null | undefined,
  visitor: ShareVisitorContext,
) {
  const row = await getAccountShareLinkBySlug(slug);
  if (!row) {
    return { ok: false, status: 404, error: "Share link not found" };
  }

  const validation = validateShareRow(row, visitor, { checkUnlockLimit: true });
  if (validation.reason) {
    await logBlocked(row, visitor, validation.reason);
    return { ok: false, status: 403, error: validation.message };
  }

  const accessPolicy = parseAccessPolicy(row.access_policy, Boolean(row.passcode_hash));
  if (row.passcode_hash && !verifyPasscode(passcode ?? "", row.passcode_hash)) {
    await logBlocked(row, visitor, passcode ? "invalid_passcode" : "missing_passcode");
    return { ok: false, status: 401, error: "Invalid unlock code" };
  }
  if (!row.passcode_hash && accessPolicy.requirePasscode && !accessPolicy.allowNoPasscode) {
    await logBlocked(row, visitor, "passcode_not_configured");
    return { ok: false, status: 403, error: "Share link is missing an unlock code" };
  }

  const consumedRow = await consumeAccountShareUnlock(row.id);
  if (!consumedRow) {
    await logBlocked(row, visitor, "unlock_limit_reached");
    return { ok: false, status: 403, error: "Share link unlock limit reached" };
  }

  if (accessPolicy.lockToIp && visitor.ipAddress && visitor.ipVersion !== "unknown") {
    const field = visitor.ipVersion === "IPv6" ? "locked_ipv6" : "locked_ip";
    const currentLock = visitor.ipVersion === "IPv6" ? row.locked_ipv6 : row.locked_ip;
    if (!currentLock) {
      await lockAccountShareIp(row.id, field, visitor.ipAddress);
    }
  }

  await logAccountShareAccess({
    linkId: consumedRow.id,
    accountId: consumedRow.account_id,
    eventType: "unlock",
    visitor,
  });

  return {
    ok: true,
    status: 200,
    cookieValue: createUnlockCookieValue({ slug, userAgent: visitor.userAgent }),
  };
}

export async function getAccountSharePublicPayload(
  slug: string,
  unlockCookie: string | null | undefined,
  visitor: ShareVisitorContext,
): Promise<{ status: number; payload?: AccountSharePayload; error?: string }> {
  const access = await requireShareAccess(slug, unlockCookie, visitor, { checkViewLimit: true });
  if (!access.ok) {
    return { status: access.status, error: access.error };
  }

  const consumedRow = await consumeAccountShareView(access.row.id);
  if (!consumedRow) {
    await logBlocked(access.row, visitor, "view_limit_reached");
    return { status: 403, error: "Share link view limit reached" };
  }

  const secrets = await getDecryptedSourceAccountSecretsForAccount(consumedRow.source_account_id, consumedRow.account_id);
  if (!secrets) {
    await logBlocked(access.row, visitor, "source_account_not_found");
    return { status: 404, error: "Source account not found" };
  }

  const share = mapAccountShareLink(consumedRow);
  const payload = buildSharePayload(consumedRow, share.exposurePolicy, secrets);
  await logAccountShareAccess({
    linkId: consumedRow.id,
    accountId: consumedRow.account_id,
    eventType: "view",
    visitor,
  });

  return { status: 200, payload };
}

export async function getAccountSharePublicTotp(
  slug: string,
  credentialId: string,
  unlockCookie: string | null | undefined,
  visitor: ShareVisitorContext,
) {
  const access = await requireShareAccess(slug, unlockCookie, visitor);
  if (!access.ok) {
    return { status: access.status, error: access.error };
  }

  const result = await getShareTotpForSourceAccountCredential(
    access.row,
    credentialId,
  );
  if (!result) {
    await logBlocked(access.row, visitor, "totp_not_found");
    return { status: 404, error: "TOTP credential not found" };
  }

  await logAccountShareAccess({
    linkId: access.row.id,
    accountId: access.row.account_id,
    eventType: "totp_view",
    visitor,
    metadata: { credentialId },
  });

  return { status: 200, data: result };
}

export async function getInternalSourceAccountTotpForAccount(
  sourceAccountId: string,
  accountId: string,
  credentialId: string,
) {
  return getTotpForSourceAccountCredential(sourceAccountId, accountId, credentialId);
}

export async function logAccountSharePublicEvent(
  slug: string,
  eventType: "copy" | "view" | "totp_view",
  unlockCookie: string | null | undefined,
  visitor: ShareVisitorContext,
  metadata?: Record<string, unknown>,
) {
  const access = await requireShareAccess(slug, unlockCookie, visitor);
  if (!access.ok) {
    return { ok: false as const, status: access.status, error: access.error };
  }
  await logAccountShareAccess({
    linkId: access.row.id,
    accountId: access.row.account_id,
    eventType,
    visitor,
    metadata,
  });
  return { ok: true as const };
}

async function getTotpForSourceAccountCredential(sourceAccountId: string, accountId: string, credentialId: string) {
  const secrets = await getDecryptedSourceAccountSecretsForAccount(sourceAccountId, accountId);
  const credential = secrets?.credentials.find((item) => item.id === credentialId);
  if (!credential || !isTotpCredentialValue(credential.value, credential.format)) {
    return null;
  }

  const result = generateTotp(credential.value);
  return {
    credentialId,
    ...result,
  };
}

async function getShareTotpForSourceAccountCredential(row: AccountShareLinkRow, credentialId: string) {
  const secrets = await getDecryptedSourceAccountSecretsForAccount(row.source_account_id, row.account_id);
  const credential = secrets?.credentials.find((item) => item.id === credentialId);
  if (!credential || !isTotpCredentialValue(credential.value, credential.format)) {
    return null;
  }

  const exposurePolicy = parseExposurePolicy(row.exposure_policy);
  if (!getAllowedShareCredentialType(credential, exposurePolicy)) {
    return null;
  }

  const result = generateTotp(credential.value);
  return {
    credentialId,
    ...result,
  };
}

async function assertShareScope(
  accountId: string,
  sourceAccountId: string,
  scope: { orderId?: string | null; orderItemId?: string | null; customerId?: string | null },
) {
  const sourceAccount = await getSourceAccountById(sourceAccountId, accountId);
  if (!sourceAccount) {
    throw new Error("Source account not found");
  }

  if (!scope.orderItemId && !scope.orderId && !scope.customerId) {
    return;
  }

  let orderId = scope.orderId ?? null;
  if (scope.orderItemId) {
    const { data: item, error } = await supabase
      .from("order_items")
      .select("id, order_id, assigned_source_account_id")
      .eq("id", scope.orderItemId)
      .maybeSingle();
    if (error || !item) {
      throw new Error("Order item not found");
    }
    const typedItem = item as OrderItemScopeRow;
    if (typedItem.assigned_source_account_id && typedItem.assigned_source_account_id !== sourceAccountId) {
      throw new Error("Order item is assigned to another source account");
    }
    orderId = typedItem.order_id;
  }

  if (orderId) {
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, account_id, customer_id")
      .eq("id", orderId)
      .eq("account_id", accountId)
      .maybeSingle();
    if (error || !order) {
      throw new Error("Order does not belong to this account");
    }
    const typedOrder = order as OrderScopeRow;
    if (scope.customerId && typedOrder.customer_id !== scope.customerId) {
      throw new Error("Customer does not match the order");
    }
  }
}

async function assertAccessPolicyIsSafe(
  accountId: string,
  sourceAccountId: string,
  exposurePolicy: AccountShareExposurePolicy,
  accessPolicy: AccountShareAccessPolicy,
  hasPasscode: boolean,
) {
  if (accessPolicy.requirePasscode && !hasPasscode) {
    throw new ValidationError("Link yêu cầu mã mở khóa nhưng chưa có passcode");
  }

  if (hasPasscode || !accessPolicy.allowNoPasscode) {
    return;
  }

  const secrets = await getDecryptedSourceAccountSecretsForAccount(sourceAccountId, accountId);
  if (secrets && accountShareExposurePolicyContainsSensitiveData(exposurePolicy, secrets)) {
    throw new ValidationError("Không thể tạo link không mã cho mật khẩu, 2FA hoặc credential được đánh dấu nhạy cảm");
  }
}

export function accountShareExposurePolicyContainsSensitiveData(
  exposurePolicy: AccountShareExposurePolicy,
  secrets: DecryptedSourceAccountSecrets,
) {
  if (exposurePolicy.fields.includes("password")) {
    return true;
  }

  if (!exposurePolicy.credentialIds?.length) {
    return exposurePolicy.fields.includes("2fa") || exposurePolicy.fields.includes("2fa_backup");
  }

  const credentialIds = new Set(exposurePolicy.credentialIds);
  return secrets.credentials.some((credential) =>
    credentialIds.has(credential.id)
    && (credential.type === "2fa" || credential.type === "2fa_backup" || credential.masked === true)
  );
}

function validateShareRow(
  row: AccountShareLinkRow,
  visitor: ShareVisitorContext,
  options: { checkViewLimit?: boolean; checkUnlockLimit?: boolean } = {},
): { reason: string | null; message?: string } {
  if (row.status !== "active") {
    return { reason: "inactive_link", message: "Share link is not active" };
  }
  if (row.expires_at && new Date(row.expires_at) <= new Date()) {
    return { reason: "expired_link", message: "Share link has expired" };
  }
  if (options.checkViewLimit && row.max_views > 0 && row.view_count >= row.max_views) {
    return { reason: "view_limit_reached", message: "Share link view limit reached" };
  }
  if (options.checkUnlockLimit && row.max_unlocks > 0 && row.unlock_count >= row.max_unlocks) {
    return { reason: "unlock_limit_reached", message: "Share link unlock limit reached" };
  }

  const lockedIp = visitor.ipVersion === "IPv6" ? row.locked_ipv6 : row.locked_ip;
  if (lockedIp && visitor.ipAddress && lockedIp !== visitor.ipAddress) {
    return { reason: `ip_mismatch_${visitor.ipVersion}`, message: "Share link is locked to another network" };
  }

  return { reason: null };
}

async function requireShareAccess(
  slug: string,
  unlockCookie: string | null | undefined,
  visitor: ShareVisitorContext,
  options: { checkViewLimit?: boolean } = {},
): Promise<
  | { ok: true; row: AccountShareLinkRow }
  | { ok: false; status: number; error: string }
> {
  const row = await getAccountShareLinkBySlug(slug);
  if (!row) {
    return { ok: false, status: 404, error: "Share link not found" };
  }

  const validation = validateShareRow(row, visitor, options);
  if (validation.reason) {
    await logBlocked(row, visitor, validation.reason);
    return { ok: false, status: 403, error: validation.message ?? "Share link is blocked" };
  }

  const accessPolicy = parseAccessPolicy(row.access_policy, Boolean(row.passcode_hash));
  const passcodeRequired = Boolean(row.passcode_hash) || accessPolicy.requirePasscode;
  if (passcodeRequired && !verifyUnlockCookieValue(unlockCookie, { slug, userAgent: visitor.userAgent })) {
    await logBlocked(row, visitor, "locked");
    return { ok: false, status: 401, error: "Unlock required" };
  }

  return { ok: true, row };
}

async function logBlocked(row: AccountShareLinkRow, visitor: ShareVisitorContext, reason: string) {
  await logAccountShareAccess({
    linkId: row.id,
    accountId: row.account_id,
    eventType: "blocked",
    visitor,
    reason,
  });
}

export function buildSharePayload(
  row: AccountShareLinkRow,
  exposurePolicy: AccountShareExposurePolicy,
  secrets: DecryptedSourceAccountSecrets,
): AccountSharePayload {
  const fieldSet = new Set(exposurePolicy.fields);
  const credentials: AccountShareCredentialPayload[] = [];

  for (const credential of secrets.credentials) {
    const credentialType = getAllowedShareCredentialType(credential, exposurePolicy);
    if (!credentialType) {
      continue;
    }

    const totpAvailable = isTotpCredentialValue(credential.value, credential.format);
    const shouldShareSecret = exposurePolicy.shareTotpSecret === true;
    credentials.push({
      id: credential.id,
      type: credentialType,
      label: credential.label || credential.type,
      value: (totpAvailable && !shouldShareSecret) ? null : credential.value,
      format: credential.format,
      masked: credential.masked ?? (credential.type === "2fa" || credential.type === "2fa_backup"),
      totpAvailable,
    });
  }

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    email: fieldSet.has("email") ? secrets.email : null,
    password: fieldSet.has("password") ? secrets.password : null,
    credentials,
    expiresAt: row.expires_at,
    remainingViews: row.max_views > 0 ? Math.max(0, row.max_views - row.view_count) : null,
  };
}
