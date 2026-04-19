import { supabaseAdmin } from "../supabase/admin";
import type { Database } from "../supabase/database.types";
import type { ZaloDataService, ZaloOrderRecord, ZaloProductRecord } from "./types";

type ProductRow = Database["public"]["Tables"]["products"]["Row"] & { deleted_at?: string | null };
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"] & { deleted_at?: string | null };
type ContactRow = Database["public"]["Tables"]["customer_contacts"]["Row"];
type RelatedCustomer = { full_name?: string | null } | null;
type RawOrderRow = {
  id: string | number;
  order_code?: string | null;
  customer_id?: string | null;
  customer?: RelatedCustomer;
  customers?: RelatedCustomer;
  contact_snapshot?: string | null;
  product_name_snapshot?: string | null;
  quantity?: number | null;
  total_amount_vnd?: number | string | null;
  total_paid?: number | string | null;
  status?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
};

function escapeForIlike(value: string): string {
  return value.replace(/[(),]/g, " ").trim().replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function normalizeQuery(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function phoneVariants(raw: string): string[] {
  const digits = raw.replace(/\D/g, "");
  const variants = new Set<string>();

  if (digits.length >= 8) {
    variants.add(digits);
    if (digits.startsWith("84")) {
      variants.add(`0${digits.slice(2)}`);
    }
    if (digits.startsWith("0")) {
      variants.add(`84${digits.slice(1)}`);
    }
  }

  return Array.from(variants);
}

function mapProduct(row: ProductRow): ZaloProductRecord {
  return {
    id: row.id,
    name: row.name,
    mode: row.mode,
    durationType: row.duration_type,
    durationValue: row.duration_value,
    buyPriceVnd: row.buy_price_vnd,
    sellPriceVnd: row.sell_price_vnd,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function mapOrder(row: RawOrderRow): ZaloOrderRecord {
  const customer = row.customer ?? row.customers ?? null;
  return {
    id: String(row.id),
    orderCode: row.order_code ?? null,
    customerId: row.customer_id ?? null,
    customerName: customer?.full_name ?? null,
    contactSnapshot: row.contact_snapshot ?? null,
    productNameSnapshot: row.product_name_snapshot ?? null,
    quantity: row.quantity ?? null,
    totalAmountVnd: Number(row.total_amount_vnd ?? 0),
    totalPaid: Number(row.total_paid ?? 0),
    status: String(row.status ?? "draft"),
    expiresAt: row.expires_at ?? "",
    createdAt: row.created_at ?? "",
  };
}

async function listProducts(accountId: string, query?: string, limit = 5): Promise<ZaloProductRecord[]> {
  let builder = supabaseAdmin
    .from("products")
    .select("id, name, mode, duration_type, duration_value, buy_price_vnd, sell_price_vnd, is_active, created_at, deleted_at")
    .eq("account_id", accountId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  const normalized = query ? escapeForIlike(normalizeQuery(query)) : "";
  if (normalized) {
    builder = builder.ilike("name", `%${normalized}%`);
  }

  const { data, error } = await builder;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapProduct(row as ProductRow));
}

async function searchOrders(accountId: string, query: string, limit = 5): Promise<ZaloOrderRecord[]> {
  const normalized = escapeForIlike(normalizeQuery(query));
  if (!normalized) return [];

  const orderSelect = "id, order_code, customer_id, product_name_snapshot, quantity, total_amount_vnd, total_paid, status, expires_at, created_at, contact_snapshot, customer:customers!orders_customer_id_fkey(full_name)";
  const orderFilters = [
    `order_code.ilike.%${normalized}%`,
    `product_name_snapshot.ilike.%${normalized}%`,
    `contact_snapshot.ilike.%${normalized}%`,
  ].join(",");

  const orderQuery = supabaseAdmin
    .from("orders")
    .select(orderSelect)
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .or(orderFilters)
    .order("created_at", { ascending: false })
    .limit(limit);

  const customerNameQuery = supabaseAdmin
    .from("customers")
    .select("id, full_name, created_at")
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .ilike("full_name", `%${normalized}%`)
    .limit(limit);

  const contactQueries = phoneVariants(query).map((variant) =>
    supabaseAdmin
      .from("customer_contacts")
      .select("customer_id, value")
      .ilike("value", `%${variant}%`)
      .limit(limit * 2),
  );

  const [ordersResult, customerNameResult, ...contactResults] = await Promise.all([
    orderQuery,
    customerNameQuery,
    ...contactQueries,
  ]);

  const orderedResults: ZaloOrderRecord[] = [];
  const seenOrders = new Set<string>();

  const pushOrders = (rows?: RawOrderRow[] | null) => {
    for (const row of rows ?? []) {
      const mapped = mapOrder(row);
      if (seenOrders.has(mapped.id)) continue;
      seenOrders.add(mapped.id);
      orderedResults.push(mapped);
    }
  };

  if (ordersResult.error) {
    throw new Error(ordersResult.error.message);
  }
  pushOrders(ordersResult.data as RawOrderRow[] | null);

  if (customerNameResult.error) {
    throw new Error(customerNameResult.error.message);
  }

  const customerIds = new Set<string>();
  for (const row of customerNameResult.data ?? []) {
    const customer = row as CustomerRow;
    customerIds.add(customer.id);
  }

  for (const contactResult of contactResults) {
    if (contactResult.error) {
      throw new Error(contactResult.error.message);
    }
    for (const contact of contactResult.data ?? []) {
      const row = contact as ContactRow;
      if (row.customer_id) customerIds.add(row.customer_id);
    }
  }

  if (customerIds.size > 0) {
    const verifiedCustomers = await supabaseAdmin
      .from("customers")
      .select("id, full_name, created_at")
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .in("id", Array.from(customerIds))
      .limit(limit);

    if (verifiedCustomers.error) {
      throw new Error(verifiedCustomers.error.message);
    }

    const verifiedIds = new Set((verifiedCustomers.data ?? []).map((row) => String((row as CustomerRow).id)));
    const customerOrders = await supabaseAdmin
      .from("orders")
      .select(orderSelect)
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .in("customer_id", Array.from(verifiedIds))
      .order("created_at", { ascending: false })
      .limit(limit);

    if (customerOrders.error) {
      throw new Error(customerOrders.error.message);
    }

    pushOrders(customerOrders.data as RawOrderRow[] | null);
  }

  return orderedResults
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);
}

export const zaloDataService: ZaloDataService = {
  listProducts,
  searchOrders,
};
