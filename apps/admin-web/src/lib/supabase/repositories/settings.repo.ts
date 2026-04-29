// ============================================================
// SETTINGS REPOSITORY — Supabase
// Replaces in-memory: listPaymentSources, createPaymentSource,
//                     updatePaymentSource, deletePaymentSource,
//                     listSalesChannels, createSalesChannel,
//                     updateSalesChannel, deleteSalesChannel
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';
import { cached, invalidate, TTL } from '@/lib/cache/db-cache';
import { ConflictError, SchemaNotInitializedError } from '@/lib/utils/errors';
import { isMissingColumnError, isMissingRelationError } from '@/lib/supabase/schema-errors';

type PaymentSourceRow = Database['public']['Tables']['payment_sources']['Row'];
export type SalesChannelRow = Database['public']['Tables']['sales_channels']['Row'];

const key = {
  paymentSources: (accountId: string) => `payment_sources:list:${accountId}`,
  salesChannels: (accountId: string) => `sales_channels:list:${accountId}`,
};

// ── Payment Sources ──────────────────────────────────────────────────────────

export async function listPaymentSources(accountId: string): Promise<PaymentSourceRow[]> {
  return cached(
    key.paymentSources(accountId),
    async () => {
      const { data, error } = await supabase
        .from('payment_sources')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    TTL.REFERENCE,
  );
}

export async function createPaymentSource(
  accountId: string,
  input: { name: string; icon?: string }
): Promise<PaymentSourceRow> {
  const { data, error } = await supabase
    .from('payment_sources')
    .insert({ name: input.name, icon: input.icon ?? null, account_id: accountId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  invalidate(key.paymentSources(accountId));
  return data;
}

export async function updatePaymentSource(
  id: string,
  accountId: string,
  input: { name?: string; icon?: string }
): Promise<PaymentSourceRow> {
  const { data, error } = await supabase
    .from('payment_sources')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('PaymentSource not found');
  invalidate(key.paymentSources(accountId));
  return data;
}

export async function deletePaymentSource(id: string, accountId: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .eq('payment_source_id', id);

  if (countError) {
    throw new Error(countError.message);
  }

  if ((count ?? 0) > 0) {
    throw new ConflictError('Nguồn thanh toán đang được sử dụng bởi đơn hàng, không thể xoá');
  }

  const { error } = await supabase
    .from('payment_sources')
    .delete()
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);
  invalidate(key.paymentSources(accountId));
}

// ── Sales Channels ───────────────────────────────────────────────────────────

export async function listSalesChannels(accountId: string): Promise<SalesChannelRow[]> {
  return cached(
    key.salesChannels(accountId),
    async () => {
      const { data, error } = await supabase
        .from('sales_channels')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: true });
      if (error) {
        if (isMissingRelationError(error, 'sales_channels')) {
          return [];
        }
        throw new Error(error.message);
      }
      return data ?? [];
    },
    TTL.REFERENCE,
  );
}

export async function getSalesChannelById(
  id: string,
  accountId: string,
): Promise<SalesChannelRow | null> {
  const { data, error } = await supabase
    .from('sales_channels')
    .select('*')
    .eq('id', id)
    .eq('account_id', accountId)
    .single();

  if (error) {
    if (isMissingRelationError(error, 'sales_channels')) {
      return null;
    }
    return null;
  }

  return data;
}

