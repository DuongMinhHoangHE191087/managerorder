import type { Customer } from "@/lib/domain/types";
import {
  createCustomer as createCustomerRepo,
  deleteCustomer as deleteCustomerRepo,
  getCustomerById as getCustomerByIdRepo,
  getCustomerDependencies,
  listCustomers as listCustomersRepo,
  softDeleteCustomers as softDeleteCustomersRepo,
  updateCustomer as updateCustomerRepo,
  updateCustomersTier as updateCustomersTierRepo,
} from "../repository";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { assignTagsToCustomer, replaceCustomerTags } from "@/lib/supabase/repositories/customer-tags.repo";
import { mapToCustomer, mapTierToDbType } from "@/lib/supabase/mappers/customer-mapper";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import { parseCustomerXlsx, generateCustomerXlsx } from "@/lib/services/excel-service";
import { calculateRfm } from "@/lib/services/rfm-calculator";
import { isRelationCacheError, loadRowsByIds } from "@/lib/supabase/relation-fallback";
import type { CreateCustomerInput, UpdateCustomerInput } from "@/lib/domain/schemas";

type DbContactInput = {
  channel: string;
  value: string;
  is_verified?: boolean;
  is_primary?: boolean;
  facebook_id?: string;
  facebook_name?: string;
};

export interface CustomerDuplicateMatch {
  id: string;
  name: string;
  matchType: "name" | "contact" | "both";
  matchValue?: string;
  similarity: number;
}

export interface CustomerDebtSummary {
  totalDebtVnd: number;
  totalCustomers: number;
  customersWithDebt: number;
  overdueCustomers: number;
  avgReliabilityScore: number;
  aging: {
    current: number;
    days_1_30: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
  };
  topDebtors: Array<{
    id: string;
    name: string;
    debtAmountVnd: number;
    overdueDays: number;
    segment: string | null;
  }>;
  segmentBreakdown: Record<string, { count: number; totalDebt: number }>;
}

export interface CustomerImportResult {
  totalRows: number;
  validRowsCount: number;
  createdCount: number;
  skippedCount: number;
  insertErrors: Array<{ row: number; message: string }>;
  parseErrors: Array<{ row: number; message: string }>;
}

export interface CustomerStatsResult {
  customerId: string;
  totalOrders: number;
  totalSpentVnd: number;
  avgOrderValueVnd: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  ordersByStatus: Record<string, number>;
  totalPaymentsVnd: number;
  outstandingDebtVnd: number;
  segment: string | null;
  rfmScore: number | null;
  rfmRecency: number | null;
  rfmFrequency: number | null;
  rfmMonetary: number | null;
  lastRfmCalculatedAt: string | null;
  debtAmountVnd: number | null;
  debtOverdueDays: number | null;
  reliabilityScore: number | null;
}

function toDbContacts(contacts?: CreateCustomerInput["contacts"] | UpdateCustomerInput["contacts"]): DbContactInput[] | undefined {
  if (!contacts) return undefined;
  return contacts.map((contact) => ({
    channel: String(contact.type ?? "other"),
    value: String(contact.value ?? ""),
    is_verified: false,
    is_primary: Boolean(contact.isPrimary ?? false),
    facebook_id: contact.facebookId,
    facebook_name: contact.facebookName,
  }));
}

function chunkIds(ids: string[], size = 50): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

export async function listCustomersForAccount(accountId: string): Promise<Customer[]> {
  const rows = await listCustomersRepo(accountId);
  return rows.map((row) => mapToCustomer(row));
}

export async function getCustomerForAccount(id: string, accountId: string): Promise<Customer | null> {
  const row = await getCustomerByIdRepo(id, accountId);
  return row ? mapToCustomer(row) : null;
}

export async function createCustomerForAccount(
  accountId: string,
  input: CreateCustomerInput
): Promise<Customer> {
  const result = await createCustomerRepo(accountId, {
    full_name: input.name,
    type: mapTierToDbType(input.tier),
    contacts: toDbContacts(input.contacts),
  });

  if (input.tagIds && input.tagIds.length > 0) {
    await assignTagsToCustomer(result.id, input.tagIds);
    const updatedRow = await getCustomerByIdRepo(result.id, accountId);
    if (updatedRow) {
      Object.assign(result, updatedRow);
    }
  }

  const data = mapToCustomer(result as unknown as Record<string, unknown>);
  createActivityLog({
    account_id: accountId,
    action_type: "CUSTOMER_CREATED",
    customer_id: data.id,
    details: {
      name: data.name,
      tier: data.tier,
      contacts_count: data.contacts.length,
    },
  }).catch(() => {});

  return data;
}

