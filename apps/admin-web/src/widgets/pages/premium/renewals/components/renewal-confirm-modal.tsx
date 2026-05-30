"use client";

import { useEffect, useState } from "react";

import { formatMoney } from "@/lib/utils";
import { durationToMonths, getBillingCycleLabel } from "@/lib/domain/premium-renewal-finance";
import { CreateActionFooter, CreateFlowDialog, CreateFormSection } from "@/shared/ui/create-flow-shell";
import { appToast } from "@/shared/lib/toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import {
  buildRenewalFormDefaults,
  PremiumRenewalForm,
  type PremiumRenewalProductOption,
  type RenewalDefaultsSource,
  type RenewalFormValue,
} from "@/widgets/pages/premium/shared/premium-renewal-form";

type RenewalConfirmRow = {
  id: string;
  customer_name: string;
  service_name: string;
  current_billing_cycle?: string | null;
  current_cycle_months?: number | null;
  current_expiry_date?: string | null;
  current_subscription_price?: number | null;
  package_default_price?: number | null;
  renewal_price?: number | null;
  new_billing_cycle?: string | null;
  new_cycle_months?: number | null;
  cost_price?: number | null;
  collected_amount?: number | null;
  notes?: string | null;
  new_product_id?: string | null;
  new_product_duration_months?: number | null;
};

type ProductApiRow = {
  id: string;
  name: string;
  buyPriceVnd?: number | null;
  sellPriceVnd?: number | null;
  durationType?: string | null;
  durationValue?: number | null;
  isActive?: boolean | null;
};

export function RenewalConfirmModal({
  renewal,
  onClose,
  onSubmitted,
}: {
  renewal: RenewalConfirmRow | null;
  onClose: () => void;
  onSubmitted: () => Promise<void> | void;
}) {
  const [form, setForm] = useState<RenewalFormValue | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [productOptions, setProductOptions] = useState<PremiumRenewalProductOption[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  useEffect(() => {
    if (!renewal) {
      setForm(null);
      return;
    }

    const defaultsSource: RenewalDefaultsSource = {
      billingCycle: renewal.new_billing_cycle ?? renewal.current_billing_cycle ?? "1month",
      cycleMonths: Number(renewal.current_cycle_months ?? 1),
      expiryDate: renewal.current_expiry_date ?? new Date().toISOString().split("T")[0],
      currentPrice: Number(
        renewal.current_subscription_price ?? renewal.renewal_price ?? 0,
      ),
      packageDefaultPrice: renewal.package_default_price ?? 0,
    };
    const defaults = buildRenewalFormDefaults(defaultsSource);

    setForm({
      ...defaults,
      productId: renewal.new_product_id ?? defaults.productId,
      newBillingCycle: (renewal.new_billing_cycle as RenewalFormValue["newBillingCycle"]) ?? defaults.newBillingCycle,
      durationMonths: Number(renewal.new_product_duration_months ?? renewal.new_cycle_months ?? defaults.durationMonths),
      renewalPrice: Number(renewal.renewal_price ?? defaults.renewalPrice),
      costPrice: Number(renewal.cost_price ?? defaults.costPrice),
      collectedAmount: Number(renewal.collected_amount ?? renewal.renewal_price ?? defaults.collectedAmount),
      notes: renewal.notes ?? "",
    });
  }, [renewal]);

  useEffect(() => {
    if (!renewal) {
      setProductOptions([]);
      return;
    }

    let isStale = false;
    async function loadProducts() {
      setIsLoadingProducts(true);
      try {
        const response = await fetch("/api/products");
        const payload = await readApiEnvelope<ProductApiRow[]>(response);

        if (!response.ok) {
          appToast.error(payload.error ?? "Không thể tải sản phẩm gia hạn");
          return;
        }

        if (isStale) {
          return;
        }

        setProductOptions(
          (payload.data ?? [])
            .filter((product) => product.isActive !== false)
            .map((product) => ({
              id: product.id,
              name: product.name,
              durationMonths: durationToMonths(product.durationType, product.durationValue),
              sellPriceVnd: Number(product.sellPriceVnd ?? 0),
              buyPriceVnd: Number(product.buyPriceVnd ?? 0),
            }))
            .sort((left, right) => left.name.localeCompare(right.name, "vi")),
        );
      } catch (error) {
        console.error("[RenewalConfirmModal] loadProducts", error);
        appToast.error("Không thể tải sản phẩm gia hạn");
      } finally {
        if (!isStale) {
          setIsLoadingProducts(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isStale = true;
    };
  }, [renewal]);

  async function handleSubmit() {
    if (!renewal || !form) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/premium/renewals/${renewal.id}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          new_billing_cycle: form.newBillingCycle,
          renewal_price: form.renewalPrice,
          cost_price: form.costPrice,
          collected_amount: form.collectedAmount,
          product_id: form.productId || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      const payload = await readApiEnvelope(response);

      if (!response.ok) {
        appToast.error(payload.error ?? "Không thể xác nhận gia hạn");
        return;
      }

      appToast.success("Gia hạn đã được xác nhận");
      await onSubmitted();
      onClose();
    } catch (error) {
      console.error("[RenewalConfirmModal]", error);
      appToast.error("Không thể xác nhận gia hạn");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <CreateFlowDialog
      isOpen={Boolean(renewal && form)}
      onClose={onClose}
      title="Xác nhận gia hạn premium"
      description=""
      size="xl"
      footer={
        <CreateActionFooter
          primaryLabel="Xác nhận gia hạn"
          onPrimary={() => void handleSubmit()}
          onCancel={onClose}
          pending={isSaving}
          disabled={!form || form.renewalPrice <= 0}
        />
      }
    >
      {renewal && form ? (
        <CreateFormSection
          title={`${renewal.customer_name} • ${renewal.service_name}`}
          description=""
        >
          <PremiumRenewalForm
            value={form}
            onChange={setForm}
            currentExpiryDate={
              renewal.current_expiry_date ?? new Date().toISOString().split("T")[0]
            }
            currentCycleMonths={Number(renewal.current_cycle_months ?? 1)}
            currentCycleLabel={getBillingCycleLabel(renewal.current_billing_cycle)}
            currentPrice={Number(renewal.current_subscription_price ?? 0)}
            currentPriceLabel={formatMoney(Number(renewal.current_subscription_price ?? 0))}
            packageDefaultPrice={renewal.package_default_price ?? 0}
            productOptions={productOptions}
            isLoadingProducts={isLoadingProducts}
          />
        </CreateFormSection>
      ) : null}
    </CreateFlowDialog>
  );
}
