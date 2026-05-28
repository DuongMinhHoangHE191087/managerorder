import type { WarehouseCredentialFormat, WarehouseCredentialType } from "@/lib/domain/types";

export type AccountShareStatus = "active" | "disabled" | "expired";
export type AccountShareEventType = "unlock" | "view" | "copy" | "totp_view" | "blocked";
export type AccountShareFieldType =
  | "email"
  | "password"
  | WarehouseCredentialType;

export interface AccountShareExposurePolicy {
  fields: AccountShareFieldType[];
  credentialIds?: string[];
  includeLabels?: boolean;
  shareTotpSecret?: boolean;
}

export interface AccountShareAccessPolicy {
  requirePasscode: boolean;
  allowNoPasscode?: boolean;
  lockToIp?: boolean;
}

export interface AccountShareLink {
  id: string;
  accountId: string;
  sourceAccountId: string;
  orderId: string | null;
  orderItemId: string | null;
  customerId: string | null;
  shortLinkId: string | null;
  slug: string;
  title: string | null;
  status: AccountShareStatus;
  expiresAt: string | null;
  maxViews: number;
  viewCount: number;
  maxUnlocks: number;
  unlockCount: number;
  passcodeRequired: boolean;
  exposurePolicy: AccountShareExposurePolicy;
  accessPolicy: AccountShareAccessPolicy;
  lockedIp: string | null;
  lockedIpv6: string | null;
  publicUrl?: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountShareLinkRow {
  id: string;
  account_id: string;
  source_account_id: string;
  order_id: string | null;
  order_item_id: string | null;
  customer_id: string | null;
  short_link_id: string | null;
  slug: string;
  title: string | null;
  status: AccountShareStatus;
  expires_at: string | null;
  max_views: number;
  view_count: number;
  max_unlocks: number;
  unlock_count: number;
  passcode_hash: string | null;
  exposure_policy: unknown;
  access_policy: unknown;
  locked_ip: string | null;
  locked_ipv6: string | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountShareAccessLogRow {
  id: string;
  account_share_link_id: string;
  account_id: string;
  event_type: AccountShareEventType;
  ip_address: string | null;
  ip_version: string | null;
  user_agent: string | null;
  reason: string | null;
  metadata: unknown;
  created_at: string;
}

export interface AccountShareAccessLog {
  id: string;
  linkId: string;
  accountId: string;
  eventType: AccountShareEventType;
  ipAddress: string | null;
  ipVersion: string | null;
  userAgent: string | null;
  reason: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface AccountShareCreateInput {
  sourceAccountId: string;
  orderId?: string | null;
  orderItemId?: string | null;
  customerId?: string | null;
  title?: string | null;
  expiresAt?: string | null;
  maxViews?: number;
  maxUnlocks?: number;
  passcode?: string | null;
  allowNoPasscode?: boolean;
  lockToIp?: boolean;
  exposurePolicy: AccountShareExposurePolicy;
}

export interface AccountShareUpdateInput {
  title?: string | null;
  status?: AccountShareStatus;
  expiresAt?: string | null;
  maxViews?: number;
  maxUnlocks?: number;
  passcode?: string | null;
  clearPasscode?: boolean;
  lockToIp?: boolean;
  exposurePolicy?: AccountShareExposurePolicy;
}

export interface AccountShareCredentialPayload {
  id: string;
  type: WarehouseCredentialType;
  label: string;
  value: string | null;
  format?: WarehouseCredentialFormat;
  masked: boolean;
  totpAvailable: boolean;
}

export interface AccountSharePayload {
  id: string;
  slug: string;
  title: string | null;
  email: string | null;
  password: string | null;
  credentials: AccountShareCredentialPayload[];
  expiresAt: string | null;
  remainingViews: number | null;
}

export interface AccountSharePublicSummary {
  slug: string;
  title: string | null;
  status: AccountShareStatus | "not_found";
  passcodeRequired: boolean;
  expiresAt: string | null;
  locked: boolean;
  reason?: string;
}

export interface ShareVisitorContext {
  ipAddress: string | null;
  ipVersion: "IPv4" | "IPv6" | "unknown";
  userAgent: string | null;
}
