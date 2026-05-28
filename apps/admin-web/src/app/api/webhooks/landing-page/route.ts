// ============================================================
// INBOUND WEBHOOK → Landing Page & Seepay Auto provisioning
// Method: POST /api/webhooks/landing-page
// Secures endpoint using X-Webhook-Secret header
// Returns join links or license keys directly in response
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createCustomer } from "@/lib/supabase/repositories/customers.repo";
import { createOrder } from "@/lib/supabase/repositories/orders.repo";
import { confirmAllocation } from "@/lib/services/allocation.service";
import { sendTelegramMessage } from "@/lib/utils/telegram";
import { getDecryptedSourceAccountSecretsForAccount } from "@/domains/source-accounts";

const WEBHOOK_SECRET = (
  process.env.WEBHOOK_LANDING_PAGE_SECRET ||
  process.env["WEBHOOK_LANDING_PAGE_SECRET "] ||
  ""
).trim();
const DEFAULT_ACCOUNT_ID = "550e8400-e29b-41d4-a716-446655440000";

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: {
    customer: {
      full_name: string;
      email: string;
      phone: string;
      zalo?: string;
      telegram?: string;
    };
    order: {
      product_id: string;
      duration_months: number;
      billing_cycle: string;
      final_amount_vnd: number;
      notes?: string;
    };
    payment: {
      provider: string;
      transaction_id: string;
      amount: number;
      payment_status: string;
      paid_at?: string;
      memo?: string;
    };
  };
}

/** Helper to retrieve invite join link of an already allocated slot */
async function getInviteLinkForOrder(orderId: string, accountId: string): Promise<string | null> {
  try {
    const { data: orderItems } = await supabaseAdmin
      .from("order_items")
      .select("assigned_source_account_id")
      .eq("order_id", orderId)
      .not("assigned_source_account_id", "is", null);

    if (orderItems && orderItems.length > 0) {
      const sourceAccountId = orderItems[0].assigned_source_account_id;
      if (sourceAccountId) {
        const secrets = await getDecryptedSourceAccountSecretsForAccount(sourceAccountId, accountId);
        const joinLinkObj = secrets?.credentials?.find(c => c.type === "link_join");
        return joinLinkObj?.value ?? null;
      }
    }
  } catch (err) {
    console.error(`[Webhook Seepay] Failed to decrypt invite link for order ${orderId}:`, err);
  }
  return null;
}

/** Helper to retrieve license key of an already allocated key product */
async function getLicenseKeyForOrder(orderId: string): Promise<string | null> {
  try {
    const { data: keys } = await supabaseAdmin
      .from("license_keys")
      .select("key_code")
      .eq("order_id", orderId)
      .limit(1);

    if (keys && keys.length > 0) {
      return keys[0].key_code;
    }
  } catch (err) {
    console.error(`[Webhook Seepay] Failed to retrieve license key for order ${orderId}:`, err);
  }
  return null;
}

