import { supabaseAdmin } from "@/lib/supabase/admin";
import { cached, invalidate, TTL } from "@/lib/cache/db-cache";
import { derivePaymentState } from "@/lib/domain/financial";
import { filterRowsBySearchQuery, paginateRows } from "@/shared/lib/filtering/search";
import type {
  GetOrdersParams,
  OrderItemRow,
  OrderRow,
  OrderStats,
  OrderWithItems,
  TelegramOrderNickMatch,
  TelegramOrderSummary,
} from "./orders.repo";

export const LOCAL_ORDER_DATA_SOURCE = "local-fixture" as const;

const LOCAL_ORDER_FIXTURE_CACHE_PREFIX = "orders:fixture-mode:";
const DAY_MS = 24 * 60 * 60 * 1000;

type LocalCustomerContact = {
  id: string;
  channel: string;
  value: string;
  is_verified: boolean;
};

type LocalCustomer = {
  id: string;
  full_name: string;
  type: "retail" | "wholesale" | "agency";
  customer_contacts: LocalCustomerContact[];
};

type LocalProduct = {
  id: string;
  name: string;
  mode: "slot" | "key" | "hybrid";
};

type LocalPaymentSource = {
  id: string;
  name: string;
  icon: string | null;
};

type LocalSalesChannel = {
  id: string;
  name: string;
};

type LocalSourceAccount = {
  id: string;
  email: string;
  provider: string;
};

type LocalOrderItemTemplate = {
  id: string;
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  price_vnd: number;
  cost_price_vnd: number | null;
  subtotal_vnd: number;
  notes: string | null;
  assigned_source_account_id: string | null;
  customer_nick_used: string | null;
  created_at: string;
  license_keys?: { id: string; key_code: string }[] | null;
};

type LocalOrderTemplate = {
  id: string;
  order_code: string;
  customer_id: string;
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  unit_price_vnd: number | null;
  cost_price_vnd: number | null;
  total_cost_vnd: number;
  total_amount_vnd: number;
  total_paid: number;
  payment_method: string | null;
  payment_terms: "prepaid" | "credit" | "cod" | null;
  payment_source_id: string | null;
  sales_channel_id: string | null;
  status: OrderRow["status"];
  contact_snapshot: string | null;
  proof_image_urls: string[] | null;
  sales_note: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  invoice_snapshot: Record<string, unknown> | null;
  billing_details: Record<string, unknown> | null;
  items: LocalOrderItemTemplate[];
};

const LOCAL_CUSTOMERS: LocalCustomer[] = [
  {
    id: "cust-local-1",
    full_name: "Nguyen Minh Anh",
    type: "retail",
    customer_contacts: [
      { id: "cust-local-1-email", channel: "email", value: "minh.anh@local", is_verified: true },
      { id: "cust-local-1-telegram", channel: "telegram", value: "@minhanh", is_verified: true },
    ],
  },
  {
    id: "cust-local-2",
    full_name: "Tran Ha Linh",
    type: "wholesale",
    customer_contacts: [
      { id: "cust-local-2-email", channel: "email", value: "ha.linh@local", is_verified: true },
      { id: "cust-local-2-phone", channel: "phone", value: "0909009002", is_verified: false },
    ],
  },
  {
    id: "cust-local-3",
    full_name: "Pham Duc Long",
    type: "agency",
    customer_contacts: [
      { id: "cust-local-3-email", channel: "email", value: "duc.long@local", is_verified: true },
      { id: "cust-local-3-telegram", channel: "telegram", value: "@duclong", is_verified: false },
    ],
  },
  {
    id: "cust-local-4",
    full_name: "Le Bao Chau",
    type: "retail",
    customer_contacts: [
      { id: "cust-local-4-email", channel: "email", value: "bao.chau@local", is_verified: true },
    ],
  },
];

const LOCAL_PRODUCTS: LocalProduct[] = [
  { id: "prod-local-duolingo-family", name: "Duolingo Family", mode: "hybrid" },
  { id: "prod-local-netflix-standard", name: "Netflix Standard", mode: "slot" },
  { id: "prod-local-spotify-duo", name: "Spotify Duo", mode: "slot" },
  { id: "prod-local-youtube-premium", name: "YouTube Premium", mode: "key" },
  { id: "prod-local-family-bundle", name: "Family Bundle", mode: "hybrid" },
];