export async function updateCustomerForAccount(
  id: string,
  accountId: string,
  input: UpdateCustomerInput
): Promise<Customer> {
  const customerType = input.customerType ?? (input.tier ? mapTierToDbType(input.tier) : undefined);

  let result = await updateCustomerRepo(id, accountId, {
    full_name: input.name,
    type: customerType as "retail" | "wholesale" | "agency" | undefined,
    contacts: toDbContacts(input.contacts),
    reliability_score: input.reliabilityScore,
    notes: input.notes,
  });

  if (input.tagIds) {
    await replaceCustomerTags(id, input.tagIds);
    const updatedRow = await getCustomerByIdRepo(id, accountId);
    if (updatedRow) {
      result = { ...result, ...updatedRow };
    }
  }

  return mapToCustomer(result as unknown as Record<string, unknown>);
}

export async function deleteCustomerForAccount(id: string, accountId: string): Promise<void> {
  await deleteCustomerRepo(id, accountId);
}

export async function checkCustomerDependenciesForAccount(
  customerIds: string[],
  accountId: string
): Promise<{ customersWithOrders: number; totalOrders: number }> {
  let customersWithOrders = 0;
  let totalOrders = 0;

  for (const chunk of chunkIds(customerIds, 50)) {
    const deps = await getCustomerDependencies(chunk, accountId);
    customersWithOrders += deps.customersWithOrders;
    totalOrders += deps.totalOrders;
  }

  return { customersWithOrders, totalOrders };
}

export async function deleteCustomersForAccount(
  customerIds: string[],
  accountId: string
): Promise<number> {
  let totalDeleted = 0;
  for (const chunk of chunkIds(customerIds, 50)) {
    totalDeleted += await softDeleteCustomersRepo(chunk, accountId);
  }
  return totalDeleted;
}

export async function updateCustomersTierForAccount(
  customerIds: string[],
  accountId: string,
  input: { tier?: "regular" | "vip" | "agency"; customerType?: "retail" | "wholesale" | "agency" }
): Promise<number> {
  const dbType = input.customerType ?? (input.tier ? mapTierToDbType(input.tier) : undefined);
  if (!dbType) {
    throw new Error("Thiếu thông tin phân loại trong data");
  }
  return updateCustomersTierRepo(customerIds, accountId, dbType);
}

export async function exportCustomersWorkbookForAccount(accountId: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error && !isRelationCacheError(error)) {
    throw new Error(error.message);
  }

  const customerRows = error ? await listCustomersRepo(accountId) : (data ?? []);
  const customers = customerRows.map((row) => mapToCustomer(row));
  const buffer = await generateCustomerXlsx(customers);
  return {
    buffer,
    filename: `customers_${new Date().toISOString().split("T")[0]}.xlsx`,
  };
}

export async function importCustomersWorkbookForAccount(
  accountId: string,
  buffer: Buffer
): Promise<CustomerImportResult> {
  const { validRows, errors, totalRows } = await parseCustomerXlsx(buffer);
  const insertErrors: Array<{ row: number; message: string }> = [];
  let createdCount = 0;

  for (let index = 0; index < validRows.length; index++) {
    const row = validRows[index];
    const { error: insertError } = await supabase
      .from("customers")
      .insert({
        account_id: accountId,
        full_name: row.fullName,
        type: row.customerType,
        segment: row.segment ?? null,
        notes: row.notes ?? null,
        debt_amount_vnd: row.debtAmountVnd ?? 0,
        debt_overdue_days: row.debtOverdueDays ?? 0,
        reliability_score: row.reliabilityScore ?? 100,
      });

    if (insertError) {
      insertErrors.push({
        row: index + 2,
        message: insertError.message,
      });
      continue;
    }

    createdCount++;
  }

  return {
    totalRows,
    validRowsCount: validRows.length,
    createdCount,
    skippedCount: totalRows - validRows.length,
    insertErrors,
    parseErrors: errors,
  };
}

