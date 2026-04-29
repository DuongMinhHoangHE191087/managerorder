import { randomUUID } from "crypto";
import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { OrderCheckoutPage } from "./pages/order-checkout-page";

async function readJson<T>(response: APIResponse, label: string): Promise<T> {
  const text = await response.text();
  expect(
    response.ok(),
    `${label} failed with ${response.status()}: ${text}`
  ).toBeTruthy();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} returned non-JSON payload: ${text}`);
  }
}

async function getJson<T>(page: Page, path: string): Promise<T> {
  return readJson<T>(await page.request.get(path), `GET ${path}`);
}

async function postJson<T>(page: Page, path: string, data: unknown): Promise<T> {
  return readJson<T>(await page.request.post(path, { data }), `POST ${path}`);
}

async function patchJson<T>(page: Page, path: string, data: unknown): Promise<T> {
  return readJson<T>(await page.request.patch(path, { data }), `PATCH ${path}`);
}

async function putJson<T>(page: Page, path: string, data: unknown): Promise<T> {
  return readJson<T>(await page.request.put(path, { data }), `PUT ${path}`);
}

async function bestEffortDelete(page: Page, path: string): Promise<void> {
  try {
    await page.request.delete(path);
  } catch {
    // Best-effort cleanup only.
  }
}

test.describe.serial("Business smoke", () => {
  test("create order -> partial payment -> refund -> invoice -> debt dashboard -> purchase order", async ({ page }) => {
    test.setTimeout(1_200_000);

    const suffix = randomUUID().slice(0, 8);
    const customerEmail = `smoke-customer-${suffix}@example.test`;
    const providerEmail = `smoke-provider-${suffix}@example.test`;
    const customerName = `Smoke Customer ${suffix}`;
    const productName = `Smoke Product ${suffix}`;
    const providerName = `Smoke Provider ${suffix}`;

    const cleanupTargets: string[] = [];

    try {
      const customer = await postJson<{ data: { id: string } }>(page, "/api/customers", {
        name: customerName,
        contacts: [{ type: "email", value: customerEmail, isPrimary: true }],
        tier: "regular",
      });
      cleanupTargets.push(`/api/customers/${customer.data.id}`);

      const product = await postJson<{ data: { id: string } }>(page, "/api/products", {
        name: productName,
        mode: "key",
        buyPriceVnd: 100_000,
        sellPriceVnd: 200_000,
        durationType: "months",
        durationValue: 1,
        isActive: true,
      });
      cleanupTargets.push(`/api/products/${product.data.id}`);

      const provider = await postJson<{ data: { id: string } }>(page, "/api/providers", {
        name: providerName,
        contacts: [{ type: "email", value: providerEmail, isPrimary: true }],
        tier: "regular",
      });
      cleanupTargets.push(`/api/providers/${provider.data.id}`);

      const orderResponse = await postJson<{
        data: {
          id: string;
          order_code?: string | null;
          status: string;
          total_amount_vnd: number;
          total_paid?: number;
          payment_terms?: string | null;
          payment_state?: string | null;
        };
      }>(page, "/api/orders", {
        customerId: customer.data.id,
        items: [{ productId: product.data.id, quantity: 2 }],
        paymentTerms: "credit",
        salesNote: `Smoke flow ${suffix}`,
      });
      const order = orderResponse.data;
      const orderCode = order.order_code ?? order.id;
      cleanupTargets.push(`/api/orders/${order.id}`);

      expect(order.status).toBe("pending_payment");
      expect(order.payment_terms).toBe("credit");
      expect(order.payment_state).toBe("unpaid");
      expect(order.total_amount_vnd).toBeGreaterThan(0);

      const partialAmount = Math.max(1, Math.floor(order.total_amount_vnd / 2));
      const payment = await postJson<{
        data: { status: string; total_paid: number; payment_terms?: string | null };
        payment: { new_total_paid: number; remaining: number; fully_paid: boolean };
      }>(page, `/api/orders/${order.id}/payment`, {
        amount: partialAmount,
        payment_method: "bank_transfer",
        note: `Smoke partial payment ${suffix}`,
      });

      expect(payment.data.status).toBe("pending_payment");
      expect(payment.payment.fully_paid).toBe(false);
      expect(payment.payment.new_total_paid).toBe(partialAmount);
      expect(payment.payment.remaining).toBe(order.total_amount_vnd - partialAmount);

      const refundRequest = await postJson<{
        data: { id: string; status: string; refundable_amount_vnd: number };
      }>(page, `/api/orders/${order.id}/refunds`, {
        refund_mode: "full",
        reason: `Smoke refund ${suffix}`,
      });
      const refundId = refundRequest.data.id;
      cleanupTargets.push(`/api/orders/${order.id}/refunds/${refundId}`);

      const refundsList = await getJson<{ data: Array<{ id: string; status: string }> }>(
        page,
        `/api/orders/${order.id}/refunds`
      );
      expect(refundsList.data).toHaveLength(1);
      expect(refundsList.data[0].status).toBe("requested");

      const approvedRefund = await patchJson<{
        data: { id: string; status: string };
      }>(page, `/api/orders/${order.id}/refunds/${refundId}`, {
        status: "approved",
        admin_note: `Smoke approved ${suffix}`,
      });
      expect(approvedRefund.data.status).toBe("approved");

      const processingRefund = await patchJson<{
        data: { id: string; status: string };
      }>(page, `/api/orders/${order.id}/refunds/${refundId}`, {
        status: "processing",
        admin_note: `Smoke processing ${suffix}`,
      });
      expect(processingRefund.data.status).toBe("processing");

      const completedRefund = await patchJson<{
        data: { id: string; status: string };
      }>(page, `/api/orders/${order.id}/refunds/${refundId}`, {
        status: "completed",
        admin_note: `Smoke completed ${suffix}`,
      });
      expect(completedRefund.data.status).toBe("completed");

      const invoice = await getJson<{
        data: {
          order: { status: string };
          payment_summary: {
            payment_terms?: string | null;
            payment_state: string;
            balance_due_vnd: number;
          };
          metadata: {
            currency_code: string;
            locale: string;
            tax_summary: unknown;
          };
        };
      }>(page, `/api/orders/${order.id}/invoice`);
      expect(invoice.data.order.status).toBe("refunded");
      expect(invoice.data.payment_summary.payment_terms).toBe("credit");
      expect(invoice.data.payment_summary.payment_state).toBe("unpaid");
      expect(invoice.data.payment_summary.balance_due_vnd).toBeGreaterThanOrEqual(0);
      expect(invoice.data.metadata.currency_code).toBeTruthy();
      expect(invoice.data.metadata.locale).toBeTruthy();
      expect(invoice.data.metadata.tax_summary).toBeTruthy();

      const debtSummary = await getJson<{
        totalDebtVnd: number;
        totalCustomers: number;
        customersWithDebt: number;
        overdueCustomers: number;
        aging: Record<string, number>;
        topDebtors: Array<{ id: string; name: string }>;
      }>(page, "/api/customers/debt-summary");
      expect(debtSummary.totalDebtVnd).toBeGreaterThanOrEqual(0);
      expect(debtSummary.totalCustomers).toBeGreaterThanOrEqual(1);
      expect(typeof debtSummary.aging).toBe("object");
      expect(Array.isArray(debtSummary.topDebtors)).toBe(true);

      const purchaseOrder = await postJson<{
        data: { id: string; providerId: string; status: string; totalPaidVnd: number };
      }>(page, "/api/purchase-orders", {
        provider_id: provider.data.id,
        status: "partial",
        items: [{ productId: product.data.id, quantity: 4, priceVnd: 75_000 }],
        total_amount_vnd: 300_000,
        total_paid_vnd: 150_000,
        payment_method: "bank_transfer",
        notes: `Smoke purchase order ${suffix}`,
      });
      cleanupTargets.push(`/api/purchase-orders/${purchaseOrder.data.id}`);

      const purchaseOrders = await getJson<{
        data: Array<{ id: string; providerId: string; status: string }>;
      }>(page, `/api/purchase-orders?provider_id=${provider.data.id}`);
      expect(purchaseOrders.data.some((po) => po.id === purchaseOrder.data.id)).toBe(true);

      const ordersPage = new OrderCheckoutPage(page);
      await putJson(page, `/api/purchase-orders/${purchaseOrder.data.id}`, {
        status: "cancelled",
        total_paid_vnd: 0,
      });
      await ordersPage.gotoOrderDetail(order.id);
      expect(page.url()).toContain(`/orders/${order.id}`);

    } finally {
      for (const path of cleanupTargets.reverse()) {
        await bestEffortDelete(page, path);
      }
    }
  });
});