export async function POST(request: NextRequest) {
  // 1. Verify Webhook Secret to prevent spam/fake transactions
  const requestSecret = request.headers.get("X-Webhook-Secret")?.trim();
  if (!WEBHOOK_SECRET || requestSecret !== WEBHOOK_SECRET) {
    console.warn(`[Webhook Seepay] Unauthorized request. Secret mismatch. Got: "${requestSecret}", Expected: "${WEBHOOK_SECRET}"`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as WebhookPayload;
    
    // Validate required payload fields
    if (!payload.data?.customer?.full_name || !payload.data?.order?.product_id) {
      return NextResponse.json({ error: "Missing required data fields" }, { status: 400 });
    }

    const accountId = process.env.ACCOUNT_ID ?? process.env.TEST_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID;
    const { customer, order, payment } = payload.data;
    const email = customer.email?.trim().toLowerCase() ?? "";
    const phone = customer.phone?.trim() ?? "";

    // Generate readable order code using transaction details
    const orderCode = `ORD-${payment.transaction_id || Date.now().toString().slice(-8)}`;

    // ── Idempotency Guard (Only allocate ONCE per transaction) ──
    const { data: existingOrder } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .eq("order_code", orderCode)
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingOrder) {
      console.log(`[Webhook Seepay] Order ${orderCode} already exists (Idempotency triggered). Fetching credentials...`);
      
      const inviteLink = await getInviteLinkForOrder(existingOrder.id, accountId);
      const licenseKey = await getLicenseKeyForOrder(existingOrder.id);

      return NextResponse.json({
        success: true,
        orderCode,
        orderId: existingOrder.id,
        allocated: !!(inviteLink || licenseKey),
        inviteLink,
        licenseKey,
        message: "Order already processed. Allocation skipped to prevent duplicates.",
      });
    }

    console.log(`[Webhook Seepay] Processing new order for customer: ${customer.full_name} (${email || phone})`);

    // 2. Resolve Customer (Find existing contact or Create new)
    let customerId = "";
    if (email || phone) {
      // Look up in customer_contacts across the account
      let queryValue = "";
      if (email && phone) {
        queryValue = `value.eq.${email},value.eq.${phone}`;
      } else if (email) {
        queryValue = `value.eq.${email}`;
      } else {
        queryValue = `value.eq.${phone}`;
      }

      const { data: existingContacts, error: lookupError } = await supabaseAdmin
        .from("customer_contacts")
        .select("customer_id")
        .or(queryValue)
        .limit(1);

      if (lookupError) {
        console.error(`[Webhook Seepay] Lookup customer contact failed:`, lookupError.message);
      }

      if (existingContacts && existingContacts.length > 0) {
        customerId = existingContacts[0].customer_id;
        console.log(`[Webhook Seepay] Matched existing customer ID: ${customerId}`);
      }
    }

    // If no existing customer found, create a new retail customer
    if (!customerId) {
      const contactsToCreate = [];
      if (email) {
        contactsToCreate.push({ channel: "email", value: email, is_primary: true, is_verified: true });
      }
      if (phone) {
        contactsToCreate.push({ channel: "phone", value: phone, is_primary: !email, is_verified: true });
      }
      if (customer.zalo) {
        contactsToCreate.push({ channel: "zalo", value: customer.zalo.trim(), is_primary: false, is_verified: true });
      }
      if (customer.telegram) {
        contactsToCreate.push({ channel: "telegram", value: customer.telegram.trim(), is_primary: false, is_verified: true });
      }

      const newCustomer = await createCustomer(accountId, {
        full_name: customer.full_name.trim(),
        type: "retail",
        notes: "Tự động đăng ký từ landing page duongminhhoang.store",
        contacts: contactsToCreate,
      });
      customerId = newCustomer.id;
      console.log(`[Webhook Seepay] Created new customer. ID: ${customerId}`);
    }

    // 3. Fetch Product Details (to get official name & buy price snapshot)
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("id", order.product_id)
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .single();

    const productName = product?.name || order.product_id;
    const buyPrice = product?.buy_price_vnd || 0;

    // Calculate expiration date based on duration_months
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + (order.duration_months || 1));

    // 4. Create Order
    const newOrder = await createOrder(accountId, {
      order_code: orderCode,
      customer_id: customerId,
      product_id: order.product_id,
      product_name_snapshot: productName,
      quantity: 1,
      unit_price_vnd: order.final_amount_vnd,
      cost_price_vnd: buyPrice,
      total_cost_vnd: buyPrice,
      total_amount_vnd: order.final_amount_vnd,
      total_paid: payment.amount || order.final_amount_vnd,
      payment_method: payment.provider || "seepay",
      sales_note: order.notes || `Mua tự động từ Landing page. Giao dịch: ${payment.transaction_id || "N/A"}. Memo: ${payment.memo || "N/A"}`,
      contact_snapshot: `${email ? 'Email:' + email : ''}${phone ? ' | SĐT:' + phone : ''}`,
      status: "paid",
      created_at: payment.paid_at || new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    // 5. Create Order Item
    const { error: itemError } = await supabaseAdmin
      .from("order_items")
      .insert({
        order_id: newOrder.id,
        product_id: order.product_id,
        product_name_snapshot: productName,
        quantity: 1,
        price_vnd: order.final_amount_vnd,
        cost_price_vnd: buyPrice,
        subtotal_vnd: order.final_amount_vnd,
      });

    if (itemError) {
      throw new Error(`Failed to create order item: ${itemError.message}`);
    }

    console.log(`[Webhook Seepay] Successfully created order ${orderCode}. Allocating accounts...`);

    // 6. Automatically allocate slot/key using Allocation engine
    let allocationSuccess = false;
    let allocationMsg = "";
    try {
      const allocationResult = await confirmAllocation(newOrder.id, accountId);
      allocationSuccess = allocationResult.suggestion.isValid;
      allocationMsg = allocationResult.message;
    } catch (allocError) {
      console.error(`[Webhook Seepay] Allocation service crashed:`, allocError);
      allocationMsg = allocError instanceof Error ? allocError.message : "Allocation engine error";
    }

    // 7. Get the allocated invite join link or license key
    let inviteLink: string | null = null;
    let licenseKey: string | null = null;

    if (allocationSuccess) {
      inviteLink = await getInviteLinkForOrder(newOrder.id, accountId);
      licenseKey = await getLicenseKeyForOrder(newOrder.id);
    }

    // 8. Send beautiful Telegram notification HTML template to admin group
    let telegramMsg = `<b>🚀 ĐƠN HÀNG TỰ ĐỘNG MỚI (WEBHOOK)</b>\n`;
    telegramMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
    telegramMsg += `👤 <b>Khách hàng:</b> <code>${customer.full_name}</code>\n`;
    if (phone) telegramMsg += `📞 <b>Số điện thoại:</b> <code>${phone}</code>\n`;
    if (email) telegramMsg += `📧 <b>Email:</b> <code>${email}</code>\n`;
    telegramMsg += `📦 <b>Sản phẩm:</b> <b>${productName}</b> (${order.duration_months} tháng)\n`;
    telegramMsg += `💰 <b>Tổng tiền:</b> <code>${order.final_amount_vnd.toLocaleString("vi-VN")} VND</code>\n`;
    telegramMsg += `💳 <b>Thanh toán:</b> <code>${payment.provider.toUpperCase()}</code> (${payment.transaction_id})\n`;
    if (payment.memo) telegramMsg += `📝 <b>Nội dung chuyển:</b> <i>${payment.memo}</i>\n`;
    telegramMsg += `━━━━━━━━━━━━━━━━━━━━\n`;

    if (allocationSuccess) {
      telegramMsg += `✅ <b>Cấp phát tài khoản:</b> THÀNH CÔNG! Đơn hàng tự động kích hoạt trạng thái <b>Active</b>.\n`;
      if (inviteLink) {
        telegramMsg += `🔗 <b>Link Join:</b> <code>${inviteLink}</code>`;
      } else if (licenseKey) {
        telegramMsg += `🔑 <b>License Key:</b> <code>${licenseKey}</code>`;
      } else {
        telegramMsg += `ℹ️ <i>Đã phân phối slot tài khoản nguồn.</i>`;
      }
    } else {
      telegramMsg += `⚠️ <b>Cấp phát tài khoản:</b> THẤT BẠI (Cần xử lý thủ công!)\n`;
      telegramMsg += `❌ <b>Lý do:</b> <i>${allocationMsg}</i>`;
    }

    await sendTelegramMessage(telegramMsg);

    return NextResponse.json({
      success: true,
      orderCode,
      orderId: newOrder.id,
      allocated: allocationSuccess,
      inviteLink,
      licenseKey,
      message: allocationSuccess ? "Order created and activated successfully" : `Order created. Allocation failed: ${allocationMsg}`,
    });

  } catch (error) {
    console.error(`[Webhook Seepay] Webhook handler crashed:`, error);
    
    // Alert crash to admin telegram immediately
    await sendTelegramMessage(`<b>💥 CRITICAL ERROR: WEBHOOK SEEPAY CRASHED</b>\n\n<code>${error instanceof Error ? error.message : "Unknown error"}</code>`);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
