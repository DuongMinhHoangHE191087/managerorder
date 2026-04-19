import {
  type ContactRow,
  getCustomerById,
  listCustomerContactRows,
  listCustomerOrderRows,
  searchCustomerContactsForTelegram,
  searchCustomersForTelegram,
} from '@/lib/supabase/repositories/customers.repo';
import {
  findOrderCandidatesByCode,
  getOrderWithItemsByCode,
  listDebtOrdersForTelegram,
  listRecentCustomerOrdersForTelegram,
  searchOrderNicksForTelegram,
  searchOrdersForTelegram,
  type TelegramOrderNickMatch,
  type TelegramOrderSummary,
} from '@/lib/supabase/repositories/orders.repo';
import {
  getProductById,
  listProductsForTelegram,
  searchProductsForTelegram,
  type TelegramProductSummary,
} from '@/lib/supabase/repositories/products.repo';
import { searchSourceAccountsByEmail } from '@/lib/supabase/repositories/source-accounts.repo';
import { getSourceAccountsByProduct } from '@/lib/supabase/repositories/source-accounts.repo';

const PAGE_SIZE = 10;
const DEBT_PAGE_SIZE = 10;

export interface TelegramSearchCustomerResult {
  id: string;
  full_name: string;
  type: string;
  nicks_registry?: string[];
  order_count: number;
  primary_contact: string | null;
  matched_contact: string | null;
}

export interface TelegramSearchResult {
  orders: TelegramOrderSummary[];
  customers: TelegramSearchCustomerResult[];
  nickMatches: TelegramOrderNickMatch[];
  warehouses: Array<{
    id: string;
    email: string;
    max_slots: number;
    used_slots: number;
    provider: string | null;
    expires_at: string | null;
  }>;
  products: TelegramProductSummary[];
}

export interface TelegramOrderDetailItem {
  id: string;
  customer_nick_used: string | null;
  product_name_snapshot: string | null;
  status: string | null;
  source_account_email: string | null;
}

export interface TelegramOrderDetail {
  id: string;
  order_code: string | null;
  status: string | null;
  total_amount_vnd: number | null;
  total_paid: number | null;
  outstanding_amount_vnd: number;
  created_at: string | null;
  expires_at: string | null;
  notes: string | null;
  customer: {
    id: string | null;
    full_name: string | null;
    type: string | null;
    contacts: ContactRow[];
  } | null;
  product_labels: string[];
  items: TelegramOrderDetailItem[];
}

export type TelegramOrderDetailResult =
  | { kind: 'exact'; order: TelegramOrderDetail }
  | { kind: 'candidates'; candidates: TelegramOrderSummary[] }
  | { kind: 'missing' };

export interface TelegramCustomerDetail {
  id: string;
  full_name: string;
  type: string;
  debt_amount_vnd: number;
  notes: string | null;
  created_at: string;
  contacts: ContactRow[];
  recent_orders: TelegramOrderSummary[];
}

export interface TelegramDebtCustomer {
  customer_id: string;
  customer_name: string;
  total_debt_vnd: number;
  order_count: number;
  order_codes: string[];
}

export interface TelegramDebtPage {
  items: TelegramDebtCustomer[];
  total: number;
  total_pages: number;
  page: number;
  grand_total_vnd: number;
}

export interface TelegramProductPage {
  items: TelegramProductSummary[];
  total: number;
  total_pages: number;
  page: number;
}

function buildPhoneVariants(input: string): string[] {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 9) return [];

  const variants = new Set<string>([digits]);
  if (digits.startsWith('84')) variants.add(`0${digits.slice(2)}`);
  if (digits.startsWith('0')) variants.add(`84${digits.slice(1)}`);
  return Array.from(variants).slice(0, 3);
}

function mergeCustomerContacts(
  contacts: ContactRow[],
  customerId: string
): string | null {
  const contact = contacts.find((row) => row.customer_id === customerId);
  return contact ? `${contact.channel}: ${contact.value}` : null;
}

