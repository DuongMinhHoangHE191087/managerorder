import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createFlatSuccessResponse,
  withFlatAccountHandler,
} from "@/lib/api/flat-response";
import type { ShellSearchResult } from "@/shared/types/shell";

const SEARCH_LIMIT = 5;

type SearchCandidate = Omit<ShellSearchResult, "priority"> & {
  searchable: string[];
  createdAt?: string | null;
};

function toEpoch(value?: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function computePriority(query: string, candidate: SearchCandidate) {
  const normalizedQuery = query.trim().toLowerCase();
  const haystacks = candidate.searchable
    .map((entry) => entry.toLowerCase())
    .filter(Boolean);

  const prefixMatch = haystacks.some((entry) => entry.startsWith(normalizedQuery));
  const partialMatch = prefixMatch
    ? true
    : haystacks.some((entry) => entry.includes(normalizedQuery));

  if (!partialMatch) {
    return 0;
  }

  return prefixMatch ? 300 : 200;
}

function sortResults(query: string, candidates: SearchCandidate[]) {
  return candidates
    .map((candidate) => ({
      ...candidate,
      priority: computePriority(query, candidate),
      recency: toEpoch(candidate.createdAt),
    }))
    .filter((candidate) => candidate.priority > 0)
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }

      if (right.recency !== left.recency) {
        return right.recency - left.recency;
      }

      return left.title.localeCompare(right.title, "vi");
    })
    .slice(0, 16)
    .map(({ searchable: _searchable, createdAt: _createdAt, recency: _recency, ...result }) => result);
}

export const GET = withFlatAccountHandler(async (request, { accountId }) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return createFlatSuccessResponse<ShellSearchResult[]>([]);
  }

  const pattern = `%${query}%`;

  const [ordersResult, customersResult, sourceAccountsResult, premiumAccountsResult] =
    await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, order_code, product_name_snapshot, status, created_at")
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .or(`order_code.ilike.${pattern},product_name_snapshot.ilike.${pattern}`)
        .order("created_at", { ascending: false })
        .limit(SEARCH_LIMIT),
      supabaseAdmin
        .from("customers")
        .select("id, full_name, notes, created_at")
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .or(`full_name.ilike.${pattern},notes.ilike.${pattern}`)
        .order("created_at", { ascending: false })
        .limit(SEARCH_LIMIT),
      supabaseAdmin
        .from("source_accounts")
        .select("id, email, provider, expires_at, created_at")
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .ilike("email", pattern)
        .order("created_at", { ascending: false })
        .limit(SEARCH_LIMIT),
      supabaseAdmin
        .from("premium_accounts")
        .select("id, primary_email, status, subscription_expiry_date, created_at")
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .ilike("primary_email", pattern)
        .order("created_at", { ascending: false })
        .limit(SEARCH_LIMIT),
    ]);

  if (ordersResult.error) {
    throw ordersResult.error;
  }
  if (customersResult.error) {
    throw customersResult.error;
  }
  if (sourceAccountsResult.error) {
    throw sourceAccountsResult.error;
  }
  if (premiumAccountsResult.error) {
    throw premiumAccountsResult.error;
  }

  const candidates: SearchCandidate[] = [
    ...(ordersResult.data ?? []).map((order) => ({
      id: order.id,
      kind: "order" as const,
      title: order.order_code ?? order.product_name_snapshot ?? "Đơn hàng",
      subtitle: order.product_name_snapshot ?? undefined,
      href: `/orders/${order.id}`,
      meta: order.status,
      searchable: [order.order_code ?? "", order.product_name_snapshot ?? ""],
      createdAt: order.created_at,
    })),
    ...(customersResult.data ?? []).map((customer) => ({
      id: customer.id,
      kind: "customer" as const,
      title: customer.full_name,
      subtitle: customer.notes ?? undefined,
      href: `/customers/${customer.id}`,
      searchable: [customer.full_name, customer.notes ?? ""],
      createdAt: customer.created_at,
    })),
    ...(sourceAccountsResult.data ?? []).map((account) => ({
      id: account.id,
      kind: "source_account" as const,
      title: account.email,
      subtitle: account.provider ?? undefined,
      href: `/inventory/source-accounts/${account.id}`,
      meta: account.expires_at ? `HSD ${account.expires_at.slice(0, 10)}` : undefined,
      searchable: [account.email, account.provider ?? ""],
      createdAt: account.created_at,
    })),
    ...(premiumAccountsResult.data ?? []).map((account) => ({
      id: account.id,
      kind: "premium_account" as const,
      title: account.primary_email,
      subtitle: account.status,
      href: `/premium/accounts?focus=${account.id}`,
      meta: account.subscription_expiry_date
        ? `HSD ${account.subscription_expiry_date.slice(0, 10)}`
        : undefined,
      searchable: [account.primary_email, account.status],
      createdAt: account.created_at,
    })),
  ];

  return createFlatSuccessResponse(sortResults(query, candidates));
});