const LOCAL_PAYMENT_SOURCES: LocalPaymentSource[] = [
  { id: "pay-local-bank", name: "Bank transfer", icon: "bank" },
  { id: "pay-local-momo", name: "MoMo", icon: "wallet" },
];

const LOCAL_SALES_CHANNELS: LocalSalesChannel[] = [
  { id: "channel-local-zalo", name: "Zalo inbox" },
  { id: "channel-local-web", name: "Website checkout" },
  { id: "channel-local-direct", name: "Direct admin" },
];

const LOCAL_SOURCE_ACCOUNTS: LocalSourceAccount[] = [
  { id: "src-local-duolingo", email: "duolingo-main@local", provider: "Duolingo" },
  { id: "src-local-netflix", email: "netflix-team@local", provider: "Netflix" },
  { id: "src-local-spotify", email: "spotify-main@local", provider: "Spotify" },
  { id: "src-local-youtube", email: "youtube-backup@local", provider: "YouTube" },
];

const LOCAL_CUSTOMER_MAP = new Map(LOCAL_CUSTOMERS.map((customer) => [customer.id, customer] as const));
const LOCAL_PRODUCT_MAP = new Map(LOCAL_PRODUCTS.map((product) => [product.id, product] as const));
const LOCAL_PAYMENT_SOURCE_MAP = new Map(LOCAL_PAYMENT_SOURCES.map((source) => [source.id, source] as const));
const LOCAL_SALES_CHANNEL_MAP = new Map(LOCAL_SALES_CHANNELS.map((channel) => [channel.id, channel] as const));
const LOCAL_SOURCE_ACCOUNT_MAP = new Map(LOCAL_SOURCE_ACCOUNTS.map((account) => [account.id, account] as const));

function offsetIso(days: number, hours = 0): string {
  return new Date(Date.now() + days * DAY_MS + hours * 60 * 60 * 1000).toISOString();
}

function cloneCustomer(customer: LocalCustomer): OrderWithItems["customer"] {
  return {
    id: customer.id,
    full_name: customer.full_name,
    type: customer.type,
    customer_contacts: customer.customer_contacts.map((contact) => ({ ...contact })),
  };
}

function cloneProduct(product: LocalProduct | null): OrderWithItems["product"] {
  if (!product) return null;
  return { ...product };
}

function clonePaymentSource(source: LocalPaymentSource | null): OrderWithItems["payment_source"] {
  if (!source) return null;
  return { ...source };
}

function cloneSalesChannel(channel: LocalSalesChannel | null): OrderWithItems["sales_channel"] {
  if (!channel) return null;
  return { ...channel };
}

