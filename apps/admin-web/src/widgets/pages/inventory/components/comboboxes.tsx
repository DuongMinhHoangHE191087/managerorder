"use client";

import { SmartSelector } from "@/shared/ui/smart-selector";
import { SearchMultiSelector } from "@/shared/ui/search-multi-selector";
import type { Provider } from "@/lib/domain/types";
import { formatMoney } from "@/lib/utils";
import { INVENTORY_COPY as copy } from "../copy";

export type ApiProduct = {
  id: string;
  name: string;
  mode?: string;
  buyPriceVnd?: number;
  sellPriceVnd?: number;
  sell_price_vnd?: number;
  durationValue?: number;
  durationType?: "days" | "months" | "years";
  isActive?: boolean;
};

export type ApiLicenseKey = {
  id: string;
  key_code?: string;
  keyCode?: string;
  product_id?: string;
  productId?: string;
  status: string;
};

export function ProviderCombobox({
  providers,
  value,
  onChange,
  onCreateNew,
}: {
  providers: Provider[];
  value: string;
  onChange: (id: string) => void;
  onCreateNew?: () => void;
}) {
  const items = providers.map((provider) => ({
    id: provider.id,
    label: provider.name,
    sublabel: provider.contacts.find((contact) => contact.isPrimary)?.value || provider.contacts[0]?.value || copy.comboboxes.noContact,
  }));

  return (
    <SmartSelector
      items={items}
      value={value}
      onSelect={(item) => onChange(item.id)}
      onCreateNew={onCreateNew}
      placeholder={copy.comboboxes.providerPlaceholder}
      createLabel={copy.comboboxes.createProvider}
    />
  );
}

export function ProductMultiCombobox({
  products,
  value,
  onChange,
  onCreateNew,
}: {
  products: ApiProduct[];
  value: string[];
  onChange: (ids: string[]) => void;
  onCreateNew?: () => void;
}) {
  const items = products.map((product) => ({
    id: product.id,
    label: product.name,
    sublabel: `${product.mode ?? "—"} • ${formatMoney(product.sellPriceVnd ?? product.sell_price_vnd ?? 0)}`,
  }));

  return (
    <SearchMultiSelector
      items={items}
      value={value}
      onChange={onChange}
      onCreateNew={onCreateNew}
      placeholder={copy.comboboxes.productPlaceholder}
      createLabel={copy.comboboxes.createProduct}
      emptyText={copy.comboboxes.noProduct}
    />
  );
}