export async function getCustomerDebtSummaryForAccount(accountId: string): Promise<CustomerDebtSummary> {
  const { data: customers, error } = await supabase
    .from("customers")
    .select(
      "id, full_name, debt_amount_vnd, debt_overdue_days, reliability_score, segment, type"
    )
    .eq("account_id", accountId)
    .is("deleted_at", null);

  if (error) {
    throw new Error("Failed to fetch customers");
  }

  const allCustomers = customers ?? [];
  const totalDebtVnd = allCustomers.reduce(
    (sum, customer) => sum + Number(customer.debt_amount_vnd ?? 0),
    0
  );
  const customersWithDebt = allCustomers.filter(
    (customer) => Number(customer.debt_amount_vnd ?? 0) > 0
  );
  const overdueCustomers = allCustomers.filter(
    (customer) => Number(customer.debt_overdue_days ?? 0) > 0
  );

  const aging = {
    current: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_90_plus: 0,
  };

  for (const customer of customersWithDebt) {
    const days = Number(customer.debt_overdue_days ?? 0);
    const amount = Number(customer.debt_amount_vnd ?? 0);
    if (days === 0) aging.current += amount;
    else if (days <= 30) aging.days_1_30 += amount;
    else if (days <= 60) aging.days_31_60 += amount;
    else if (days <= 90) aging.days_61_90 += amount;
    else aging.days_90_plus += amount;
  }

  const topDebtors = customersWithDebt
    .sort((left, right) => Number(right.debt_amount_vnd ?? 0) - Number(left.debt_amount_vnd ?? 0))
    .slice(0, 10)
    .map((customer) => ({
      id: customer.id,
      name: customer.full_name,
      debtAmountVnd: Number(customer.debt_amount_vnd ?? 0),
      overdueDays: Number(customer.debt_overdue_days ?? 0),
      segment: customer.segment ?? null,
    }));

  const segmentBreakdown: Record<string, { count: number; totalDebt: number }> = {};
  for (const customer of allCustomers) {
    const segment = customer.segment ?? "regular";
    if (!segmentBreakdown[segment]) {
      segmentBreakdown[segment] = { count: 0, totalDebt: 0 };
    }
    segmentBreakdown[segment].count++;
    segmentBreakdown[segment].totalDebt += Number(customer.debt_amount_vnd ?? 0);
  }

  return {
    totalDebtVnd,
    totalCustomers: allCustomers.length,
    customersWithDebt: customersWithDebt.length,
    overdueCustomers: overdueCustomers.length,
    avgReliabilityScore:
      allCustomers.length > 0
        ? Math.round(
            allCustomers.reduce(
              (sum, customer) => sum + Number(customer.reliability_score ?? 100),
              0
            ) / allCustomers.length
          )
        : 100,
    aging,
    topDebtors,
    segmentBreakdown,
  };
}

export async function recalculateCustomersRfmForAccount(accountId: string): Promise<{
  success: true;
  updatedCount: number;
  totalCustomers: number;
  calculatedAt: string;
}> {
  const { data: customerOrders, error: aggError } = await supabase
    .from("orders")
    .select("customer_id, total_amount_vnd, created_at")
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (aggError) {
    throw new Error("Failed to aggregate order data");
  }

  const customerMap = new Map<
    string,
    { totalOrders: number; totalSpent: number; lastOrderDate: string | null }
  >();

  for (const order of customerOrders ?? []) {
    const customerId = order.customer_id;
    const existing = customerMap.get(customerId) ?? {
      totalOrders: 0,
      totalSpent: 0,
      lastOrderDate: null,
    };
    existing.totalOrders += 1;
    existing.totalSpent += Number(order.total_amount_vnd ?? 0);
    if (!existing.lastOrderDate) {
      existing.lastOrderDate = order.created_at;
    }
    customerMap.set(customerId, existing);
  }

  const { data: customers, error: custError } = await supabase
    .from("customers")
    .select("id")
    .eq("account_id", accountId)
    .is("deleted_at", null);

  if (custError) {
    throw new Error("Failed to fetch customers");
  }

  const now = new Date();
  let updatedCount = 0;
  const batchSize = 50;
  const allCustomers = customers ?? [];

  for (let index = 0; index < allCustomers.length; index += batchSize) {
    const batch = allCustomers.slice(index, index + batchSize);
    const updates = batch.map((customer) => {
      const orderData = customerMap.get(customer.id) ?? {
        totalOrders: 0,
        totalSpent: 0,
        lastOrderDate: null,
      };

      const rfm = calculateRfm(
        {
          customerId: customer.id,
          lastOrderDate: orderData.lastOrderDate,
          totalOrders: orderData.totalOrders,
          totalSpentVnd: orderData.totalSpent,
        },
        now
      );

      return {
        id: customer.id,
        segment: rfm.segment,
        rfm_recency: rfm.recency,
        rfm_frequency: rfm.frequency,
        rfm_monetary: rfm.monetary,
        rfm_score: rfm.score,
        last_rfm_calculated_at: now.toISOString(),
      };
    });

    const results = await Promise.all(
      updates.map((update) =>
        supabase
          .from("customers")
          .update({
            segment: update.segment,
            rfm_recency: update.rfm_recency,
            rfm_frequency: update.rfm_frequency,
            rfm_monetary: update.rfm_monetary,
            rfm_score: update.rfm_score,
            last_rfm_calculated_at: update.last_rfm_calculated_at,
          })
          .eq("id", update.id)
      )
    );
    updatedCount += results.filter((result) => !result.error).length;
  }

  return {
    success: true,
    updatedCount,
    totalCustomers: allCustomers.length,
    calculatedAt: now.toISOString(),
  };
}

