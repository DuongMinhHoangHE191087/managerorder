"use client";

import { useEffect, useState } from "react";

import { formatMoney } from "@/lib/utils";
import { getBillingCycleLabel } from "@/lib/domain/premium-renewal-finance";
import { CreateActionFooter, CreateFlowDialog, CreateFormSection } from "@/shared/ui/create-flow-shell";
import { appToast } from "@/shared/lib/toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import {
  buildRenewalFormDefaults,
  PremiumRenewalForm,
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
  cost_price?: number | null;
  collected_amount?: number | null;
  notes?: string | null;
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
      newBillingCycle: (renewal.new_billing_cycle as RenewalFormValue["newBillingCycle"]) ?? defaults.newBillingCycle,
      renewalPrice: Number(renewal.renewal_price ?? defaults.renewalPrice),
      costPrice: Number(renewal.cost_price ?? defaults.costPrice),
      collectedAmount: Number(renewal.collected_amount ?? renewal.renewal_price ?? defaults.collectedAmount),
      notes: renewal.notes ?? "",
    });
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
      description="Kiểm tra lại chu kỳ, doanh thu đã thu, giá vốn và lãi trước khi khóa renewal request."
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
          description={`Chu kỳ hiện tại ${getBillingCycleLabel(
            renewal.current_billing_cycle,
          )} • Giá đang dùng ${formatMoney(Number(renewal.current_subscription_price ?? 0))}`}
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
          />
        </CreateFormSection>
      ) : null}
    </CreateFlowDialog>
  );
}