export async function createSalesChannel(
  accountId: string,
  input: {
    name: string;
    defaultDeliveryMode: "direct_redirect" | "landing_page";
    defaultLandingTemplateKey: "owner_intro" | "ctv_neutral";
    defaultFailureTemplateKey?: "seller_unlock_request" | "customer_offer_wall";
    sellerContactUrl?: string | null;
  }
): Promise<SalesChannelRow> {
  const { data, error } = await supabase
    .from('sales_channels')
    .insert({
      name: input.name,
      account_id: accountId,
      default_delivery_mode: input.defaultDeliveryMode,
      default_landing_template_key: input.defaultLandingTemplateKey,
      default_failure_template_key: input.defaultFailureTemplateKey ?? "customer_offer_wall",
      seller_contact_url: input.sellerContactUrl ?? null,
    })
    .select()
    .single();
  if (error) {
    if (isMissingRelationError(error, 'sales_channels')) {
      throw new SchemaNotInitializedError(
        'Tính năng kênh bán chưa được khởi tạo trong cơ sở dữ liệu',
        { relation: 'sales_channels' },
      );
    }
    if (
      isMissingColumnError(error, 'default_failure_template_key', 'sales_channels')
      || isMissingColumnError(error, 'seller_contact_url', 'sales_channels')
    ) {
      throw new SchemaNotInitializedError(
        'Cấu hình template lỗi công khai của kênh bán chưa dùng được vì cơ sở dữ liệu chưa được nâng cấp',
        {
          relation: 'sales_channels',
          missingColumns: ['default_failure_template_key', 'seller_contact_url'],
          operation: 'create',
        },
      );
    }
    throw new Error(error.message);
  }
  invalidate(key.salesChannels(accountId));
  return data;
}

export async function updateSalesChannel(
  id: string,
  accountId: string,
  input: {
    name?: string;
    defaultDeliveryMode?: "direct_redirect" | "landing_page";
    defaultLandingTemplateKey?: "owner_intro" | "ctv_neutral";
    defaultFailureTemplateKey?: "seller_unlock_request" | "customer_offer_wall";
    sellerContactUrl?: string | null;
  }
): Promise<SalesChannelRow> {
  const updatePayload: Database['public']['Tables']['sales_channels']['Update'] = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    updatePayload.name = input.name;
  }
  if (input.defaultDeliveryMode !== undefined) {
    updatePayload.default_delivery_mode = input.defaultDeliveryMode;
  }
  if (input.defaultLandingTemplateKey !== undefined) {
    updatePayload.default_landing_template_key = input.defaultLandingTemplateKey;
  }
  if (input.defaultFailureTemplateKey !== undefined) {
    updatePayload.default_failure_template_key = input.defaultFailureTemplateKey;
  }
  if (input.sellerContactUrl !== undefined) {
    updatePayload.seller_contact_url = input.sellerContactUrl;
  }

  const { data, error } = await supabase
    .from('sales_channels')
    .update(updatePayload)
    .eq('id', id)
    .eq('account_id', accountId)
    .select()
    .single();
  if (error) {
    if (isMissingRelationError(error, 'sales_channels')) {
      throw new SchemaNotInitializedError(
        'Tính năng kênh bán chưa được khởi tạo trong cơ sở dữ liệu',
        { relation: 'sales_channels' },
      );
    }
    if (
      isMissingColumnError(error, 'default_failure_template_key', 'sales_channels')
      || isMissingColumnError(error, 'seller_contact_url', 'sales_channels')
    ) {
      throw new SchemaNotInitializedError(
        'Cấu hình template lỗi công khai của kênh bán chưa dùng được vì cơ sở dữ liệu chưa được nâng cấp',
        {
          relation: 'sales_channels',
          missingColumns: ['default_failure_template_key', 'seller_contact_url'],
          operation: 'update',
        },
      );
    }
    throw new Error(error.message);
  }
  if (!data) throw new Error('SalesChannel not found');
  invalidate(key.salesChannels(accountId));
  return data;
}

export async function deleteSalesChannel(id: string, accountId: string): Promise<void> {
  const { error } = await supabase
    .from('sales_channels')
    .delete()
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) {
    if (isMissingRelationError(error, 'sales_channels')) {
      throw new SchemaNotInitializedError(
        'Tính năng kênh bán chưa được khởi tạo trong cơ sở dữ liệu',
        { relation: 'sales_channels' },
      );
    }
    throw new Error(error.message);
  }
  invalidate(key.salesChannels(accountId));
}