function toTelegramOrderDetail(order: Awaited<ReturnType<typeof getOrderWithItemsByCode>>): TelegramOrderDetail {
  if (!order) {
    throw new Error('Order detail is required');
  }

  const contacts = (order.customer?.customer_contacts ?? []).map((contact) => ({
    id: contact.id,
    customer_id: order.customer?.id ?? '',
    channel: contact.channel,
    value: contact.value,
    is_verified: contact.is_verified,
    created_at: '',
  }));
  const productLabels = Array.from(
    new Set(
      order.items
        .map((item) => item.product_name_snapshot ?? order.product?.name ?? order.product_name_snapshot ?? null)
        .filter((label): label is string => !!label)
    )
  );

  return {
    id: order.id,
    order_code: order.order_code,
    status: order.status,
    total_amount_vnd: order.total_amount_vnd,
    total_paid: order.total_paid,
    outstanding_amount_vnd: Math.max(0, (order.total_amount_vnd ?? 0) - (order.total_paid ?? 0)),
    created_at: order.created_at,
    expires_at: order.expires_at,
    notes: (order as { notes?: string | null; sales_note?: string | null }).notes
      ?? (order as { sales_note?: string | null }).sales_note
      ?? null,
    customer: order.customer
      ? {
          id: order.customer.id,
          full_name: order.customer.full_name,
          type: order.customer.type ?? null,
          contacts,
        }
      : null,
    product_labels: productLabels,
    items: order.items.map((item) => ({
      id: item.id,
      customer_nick_used: item.customer_nick_used,
      product_name_snapshot: item.product_name_snapshot,
      status: (item as { status?: string | null }).status ?? null,
      source_account_email: item.assigned_source_account?.email ?? null,
    })),
  };
}

export async function searchTelegramEntities(
  query: string,
  accountId: string
): Promise<TelegramSearchResult> {
  const keyword = query.trim();
  const phoneVariants = buildPhoneVariants(keyword);

  const [orders, customersByText, contacts, nickMatches, warehouses, products] = await Promise.all([
    searchOrdersForTelegram(keyword, accountId),
    searchCustomersForTelegram(keyword, accountId),
    Promise.all([
      searchCustomerContactsForTelegram(keyword, accountId),
      ...phoneVariants.map((variant) => searchCustomerContactsForTelegram(variant, accountId)),
    ]),
    searchOrderNicksForTelegram(keyword, accountId),
    searchSourceAccountsByEmail(keyword, accountId),
    searchProductsForTelegram(keyword, accountId),
  ]);

  const contactMatches = contacts.flat();
  const customerMap = new Map<string, TelegramSearchCustomerResult>();

  for (const customer of customersByText) {
    customerMap.set(customer.id, {
      id: customer.id,
      full_name: customer.full_name,
      type: customer.type,
      nicks_registry: Array.isArray(customer.nicks_registry)
        ? customer.nicks_registry
            .map((entry) => (typeof entry?.nick === 'string' ? entry.nick : null))
            .filter((entry): entry is string => !!entry)
        : [],
      order_count: 0,
      primary_contact: null,
      matched_contact: null,
    });
  }

  for (const match of contactMatches) {
    if (!match.customer) continue;
    const current = customerMap.get(match.customer.id) ?? {
      id: match.customer.id,
      full_name: match.customer.full_name,
      type: match.customer.type,
      nicks_registry: [],
      order_count: 0,
      primary_contact: null,
      matched_contact: `${match.channel}: ${match.value}`,
    };

    current.matched_contact ??= `${match.channel}: ${match.value}`;
    customerMap.set(match.customer.id, current);
  }

  const customerIds = [...customerMap.keys()];
  const [orderRows, contactRows] = await Promise.all([
    listCustomerOrderRows(accountId, customerIds),
    listCustomerContactRows(customerIds),
  ]);

  const orderCountMap = new Map<string, number>();
  for (const row of orderRows) {
    orderCountMap.set(row.customer_id, (orderCountMap.get(row.customer_id) ?? 0) + 1);
  }

  const customers = [...customerMap.values()]
    .map((customer) => ({
      ...customer,
      order_count: orderCountMap.get(customer.id) ?? 0,
      primary_contact: customer.matched_contact ?? mergeCustomerContacts(contactRows, customer.id),
    }))
    .slice(0, 8);

  return {
    orders,
    customers,
    nickMatches,
    warehouses,
    products,
  };
}

