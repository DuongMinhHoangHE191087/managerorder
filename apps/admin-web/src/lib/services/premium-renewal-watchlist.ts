import { format } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadRowsByIds } from "@/lib/supabase/relation-fallback";

type RenewalWatchCandidate = {
  id: string;
  customer_id: string;
  premium_account_id: string;
  premium_account_user_id: string | null;
  service_type_id: string;
  expiry_date: string;
  status: string;
};

type CustomerRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
};

type PremiumAccountRow = {
  id: string;
  primary_email: string;
};

type PremiumAccountUserRow = {
  id: string;
  user_email: string;
};

type ServiceTypeRow = {
  id: string;
  name: string;
};

type CustomerContactRow = {
  customer_id: string;
  channel: "phone" | "email" | "zalo" | "facebook" | "telegram" | "other";
  value: string;
  is_verified: boolean;
};

export type RenewalWatchlistUrgency = "expired" | "expiring";

export interface RenewalWatchlistItem {
  subscriptionId: string;
  customerId: string;
  customerName: string;
  serviceName: string;
  nick: string;
  accountEmail: string;
  expiryDate: string;
  expiryDateLabel: string;
  daysUntilExpiry: number;
  urgency: RenewalWatchlistUrgency;
  contactChannel: string;
  contactValue: string;
  notificationMessage: string;
}

export interface RenewalWatchlistResult {
  thresholdDays: number;
  summary: {
    expiredCount: number;
    expiringSoonCount: number;
    totalActionable: number;
  };
  expired: RenewalWatchlistItem[];
  expiringSoon: RenewalWatchlistItem[];
}

export interface PremiumRenewalWatchlistOptions {
  accountId: string;
  daysThreshold?: number;
  limit?: number;
}

const DEFAULT_THRESHOLD_DAYS = 7;
const DEFAULT_LIMIT = 50;

const CONTACT_PRIORITY: Record<CustomerContactRow["channel"], number> = {
  zalo: 0,
  phone: 1,
  telegram: 2,
  email: 3,
  facebook: 4,
  other: 5,
};

const CONTACT_LABELS: Record<CustomerContactRow["channel"], string> = {
  zalo: "Zalo",
  phone: "SĐT",
  telegram: "Telegram",
  email: "Email",
  facebook: "Facebook",
  other: "Khác",
};

function normalizeInteger(value: number | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function getExpiryDateLabel(expiryDate: string) {
  const parsed = new Date(expiryDate);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }
  return format(parsed, "dd/MM/yyyy");
}

function getDaysUntilExpiry(expiryDate: string) {
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) {
    return 9999;
  }

  const now = new Date();
  const dayStartNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayStartExpiry = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const diffMs = dayStartExpiry.getTime() - dayStartNow.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function resolvePreferredContact(
  customer: CustomerRow | null,
  contacts: CustomerContactRow[],
) {
  if (contacts.length > 0) {
    const sorted = [...contacts].sort((left, right) => {
      if (left.is_verified !== right.is_verified) {
        return Number(right.is_verified) - Number(left.is_verified);
      }
      return CONTACT_PRIORITY[left.channel] - CONTACT_PRIORITY[right.channel];
    });
    const selected = sorted[0];
    return {
      channel: CONTACT_LABELS[selected.channel],
      value: selected.value,
    };
  }

  if (customer?.phone) {
    return { channel: "SĐT", value: customer.phone };
  }

  if (customer?.email) {
    return { channel: "Email", value: customer.email };
  }

  return { channel: "Liên hệ", value: "Chưa có thông tin" };
}

function buildNotificationMessage(input: {
  customerName: string;
  nick: string;
  serviceName: string;
  expiryDateLabel: string;
  daysUntilExpiry: number;
}) {
  const urgencyLine =
    input.daysUntilExpiry < 0
      ? `đã hết hạn ${Math.abs(input.daysUntilExpiry)} ngày`
      : input.daysUntilExpiry === 0
        ? "hết hạn hôm nay"
        : `sẽ hết hạn sau ${input.daysUntilExpiry} ngày`;

  return [
    `Chào ${input.customerName},`,
    `Nick ${input.nick} (${input.serviceName}) ${urgencyLine} (hạn: ${input.expiryDateLabel}).`,
    "Anh/chị vui lòng phản hồi để mình hỗ trợ gia hạn sớm, tránh gián đoạn sử dụng.",
  ].join(" ");
}