const LOCAL_ORDER_TEMPLATES: LocalOrderTemplate[] = [
  {
    id: "order-local-1",
    order_code: "ORD-LOCAL-1001",
    customer_id: "cust-local-1",
    product_id: "prod-local-duolingo-family",
    product_name_snapshot: "Duolingo Family",
    quantity: 1,
    unit_price_vnd: 180000,
    cost_price_vnd: 120000,
    total_cost_vnd: 120000,
    total_amount_vnd: 180000,
    total_paid: 180000,
    payment_method: "bank_transfer",
    payment_terms: "prepaid",
    payment_source_id: "pay-local-bank",
    sales_channel_id: "channel-local-zalo",
    status: "paid",
    contact_snapshot: "Email minh.anh@local, Telegram @minhanh",
    proof_image_urls: [],
    sales_note: "Demo row used when the database is empty.",
    created_at: offsetIso(-4),
    updated_at: offsetIso(-2),
    expires_at: offsetIso(12),
    invoice_snapshot: { source: LOCAL_ORDER_DATA_SOURCE, note: "Seeded demo invoice" },
    billing_details: null,
    items: [
      {
        id: "order-local-1-item-1",
        product_id: "prod-local-duolingo-family",
        product_name_snapshot: "Duolingo Family",
        quantity: 1,
        price_vnd: 180000,
        cost_price_vnd: 120000,
        subtotal_vnd: 180000,
        notes: "Primary family invite",
        assigned_source_account_id: "src-local-duolingo",
        customer_nick_used: "minhanh",
        created_at: offsetIso(-4, 1),
        license_keys: [{ id: "lk-local-1", key_code: "DUO-LOCAL-1" }],
      },
    ],
  },
  {
    id: "order-local-2",
    order_code: "ORD-LOCAL-1002",
    customer_id: "cust-local-2",
    product_id: "prod-local-netflix-standard",
    product_name_snapshot: "Netflix Standard",
    quantity: 1,
    unit_price_vnd: 250000,
    cost_price_vnd: 165000,
    total_cost_vnd: 165000,
    total_amount_vnd: 250000,
    total_paid: 50000,
    payment_method: "momo",
    payment_terms: "credit",
    payment_source_id: "pay-local-momo",
    sales_channel_id: "channel-local-web",
    status: "pending_payment",
    contact_snapshot: "Email ha.linh@local, Phone 0909009002",
    proof_image_urls: [],
    sales_note: "Partial payment for the demo workspace.",
    created_at: offsetIso(-8),
    updated_at: offsetIso(-1),
    expires_at: offsetIso(6),
    invoice_snapshot: { source: LOCAL_ORDER_DATA_SOURCE, note: "Awaiting payment" },
    billing_details: null,
    items: [
      {
        id: "order-local-2-item-1",
        product_id: "prod-local-netflix-standard",
        product_name_snapshot: "Netflix Standard",
        quantity: 1,
        price_vnd: 250000,
        cost_price_vnd: 165000,
        subtotal_vnd: 250000,
        notes: "Waiting for top up",
        assigned_source_account_id: "src-local-netflix",
        customer_nick_used: "halinh",
        created_at: offsetIso(-8, 1),
      },
    ],
  },
  {
    id: "order-local-3",
    order_code: "ORD-LOCAL-1003",
    customer_id: "cust-local-3",
    product_id: "prod-local-spotify-duo",
    product_name_snapshot: "Spotify Duo",
    quantity: 1,
    unit_price_vnd: 150000,
    cost_price_vnd: 90000,
    total_cost_vnd: 90000,
    total_amount_vnd: 150000,
    total_paid: 150000,
    payment_method: "bank_transfer",
    payment_terms: "prepaid",
    payment_source_id: "pay-local-bank",
    sales_channel_id: "channel-local-direct",
    status: "active",
    contact_snapshot: "Email duc.long@local, Telegram @duclong",
    proof_image_urls: [],
    sales_note: "Active order for operational smoke tests.",
    created_at: offsetIso(-12),
    updated_at: offsetIso(-3),
    expires_at: offsetIso(20),
    invoice_snapshot: { source: LOCAL_ORDER_DATA_SOURCE, note: "Active subscription" },
    billing_details: null,
    items: [
      {
        id: "order-local-3-item-1",
        product_id: "prod-local-spotify-duo",
        product_name_snapshot: "Spotify Duo",
        quantity: 1,
        price_vnd: 150000,
        cost_price_vnd: 90000,
        subtotal_vnd: 150000,
        notes: "Shared family slot",
        assigned_source_account_id: "src-local-spotify",
        customer_nick_used: "duclong",
        created_at: offsetIso(-12, 1),
      },
    ],
  },
  {
    id: "order-local-4",
    order_code: "ORD-LOCAL-1004",
    customer_id: "cust-local-4",
    product_id: "prod-local-youtube-premium",
    product_name_snapshot: "YouTube Premium",
    quantity: 1,
    unit_price_vnd: 399000,
    cost_price_vnd: 250000,
    total_cost_vnd: 250000,
    total_amount_vnd: 399000,
    total_paid: 0,
    payment_method: "cash",
    payment_terms: "cod",
    payment_source_id: "pay-local-bank",
    sales_channel_id: "channel-local-web",
    status: "expired",
    contact_snapshot: "Email bao.chau@local",
    proof_image_urls: [],
    sales_note: "Expired demo order to surface overdue states.",
    created_at: offsetIso(-20),
    updated_at: offsetIso(-2),
    expires_at: offsetIso(-2),
    invoice_snapshot: { source: LOCAL_ORDER_DATA_SOURCE, note: "Expired sample" },
    billing_details: null,
    items: [
      {
        id: "order-local-4-item-1",
        product_id: "prod-local-youtube-premium",
        product_name_snapshot: "YouTube Premium",
        quantity: 1,
        price_vnd: 399000,
        cost_price_vnd: 250000,
        subtotal_vnd: 399000,
        notes: "Expired by design",
        assigned_source_account_id: "src-local-youtube",
        customer_nick_used: "baochau",
        created_at: offsetIso(-20, 1),
      },
    ],
  },
  {
    id: "order-local-5",
    order_code: "ORD-LOCAL-1005",
    customer_id: "cust-local-1",
    product_id: "prod-local-family-bundle",
    product_name_snapshot: "Family Bundle",
    quantity: 2,
    unit_price_vnd: null,
    cost_price_vnd: null,
    total_cost_vnd: 250000,
    total_amount_vnd: 430000,
    total_paid: 200000,
    payment_method: "bank_transfer",
    payment_terms: "credit",
    payment_source_id: "pay-local-bank",
    sales_channel_id: "channel-local-zalo",
    status: "provisioning",
    contact_snapshot: "Bundle order with multiple line items",
    proof_image_urls: [],
    sales_note: "Multi-item bundle for detail and invoice smoke tests.",
    created_at: offsetIso(-1),
    updated_at: offsetIso(-1),
    expires_at: offsetIso(9),
    invoice_snapshot: { source: LOCAL_ORDER_DATA_SOURCE, note: "Bundle demo" },
    billing_details: null,
    items: [
      {
        id: "order-local-5-item-1",
        product_id: "prod-local-duolingo-family",
        product_name_snapshot: "Duolingo Family",
        quantity: 1,
        price_vnd: 180000,
        cost_price_vnd: 120000,
        subtotal_vnd: 180000,
        notes: "Family invite link",
        assigned_source_account_id: "src-local-duolingo",
        customer_nick_used: "bundle-minh",
        created_at: offsetIso(-1, 1),
        license_keys: [{ id: "lk-local-5a", key_code: "DUO-BUNDLE-1" }],
      },
      {
        id: "order-local-5-item-2",
        product_id: "prod-local-netflix-standard",
        product_name_snapshot: "Netflix Standard",
        quantity: 1,
        price_vnd: 250000,
        cost_price_vnd: 130000,
        subtotal_vnd: 250000,
        notes: "Secondary slot",
        assigned_source_account_id: "src-local-netflix",
        customer_nick_used: "bundle-netflix",
        created_at: offsetIso(-1, 2),
      },
    ],
  },
];

