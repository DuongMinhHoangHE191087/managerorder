import type { CreateProductInput } from "@/lib/domain/schemas";
import type { ProductService } from "@/lib/domain/types";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { mapProductRow } from "@/lib/supabase/mappers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ConflictError } from "@/lib/utils/errors";
import {
  createProduct as createProductRepo,
  deleteProduct as deleteProductRepo,
  getProductById as getProductByIdRepo,
  listProducts as listProductsRepo,
  updateProduct as updateProductRepo,
} from "../repository";

export type ProductUpdateInput = Partial<CreateProductInput>;

function mapProducts(rows: Array<Record<string, unknown>>): ProductService[] {
  return rows.map((row) => mapProductRow(row));
}

async function countPendingOrdersForProduct(productId: string, accountId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("account_id", accountId)
    .in("status", ["draft", "pending_payment"]);

  return count ?? 0;
}

export async function listProductsForAccount(accountId: string): Promise<ProductService[]> {
  const rows = await listProductsRepo(accountId);
  return mapProducts(rows);
}

export async function getProductForAccount(
  id: string,
  accountId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<ProductService | null> {
  const row = await getProductByIdRepo(id, accountId, options);
  return row ? mapProductRow(row) : null;
}

export async function createProductForAccount(
  accountId: string,
  input: CreateProductInput,
): Promise<ProductService> {
  const row = await createProductRepo(accountId, {
    name: input.name,
    mode: input.mode,
    duration_type: input.durationType,
    duration_value: input.durationValue,
    buy_price_vnd: input.buyPriceVnd,
    sell_price_vnd: input.sellPriceVnd,
    is_active: input.isActive,
  });

  const data = mapProductRow(row);

  createActivityLog({
    account_id: accountId,
    action_type: "PRODUCT_CREATED",
    details: {
      product_id: data.id,
      name: data.name,
      mode: data.mode,
      price: data.sellPriceVnd,
    },
  }).catch(() => {});

  return data;
}

export async function updateProductForAccount(
  id: string,
  accountId: string,
  input: ProductUpdateInput,
): Promise<ProductService> {
  const current = input.sellPriceVnd === undefined ? null : await getProductByIdRepo(id, accountId);

  if (current && current.sell_price_vnd !== input.sellPriceVnd) {
    const pendingOrderCount = await countPendingOrdersForProduct(id, accountId);
    if (pendingOrderCount > 0) {
      throw new ConflictError("Không thể thay đổi giá khi còn đơn hàng chưa thanh toán");
    }
  }

  const row = await updateProductRepo(id, accountId, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.mode !== undefined && { mode: input.mode }),
    ...(input.durationType !== undefined && { duration_type: input.durationType }),
    ...(input.durationValue !== undefined && { duration_value: input.durationValue }),
    ...(input.buyPriceVnd !== undefined && { buy_price_vnd: input.buyPriceVnd }),
    ...(input.sellPriceVnd !== undefined && { sell_price_vnd: input.sellPriceVnd }),
    ...(input.isActive !== undefined && { is_active: input.isActive }),
  });

  const data = mapProductRow(row);

  createActivityLog({
    account_id: accountId,
    action_type: "PRODUCT_UPDATED",
    details: {
      product_id: data.id,
      name: data.name,
      mode: data.mode,
      sell_price_vnd: data.sellPriceVnd,
      buy_price_vnd: data.buyPriceVnd,
      duration_type: data.durationType,
      duration_value: data.durationValue,
      is_active: data.isActive,
      changed_fields: Object.keys(input),
    },
  }).catch(() => {});

  return data;
}

export async function deleteProductForAccount(
  id: string,
  accountId: string,
): Promise<void> {
  const current = await getProductByIdRepo(id, accountId);
  await deleteProductRepo(id, accountId);

  createActivityLog({
    account_id: accountId,
    action_type: "PRODUCT_DELETED",
    details: {
      product_id: id,
      name: current?.name ?? null,
      mode: current?.mode ?? null,
      sell_price_vnd: current?.sell_price_vnd ?? null,
      buy_price_vnd: current?.buy_price_vnd ?? null,
    },
  }).catch(() => {});
}
