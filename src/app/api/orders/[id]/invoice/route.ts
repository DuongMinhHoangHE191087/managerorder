import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOrderWithItems } from "@/lib/supabase/repositories/orders.repo";
import { getCustomerById } from "@/lib/supabase/repositories/customers.repo";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { buildFinancialSummary } from "@/lib/domain/financial";
import {
  buildInvoiceNumber,
  buildTaxSummary,
  getFormattingPreferences,
  normalizeSystemSettings,
} from "@/lib/settings/system-settings";

/**
 * GET /api/orders/[id]/invoice
 *
 * Returns a fully-denormalised invoice payload ready for rendering or PDF export.
 */
export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;

    const order = await getOrderWithItems(id, accountId);
    if (!order) {
      return NextResponse.json({ error: "Đơn hàng không tồn tại" }, { status: 404 });
    }

    const [customerResult, paymentSourceResult, salesChannelResult, systemSettingsResult] = await Promise.all([
      getCustomerById(order.customer_id, accountId),
      order.payment_source_id
        ? supabaseAdmin
            .from("payment_sources")
            .select("name, icon")
            .eq("id", order.payment_source_id)
            .eq("account_id", accountId)
            .single()
        : Promise.resolve({ data: null, error: null }),

      order.sales_channel_id
        ? supabaseAdmin
            .from("sales_channels")
            .select("name")
            .eq("id", order.sales_channel_id)
            .eq("account_id", accountId)
            .single()
        : Promise.resolve({ data: null, error: null }),

      supabaseAdmin
        .from("system_settings")
        .select("*")
        .eq("account_id", accountId)
        .limit(1),
    ]);

    const customer = customerResult ?? null;
    const paymentSource = paymentSourceResult.data ?? null;
    const salesChannel = salesChannelResult.data ?? null;
    const currentSettings = Array.isArray(systemSettingsResult.data)
      ? systemSettingsResult.data[0]
      : null;
    const resolvedSettings = normalizeSystemSettings(
      (order.invoice_snapshot as Record<string, unknown> | null) ?? currentSettings
    );
    const formatting = getFormattingPreferences(resolvedSettings);

    const lineItems = order.items.length > 0
      ? order.items.map((item) => ({
          product_id: item.product_id,
          product_name_snapshot: item.product_name_snapshot,
          quantity: item.quantity,
          unit_price_vnd: item.price_vnd,
          subtotal_vnd: item.subtotal_vnd,
          notes: item.notes,
          assigned_source_account_id: item.assigned_source_account_id,
        }))
      : [
          {
            product_id: order.product_id ?? "",
            product_name_snapshot: order.product_name_snapshot ?? "Sản phẩm",
            quantity: order.quantity,
            unit_price_vnd: order.unit_price_vnd ?? 0,
            subtotal_vnd: order.total_amount_vnd,
            notes: null,
            assigned_source_account_id: null,
          },
        ];

    const totalVnd = Number(order.total_amount_vnd);
    const totalPaidVnd = Number(order.total_paid ?? 0);
    const financialSummary = buildFinancialSummary(order);
    const invoiceNumber = buildInvoiceNumber(resolvedSettings, order.created_at, order.id);
    const taxSummary = buildTaxSummary(totalVnd, resolvedSettings);

    return NextResponse.json({
      data: {
        invoice_number: invoiceNumber,
        issued_at: new Date().toISOString(),

        order: {
          id: order.id,
          status: order.status,
          created_at: order.created_at,
          updated_at: order.updated_at,
          expires_at: order.expires_at,
          sales_note: order.sales_note,
          contact_snapshot: order.contact_snapshot,
          proof_image_urls: order.proof_image_urls ?? [],
          payment_method: order.payment_method,
          payment_terms: financialSummary.payment_terms,
          invoice_snapshot: order.invoice_snapshot ?? null,
          billing_details: order.billing_details ?? null,
        },

        customer: customer
          ? {
              id: customer.id,
              full_name: customer.full_name,
              type: customer.type,
              notes: customer.notes,
              contacts: customer.contacts ?? [],
            }
          : null,

        line_items: lineItems,

        payment_summary: {
          subtotal_vnd: totalVnd,
          discount_vnd: 0,
          total_vnd: totalVnd,
          total_paid_vnd: totalPaidVnd,
          remaining_vnd: financialSummary.balance_due_vnd,
          balance_due_vnd: financialSummary.balance_due_vnd,
          payment_state: financialSummary.payment_state,
          is_fully_paid: financialSummary.is_fully_paid,
          fully_paid: financialSummary.is_fully_paid,
          payment_method: order.payment_method,
          payment_terms: financialSummary.payment_terms,
          payment_source_name: paymentSource?.name ?? null,
          payment_source_icon: (paymentSource as { name: string; icon: string | null } | null)?.icon ?? null,
        },

        sales_channel_name: salesChannel?.name ?? null,
        metadata: {
          currency_code: formatting.currency,
          locale: formatting.locale,
          timezone: formatting.timeZone,
          tax_summary: taxSummary,
        },
      },
    });
  })
);
