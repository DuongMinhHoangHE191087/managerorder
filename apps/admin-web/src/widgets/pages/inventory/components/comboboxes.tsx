"use client";

import { SmartSelector } from "@/shared/ui/smart-selector";
import { SearchMultiSelector } from "@/shared/ui/search-multi-selector";
import type { Provider } from "@/lib/domain/types";
import { formatMoney } from "@/lib/utils";

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
    sublabel: provider.contacts.find((contact) => contact.isPrimary)?.value || provider.contacts[0]?.value || "No contact",
  }));

  return (
    <SmartSelector
      items={items}
      value={value}
      onSelect={(item) => onChange(item.id)}
      onCreateNew={onCreateNew}
      placeholder="Tìm nhà cung cấp..."
      createLabel="Thêm nhà cung cấp mới"
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
      placeholder="Tìm sản phẩm..."
      createLabel="Tạo sản phẩm mới"
      emptyText="Không tìm thấy sản phẩm phù hợp"
    />
  );
}