function sortByCreatedAtDesc<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
}

function buildLocalOrders(accountId: string): OrderWithItems[] {
  return sortByCreatedAtDesc(
    LOCAL_ORDER_TEMPLATES.map((template) => {
      const customer = LOCAL_CUSTOMER_MAP.get(template.customer_id);
      const product = LOCAL_PRODUCT_MAP.get(template.product_id) ?? null;
      const paymentSource = template.payment_source_id ? LOCAL_PAYMENT_SOURCE_MAP.get(template.payment_source_id) ?? null : null;
      const salesChannel = template.sales_channel_id ? LOCAL_SALES_CHANNEL_MAP.get(template.sales_channel_id) ?? null : null;

      const items = template.items.map((item) => {
        const sourceAccount = item.assigned_source_account_id
          ? LOCAL_SOURCE_ACCOUNT_MAP.get(item.assigned_source_account_id) ?? null
          : null;

        return {
          id: item.id,
          order_id: template.id,
          product_id: item.product_id,
          product_name_snapshot: item.product_name_snapshot,
          quantity: item.quantity,
          price_vnd: item.price_vnd,
          cost_price_vnd: item.cost_price_vnd,
          subtotal_vnd: item.subtotal_vnd,
          notes: item.notes,
          assigned_source_account_id: item.assigned_source_account_id,
          customer_nick_used: item.customer_nick_used,
          created_at: item.created_at,
          assigned_source_account: sourceAccount ? { ...sourceAccount } : null,
          license_keys: item.license_keys ? item.license_keys.map((key) => ({ ...key })) : null,
        } as OrderItemRow & {
          assigned_source_account?: { id: string; email: string; provider: string } | null;
          license_keys?: { id: string; key_code: string }[] | null;
        };
      });

      return {
        id: template.id,
        account_id: accountId,
        order_code: template.order_code,
        customer_id: template.customer_id,
        product_id: template.product_id,
        quantity: template.quantity,
        unit_price_vnd: template.unit_price_vnd,
        product_name_snapshot: template.product_name_snapshot,
        cost_price_vnd: template.cost_price_vnd,
        total_cost_vnd: template.total_cost_vnd,
        total_amount_vnd: template.total_amount_vnd,
        total_paid: template.total_paid,
        payment_method: template.payment_method,
        payment_terms: template.payment_terms,
        payment_source_id: template.payment_source_id,
        sales_channel_id: template.sales_channel_id,
        status: template.status,
        contact_snapshot: template.contact_snapshot,
        proof_image_urls: template.proof_image_urls,
        sales_note: template.sales_note,
        deleted_at: null,
        created_at: template.created_at,
        updated_at: template.updated_at,
        expires_at: template.expires_at,
        invoice_snapshot: template.invoice_snapshot,
        billing_details: template.billing_details,
        customer: customer ? cloneCustomer(customer) : null,
        product: cloneProduct(product),
        sales_channel: cloneSalesChannel(salesChannel),
        payment_source: clonePaymentSource(paymentSource),
        items,
      };
    }),
  );
}