export async function getPremiumRenewalWatchlist(
  options: PremiumRenewalWatchlistOptions,
): Promise<RenewalWatchlistResult> {
  const daysThreshold = normalizeInteger(options.daysThreshold, DEFAULT_THRESHOLD_DAYS, 1, 30);
  const limit = normalizeInteger(options.limit, DEFAULT_LIMIT, 1, 200);

  const { data: subscriptions, error } = await supabaseAdmin
    .from("customer_premium_subscriptions")
    .select("id, customer_id, premium_account_id, premium_account_user_id, service_type_id, expiry_date, status")
    .eq("account_id", options.accountId)
    .in("status", ["active", "waiting_renewal", "expired"])
    .is("deleted_at", null)
    .order("expiry_date", { ascending: true });

  if (error) {
    throw error;
  }

  const typedSubscriptions = (subscriptions ?? []) as RenewalWatchCandidate[];
  if (typedSubscriptions.length === 0) {
    return {
      thresholdDays: daysThreshold,
      summary: {
        expiredCount: 0,
        expiringSoonCount: 0,
        totalActionable: 0,
      },
      expired: [],
      expiringSoon: [],
    };
  }

  const customerIds = [...new Set(typedSubscriptions.map((item) => item.customer_id))];
  const premiumAccountIds = [...new Set(typedSubscriptions.map((item) => item.premium_account_id))];
  const premiumAccountUserIds = [
    ...new Set(
      typedSubscriptions
        .map((item) => item.premium_account_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const serviceTypeIds = [...new Set(typedSubscriptions.map((item) => item.service_type_id))];

  const [customerMap, premiumAccountMap, premiumAccountUserMap, serviceTypeMap, contactsResult] =
    await Promise.all([
      loadRowsByIds<CustomerRow>(
        supabaseAdmin,
        "customers",
        options.accountId,
        customerIds,
        "id, full_name, phone, email",
      ),
      loadRowsByIds<PremiumAccountRow>(
        supabaseAdmin,
        "premium_accounts",
        options.accountId,
        premiumAccountIds,
        "id, primary_email",
      ),
      loadRowsByIds<PremiumAccountUserRow>(
        supabaseAdmin,
        "premium_account_users",
        options.accountId,
        premiumAccountUserIds,
        "id, user_email",
      ),
      loadRowsByIds<ServiceTypeRow>(
        supabaseAdmin,
        "premium_service_types",
        options.accountId,
        serviceTypeIds,
        "id, name",
      ),
      supabaseAdmin
        .from("customer_contacts")
        .select("customer_id, channel, value, is_verified")
        .in("customer_id", customerIds),
    ]);

  if (contactsResult.error) {
    throw contactsResult.error;
  }

  const contactsByCustomer = new Map<string, CustomerContactRow[]>();
  for (const row of (contactsResult.data ?? []) as CustomerContactRow[]) {
    const list = contactsByCustomer.get(row.customer_id) ?? [];
    list.push(row);
    contactsByCustomer.set(row.customer_id, list);
  }

  const actionableItems: RenewalWatchlistItem[] = typedSubscriptions
    .map((subscription) => {
      const daysUntilExpiry = getDaysUntilExpiry(subscription.expiry_date);
      if (daysUntilExpiry > daysThreshold) {
        return null;
      }

      const customer = customerMap.get(subscription.customer_id) ?? null;
      const service = serviceTypeMap.get(subscription.service_type_id) ?? null;
      const premiumAccount = premiumAccountMap.get(subscription.premium_account_id) ?? null;
      const premiumAccountUser = subscription.premium_account_user_id
        ? premiumAccountUserMap.get(subscription.premium_account_user_id) ?? null
        : null;
      const contact = resolvePreferredContact(
        customer,
        contactsByCustomer.get(subscription.customer_id) ?? [],
      );
      const nick = premiumAccountUser?.user_email ?? premiumAccount?.primary_email ?? "N/A";
      const accountEmail = premiumAccount?.primary_email ?? "N/A";
      const customerName = customer?.full_name ?? "Khách chưa định danh";
      const serviceName = service?.name ?? "Dịch vụ premium";
      const expiryDateLabel = getExpiryDateLabel(subscription.expiry_date);

      return {
        subscriptionId: subscription.id,
        customerId: subscription.customer_id,
        customerName,
        serviceName,
        nick,
        accountEmail,
        expiryDate: subscription.expiry_date,
        expiryDateLabel,
        daysUntilExpiry,
        urgency: daysUntilExpiry <= 0 ? "expired" : "expiring",
        contactChannel: contact.channel,
        contactValue: contact.value,
        notificationMessage: buildNotificationMessage({
          customerName,
          nick,
          serviceName,
          expiryDateLabel,
          daysUntilExpiry,
        }),
      } satisfies RenewalWatchlistItem;
    })
    .filter((item): item is RenewalWatchlistItem => Boolean(item));

  const expired = actionableItems
    .filter((item) => item.daysUntilExpiry <= 0)
    .sort((left, right) => left.daysUntilExpiry - right.daysUntilExpiry);
  const expiringSoon = actionableItems
    .filter((item) => item.daysUntilExpiry > 0)
    .sort((left, right) => left.daysUntilExpiry - right.daysUntilExpiry);

  return {
    thresholdDays: daysThreshold,
    summary: {
      expiredCount: expired.length,
      expiringSoonCount: expiringSoon.length,
      totalActionable: expired.length + expiringSoon.length,
    },
    expired: expired.slice(0, limit),
    expiringSoon: expiringSoon.slice(0, limit),
  };
}

