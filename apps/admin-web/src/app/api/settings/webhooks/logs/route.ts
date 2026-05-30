import { NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(withAccount(async (_request, { accountId }) => {
  // Lấy 50 logs gần nhất kèm theo thông tin mã đơn hàng
  const { data, error } = await supabase
    .from("webhook_logs")
    .select(`
      id,
      provider,
      external_transaction_id,
      payload,
      status,
      error_message,
      amount,
      order_id,
      created_at,
      orders (
        order_code
      )
    `)
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  // Định dạng lại kết quả trả về khớp với giao diện
  const formattedLogs = (data ?? []).map((log: any) => ({
    id: log.id,
    provider: log.provider,
    externalTransactionId: log.external_transaction_id,
    payload: log.payload,
    status: log.status,
    errorMessage: log.error_message,
    amount: log.amount ? Number(log.amount) : null,
    orderId: log.order_id,
    orderCode: log.orders?.order_code ?? null,
    createdAt: log.created_at,
  }));

  return NextResponse.json({ data: formattedLogs });
}));