export async function findCustomerDuplicatesForAccount(
  accountId: string,
  input: {
    name: string;
    contacts?: Array<{ value: string }>;
    excludeId?: string;
  }
): Promise<CustomerDuplicateMatch[]> {
  const name = input.name.trim();
  const duplicates: CustomerDuplicateMatch[] = [];

  const { data: nameDups } = await supabase.rpc("check_customer_name_similarity", {
    p_account_id: accountId,
    p_name: name,
    p_threshold: 0.4,
    p_limit: 5,
  });

  if (!nameDups) {
    const { data: fallbackDups } = await supabase
      .from("customers")
      .select("id, full_name")
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .ilike("full_name", `%${name}%`)
      .limit(5);

    (fallbackDups ?? []).forEach((row: Record<string, unknown>) => {
      const rowId = String(row.id);
      if (input.excludeId && rowId === input.excludeId) return;
      duplicates.push({
        id: rowId,
        name: String(row.full_name),
        matchType: "name",
        similarity: 0.7,
      });
    });
  } else {
    (nameDups as Record<string, unknown>[]).forEach((row) => {
      const rowId = String(row.id);
      if (input.excludeId && rowId === input.excludeId) return;
      duplicates.push({
        id: rowId,
        name: String(row.full_name),
        matchType: "name",
        similarity: Number(row.similarity ?? 0.5),
      });
    });
  }

  if (input.contacts?.length) {
    const contactValues = input.contacts
      .map((contact) => contact.value.trim().toLowerCase())
      .filter(Boolean);

    if (contactValues.length > 0) {
      const { data: joinedContactRows, error: joinedContactError } = await supabase
        .from("customer_contacts")
        .select("customer_id, value, customers!inner(id, full_name, account_id, deleted_at)")
        .in("value", contactValues)
        .limit(10);

      let contactDups = (joinedContactRows ?? []) as Array<Record<string, unknown>>;

      if (joinedContactError) {
        if (!isRelationCacheError(joinedContactError)) {
          throw joinedContactError;
        }

        const { data: fallbackContactRows, error: fallbackContactError } = await supabase
          .from("customer_contacts")
          .select("customer_id, value")
          .in("value", contactValues)
          .limit(10);

        if (fallbackContactError) {
          throw fallbackContactError;
        }

        contactDups = (fallbackContactRows ?? []) as Array<Record<string, unknown>>;
      }

      const customerLookup = new Map<
        string,
        { id: string; full_name: string; account_id?: string; deleted_at?: string | null }
      >();

      const addContactMatches = (
        rows: Array<Record<string, unknown>>,
        lookup: Map<string, { id: string; full_name: string; account_id?: string; deleted_at?: string | null }>
      ) => {
        rows.forEach((row) => {
          const customerId = String(row.customer_id ?? "");
          const resolvedCustomer = lookup.get(customerId) ?? null;
          if (!resolvedCustomer) return;
          if (String(resolvedCustomer.account_id ?? accountId) !== accountId) return;
          if (resolvedCustomer.deleted_at) return;
          const resolvedId = String(resolvedCustomer.id);
          if (input.excludeId && resolvedId === input.excludeId) return;

          const existing = duplicates.find((duplicate) => duplicate.id === resolvedId);
          if (existing) {
            existing.matchType = "both";
            existing.matchValue = String(row.value);
            existing.similarity = Math.max(existing.similarity, 0.9);
          } else {
            duplicates.push({
              id: resolvedId,
              name: String(resolvedCustomer.full_name),
              matchType: "contact",
              matchValue: String(row.value),
              similarity: 0.9,
            });
          }
        });
      };

      for (const row of contactDups) {
        const customerId = String(row.customer_id ?? "");
        if (!customerId) continue;

        const embeddedCustomer = (() => {
          const joined = row.customers ?? row.customer ?? null;
          if (Array.isArray(joined)) {
            return (joined[0] ?? null) as Record<string, unknown> | null;
          }
          return joined && typeof joined === "object" ? (joined as Record<string, unknown>) : null;
        })();

        if (!embeddedCustomer) continue;

        customerLookup.set(customerId, {
          id: String(embeddedCustomer.id ?? customerId),
          full_name: String(embeddedCustomer.full_name ?? ""),
          account_id: embeddedCustomer.account_id ? String(embeddedCustomer.account_id) : undefined,
          deleted_at: embeddedCustomer.deleted_at ? String(embeddedCustomer.deleted_at) : null,
        });
      }

      const missingCustomerIds = [...new Set(
        contactDups
          .map((row) => String(row.customer_id ?? ""))
          .filter((customerId) => Boolean(customerId) && !customerLookup.has(customerId))
      )];

      if (missingCustomerIds.length > 0) {
        const fallbackCustomerLookup = await loadRowsByIds<{
          id: string;
          full_name: string;
          account_id: string;
          deleted_at: string | null;
        }>(
          supabase,
          "customers",
          accountId,
          missingCustomerIds,
          "id, full_name, account_id, deleted_at",
        );

        for (const [customerId, customer] of fallbackCustomerLookup.entries()) {
          customerLookup.set(customerId, customer);
        }
      }

      addContactMatches(contactDups, customerLookup);
    }
  }

  return Array.from(new Map(duplicates.map((duplicate) => [duplicate.id, duplicate])).values())
    .sort((left, right) => right.similarity - left.similarity);
}

