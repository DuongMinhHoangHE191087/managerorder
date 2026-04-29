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

type SubscriptionRenewalRequestRow = {
  id: string;
  customer_name: string;
  service_name: string;
  billing_cycle: string;
  cycle_months: number;
  expiry_date: string;
  final_price: number;
  original_price: number;
  package_default_price?: number | null;
};

export function RenewalRequestModal({
  subscription,
  onClose,
  onSubmitted,
}: {
  subscription: SubscriptionRenewalRequestRow | null;
  onClose: () => void;
  onSubmitted: () => Promise<void> | void;
}) {
  const [form, setForm] = useState<RenewalFormValue | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!subscription) {
      setForm(null);
      return;
    }

    const defaultsSource: RenewalDefaultsSource = {
      billingCycle: subscription.billing_cycle,
      cycleMonths: subscription.cycle_months,
      expiryDate: subscription.expiry_date,
      currentPrice: Number(subscription.final_price ?? subscription.original_price ?? 0),
      packageDefaultPrice: subscription.package_default_price ?? 0,
    };
    setForm(buildRenewalFormDefaults(defaultsSource));
  }, [subscription]);

  async function handleSubmit() {
    if (!subscription || !form) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/premium/subscriptions/${subscription.id}/renew`, {
        method: "PUT",
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
        appToast.error(payload.error ?? "Không thể tạo yêu cầu gia hạn");
        return;
      }

      appToast.success("Đã tạo yêu cầu gia hạn");
      await onSubmitted();
      onClose();
    } catch (error) {
      console.error("[RenewalRequestModal]", error);
      appToast.error("Không thể tạo yêu cầu gia hạn");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <CreateFlowDialog
      isOpen={Boolean(subscription && form)}
      onClose={onClose}
      title="Tạo yêu cầu gia hạn premium"
      description="Chốt chu kỳ mới, giá bán, giá vốn và phần tiền đã thu ngay từ lúc tạo request để queue gia hạn có đủ dữ liệu vận hành."
      size="xl"
      footer={
        <CreateActionFooter
          primaryLabel="Tạo yêu cầu gia hạn"
          onPrimary={() => void handleSubmit()}
          onCancel={onClose}
          pending={isSaving}
          disabled={!form || form.renewalPrice <= 0}
        />
      }
    >
      {subscription && form ? (
        <CreateFormSection
          title={`${subscription.customer_name} • ${subscription.service_name}`}
          description={`Hạn hiện tại ${subscription.expiry_date} • Giá hiện tại ${formatMoney(
            Number(subscription.final_price ?? subscription.original_price ?? 0),
          )}`}
        >
          <PremiumRenewalForm
            value={form}
            onChange={setForm}
            currentExpiryDate={subscription.expiry_date}
            currentCycleMonths={subscription.cycle_months}
            currentCycleLabel={getBillingCycleLabel(subscription.billing_cycle)}
            currentPrice={Number(subscription.final_price ?? subscription.original_price ?? 0)}
            currentPriceLabel={formatMoney(
              Number(subscription.final_price ?? subscription.original_price ?? 0),
            )}
            packageDefaultPrice={subscription.package_default_price ?? 0}
          />
        </CreateFormSection>
      ) : null}
    </CreateFlowDialog>
  );
}