function adjustEndDate(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function isWithinRange(value: string | null | undefined, start?: string, end?: string): boolean {
  if (!value) return false;
  const valueTs = new Date(value).getTime();
  if (Number.isNaN(valueTs)) return false;
  if (start) {
    const startTs = new Date(start).getTime();
    if (!Number.isNaN(startTs) && valueTs < startTs) {
      return false;
    }
  }
  if (end) {
    const endTs = new Date(end).getTime();
    if (!Number.isNaN(endTs) && valueTs >= endTs) {
      return false;
    }
  }
  return true;
}

function matchesPaymentState(
  row: Pick<OrderRow, "total_amount_vnd" | "total_paid">,
  paymentState?: string,
) {
  if (!paymentState) return true;
  return derivePaymentState(row.total_amount_vnd, row.total_paid) === paymentState;
}

function filterLocalOrders(accountId: string, params: Omit<GetOrdersParams, "page" | "limit"> = {}) {
  const rows = buildLocalOrders(accountId).filter((row) => {
    if (params.customerId && row.customer_id !== params.customerId) {
      return false;
    }
    if (params.status && row.status !== params.status) {
      return false;
    }
    if (!isWithinRange(row.created_at, params.date_from, params.date_to ? adjustEndDate(params.date_to) : undefined)) {
      return false;
    }
    return true;
  });

  const searchFiltered = filterRowsBySearchQuery(rows, params.search ?? "", (row) => [
    row.id,
    row.order_code,
    row.product_name_snapshot,
    row.status,
    row.payment_method,
    row.payment_terms,
    row.customer?.full_name,
    row.customer?.customer_contacts,
    row.product?.name,
    row.sales_channel?.name,
    row.payment_source?.name,
    row.items,
  ]);

  return searchFiltered.filter((row) => matchesPaymentState(row, params.paymentState));
}

function toTelegramSummary(order: OrderWithItems): TelegramOrderSummary {
  return {
    id: order.id,
    order_code: order.order_code,
    status: order.status,
    total_amount_vnd: order.total_amount_vnd,
    total_paid: order.total_paid,
    product_name_snapshot: order.product_name_snapshot,
    created_at: order.created_at,
    expires_at: order.expires_at,
    customer: order.customer
      ? {
          id: order.customer.id,
          full_name: order.customer.full_name,
        }
      : null,
  };
}

function toTelegramNickMatch(order: OrderWithItems, item: OrderItemRow): TelegramOrderNickMatch {
  return {
    customer_nick_used: item.customer_nick_used,
    product_name_snapshot: item.product_name_snapshot,
    order: {
      order_code: order.order_code,
      status: order.status,
      customer: order.customer
        ? {
            full_name: order.customer.full_name,
          }
        : null,
    },
  };
}

export function shouldPreferLocalOrderFixtures(): boolean {
  if (process.env.CODEX_DISABLE_LOCAL_FALLBACK === "1") {
    return false;
  }

  return process.env.CODEX_USE_LOCAL_FALLBACK === "1";
}

async function getLiveOrderCount(accountId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .is("deleted_at", null);

  if (error) {
    return 0;
  }

  return Number(count ?? 0);
}

export async function isLocalOrderFixtureAccount(accountId: string): Promise<boolean> {
  if (!shouldPreferLocalOrderFixtures()) {
    return false;
  }

  return cached(
    `${LOCAL_ORDER_FIXTURE_CACHE_PREFIX}${accountId}`,
    async () => (await getLiveOrderCount(accountId)) === 0,
    TTL.LIST,
  );
}

export function invalidateOrderFixtureState(accountId: string): void {
  invalidate(`${LOCAL_ORDER_FIXTURE_CACHE_PREFIX}${accountId}`);
}

export function buildLocalOrderRows(accountId: string): OrderWithItems[] {
  return buildLocalOrders(accountId);
}

export function buildLocalOrdersPaginated(accountId: string, params: GetOrdersParams) {
  const page = params.page || 1;
  const limit = params.limit || 10;
  const rows = filterLocalOrders(accountId, params);
  return {
    data: paginateRows(rows, page, limit).data,
    count: rows.length,
    page,
    limit,
    totalPages: rows.length ? Math.ceil(rows.length / limit) : 0,
    source: LOCAL_ORDER_DATA_SOURCE,
  };
}

export function buildLocalOrderStats(
  accountId: string,
  params: Omit<GetOrdersParams, "page" | "limit"> = {},
): OrderStats {
  const rows = filterLocalOrders(accountId, params);

  let totalRevenue = 0;
  let totalCost = 0;
  let totalPaid = 0;
  let pendingCount = 0;
  let activeCount = 0;
  let paidCount = 0;
  let expiredCount = 0;

  for (const row of rows) {
    totalRevenue += Number(row.total_amount_vnd) || 0;
    totalCost += Number(row.total_cost_vnd) || 0;
    totalPaid += Number(row.total_paid) || 0;
    if (row.status === "pending_payment") pendingCount += 1;
    if (row.status === "active") activeCount += 1;
    if (row.status === "paid") paidCount += 1;
    if (row.status === "expired") expiredCount += 1;
  }

  return {
    total_orders: rows.length,
    total_revenue: totalRevenue,
    total_cost: totalCost,
    total_profit: totalRevenue - totalCost,
    total_paid_amount: totalPaid,
    total_debt: totalRevenue - totalPaid,
    pending_count: pendingCount,
    active_count: activeCount,
    paid_count: paidCount,
    expired_count: expiredCount,
  };
}

export function buildLocalOrderExportRows(
  accountId: string,
  params: Omit<GetOrdersParams, "page" | "limit"> = {},
): OrderRow[] {
  return filterLocalOrders(accountId, params) as OrderRow[];
}

export function buildLocalOrderWithItems(accountId: string, id: string): OrderWithItems | null {
  return buildLocalOrders(accountId).find((row) => row.id === id) ?? null;
}

export function buildLocalOrderWithItemsByCode(accountId: string, orderCode: string): OrderWithItems | null {
  const normalized = orderCode.trim().toUpperCase();
  if (!normalized) return null;
  return buildLocalOrders(accountId).find((row) => row.order_code?.toUpperCase() === normalized) ?? null;
}

export function buildLocalOrderCandidatesByCode(
  accountId: string,
  orderCode: string,
  limit = 5,
): TelegramOrderSummary[] {
  const normalized = orderCode.trim().toUpperCase();
  if (!normalized) return [];

  return buildLocalOrders(accountId)
    .filter((row) => row.order_code?.toUpperCase().includes(normalized))
    .slice(0, limit)
    .map(toTelegramSummary);
}

export function buildLocalOrdersForTelegramSearch(
  accountId: string,
  query: string,
  limit = 5,
): TelegramOrderSummary[] {
  const keyword = query.trim();
  if (!keyword) return [];

  const rows = filterLocalOrders(accountId, {});
  const filtered = filterRowsBySearchQuery(rows, keyword, (row) => [
    row.order_code,
    row.product_name_snapshot,
    row.customer?.full_name,
    row.customer?.customer_contacts,
  ]);

  return filtered.slice(0, limit).map(toTelegramSummary);
}

export function buildLocalOrderNickMatches(
  accountId: string,
  query: string,
  limit = 5,
): TelegramOrderNickMatch[] {
  const keyword = query.trim();
  if (!keyword) return [];

  const rows = buildLocalOrders(accountId);
  const matches: TelegramOrderNickMatch[] = [];

  for (const order of rows) {
    for (const item of order.items) {
      if (item.customer_nick_used && item.customer_nick_used.toLowerCase().includes(keyword.toLowerCase())) {
        matches.push(toTelegramNickMatch(order, item));
      }
    }
  }

  return matches.slice(0, limit);
}

export function buildLocalRecentCustomerOrders(
  accountId: string,
  customerId: string,
  limit = 5,
): TelegramOrderSummary[] {
  return buildLocalOrders(accountId)
    .filter((order) => order.customer_id === customerId)
    .slice(0, limit)
    .map(toTelegramSummary);
}

export function buildLocalDebtOrders(accountId: string): TelegramOrderSummary[] {
  return buildLocalOrders(accountId)
    .filter((order) => !["draft", "refunded"].includes(order.status))
    .map(toTelegramSummary);
}