export async function getCustomerStatsForAccount(
  accountId: string,
  customerId: string
): Promise<CustomerStatsResult | null> {
  const customerQuery = supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .eq("account_id", accountId)
    .is("deleted_at", null);

  const { data: customer, error: custError } = await customerQuery.single();
  if (custError || !customer) {
    return null;
  }

  const { data: orders, error: orderError } = await supabase
    .from("orders")
    .select("id, total_amount_vnd, created_at, status")
    .eq("customer_id", customerId)
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (orderError) {
    throw new Error("Failed to fetch orders");
  }

  const allOrders = orders ?? [];
  const totalOrders = allOrders.length;
  const totalSpentVnd = allOrders.reduce(
    (sum, order) => sum + Number(order.total_amount_vnd ?? 0),
    0
  );
  const avgOrderValueVnd = totalOrders > 0 ? Math.round(totalSpentVnd / totalOrders) : 0;
  const firstOrderDate = allOrders[0]?.created_at ?? null;
  const lastOrderDate = allOrders[allOrders.length - 1]?.created_at ?? null;

  const ordersByStatus: Record<string, number> = {};
  for (const order of allOrders) {
    const status = order.status ?? "unknown";
    ordersByStatus[status] = (ordersByStatus[status] ?? 0) + 1;
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("amount_vnd, created_at")
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const totalPaymentsVnd = (payments ?? []).reduce(
    (sum, payment) => sum + Number(payment.amount_vnd ?? 0),
    0
  );

  const customerRecord = customer as unknown as Record<string, unknown>;
  return {
    customerId,
    totalOrders,
    totalSpentVnd,
    avgOrderValueVnd,
    firstOrderDate,
    lastOrderDate,
    ordersByStatus,
    totalPaymentsVnd,
    outstandingDebtVnd: totalSpentVnd - totalPaymentsVnd,
    segment: (customerRecord.segment as string | null) ?? null,
    rfmScore: Number(customerRecord.rfm_score ?? 0),
    rfmRecency: Number(customerRecord.rfm_recency ?? 0),
    rfmFrequency: Number(customerRecord.rfm_frequency ?? 0),
    rfmMonetary: Number(customerRecord.rfm_monetary ?? 0),
    lastRfmCalculatedAt: customerRecord.last_rfm_calculated_at ? String(customerRecord.last_rfm_calculated_at) : null,
    debtAmountVnd: Number(customerRecord.debt_amount_vnd ?? 0),
    debtOverdueDays: Number(customerRecord.debt_overdue_days ?? 0),
    reliabilityScore: Number(customerRecord.reliability_score ?? 100),
  };
}