export async function getTelegramOrderDetail(
  orderCode: string,
  accountId: string
): Promise<TelegramOrderDetailResult> {
  const normalizedCode = orderCode.trim().toUpperCase();
  if (!normalizedCode) return { kind: 'missing' };

  const exact = await getOrderWithItemsByCode(normalizedCode, accountId);
  if (exact) {
    return { kind: 'exact', order: toTelegramOrderDetail(exact) };
  }

  const candidates = await findOrderCandidatesByCode(normalizedCode, accountId);
  if (candidates.length) {
    return { kind: 'candidates', candidates };
  }

  return { kind: 'missing' };
}

export async function getTelegramCustomerDetail(
  customerId: string,
  accountId: string
): Promise<TelegramCustomerDetail | null> {
  const [customer, recentOrders] = await Promise.all([
    getCustomerById(customerId, accountId),
    listRecentCustomerOrdersForTelegram(customerId, accountId, 5),
  ]);

  if (!customer) return null;

  return {
    id: customer.id,
    full_name: customer.full_name,
    type: customer.type,
    debt_amount_vnd: (customer as { debt_amount_vnd?: number | null }).debt_amount_vnd ?? 0,
    notes: (customer as { notes?: string | null }).notes ?? null,
    created_at: customer.created_at,
    contacts: customer.contacts ?? [],
    recent_orders: recentOrders,
  };
}

export async function getTelegramCustomerOrders(
  customerId: string,
  accountId: string
): Promise<TelegramOrderSummary[]> {
  return listRecentCustomerOrdersForTelegram(customerId, accountId, 10);
}

export async function getTelegramDebtPage(
  accountId: string,
  page = 0
): Promise<TelegramDebtPage> {
  const orders = await listDebtOrdersForTelegram(accountId);
  const grouped = new Map<string, TelegramDebtCustomer>();

  for (const order of orders) {
    const outstanding = Math.max(0, (order.total_amount_vnd ?? 0) - (order.total_paid ?? 0));
    if (!outstanding) continue;

    const customerId = order.customer?.id ?? 'unknown';
    const bucket = grouped.get(customerId) ?? {
      customer_id: customerId,
      customer_name: order.customer?.full_name ?? 'N/A',
      total_debt_vnd: 0,
      order_count: 0,
      order_codes: [],
    };

    bucket.total_debt_vnd += outstanding;
    bucket.order_count += 1;
    if (order.order_code) bucket.order_codes.push(order.order_code);
    grouped.set(customerId, bucket);
  }

  const items = [...grouped.values()].sort((left, right) => right.total_debt_vnd - left.total_debt_vnd);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / DEBT_PAGE_SIZE));
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));

  return {
    items: items.slice(currentPage * DEBT_PAGE_SIZE, (currentPage + 1) * DEBT_PAGE_SIZE),
    total,
    total_pages: totalPages,
    page: currentPage,
    grand_total_vnd: items.reduce((sum, item) => sum + item.total_debt_vnd, 0),
  };
}

export async function getTelegramProductPage(
  accountId: string,
  page = 0,
  search?: string
): Promise<TelegramProductPage> {
  const result = await listProductsForTelegram(accountId, page, PAGE_SIZE, search);
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  return {
    items: result.items,
    total: result.total,
    total_pages: totalPages,
    page: Math.max(0, Math.min(page, totalPages - 1)),
  };
}

export async function getTelegramProductDetail(productId: string, accountId: string) {
  const [product, sourceAccounts] = await Promise.all([
    getProductById(productId, accountId),
    getSourceAccountsByProduct(accountId, productId),
  ]);

  if (!product) return null;

  const activeAccounts = sourceAccounts.filter((item) => !item.expires_at || new Date(item.expires_at) > new Date());
  const availableAccounts = activeAccounts.filter((item) => item.used_slots < item.max_slots);
  const totalFreeSlots = availableAccounts.reduce((sum, item) => sum + (item.max_slots - item.used_slots), 0);

  return {
    product,
    source_accounts: sourceAccounts,
    active_accounts: activeAccounts,
    available_accounts: availableAccounts,
    total_free_slots: totalFreeSlots,
  };
}
