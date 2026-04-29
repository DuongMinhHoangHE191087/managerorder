"use client";

import { memo, useCallback, useEffect, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { Calendar, Lock, Mail, ShieldAlert, Users } from "lucide-react";

import { appToast } from "@/shared/ui/app-toast";
import {
  AdvancedOptionsDisclosure,
  CreateActionFooter,
  CreateFlowDialog,
  CreateFormSection,
} from "@/shared/ui/create-flow-shell";
import { Input } from "@/shared/ui/input";
import { DynamicCredentialList, type DuolingoAutoFillResult } from "@/widgets/pages/inventory/components/dynamic-credential-list";
import { ProviderCombobox, ProductMultiCombobox } from "@/widgets/pages/inventory/components/comboboxes";
import { useSourceAccountDecrypt } from "@/widgets/pages/inventory/hooks/use-source-accounts";
import type { ProductService, Provider, SourceAccount, WarehouseCredential } from "@/lib/domain/types";

const CustomerCreateModalLazy = dynamic(
  () =>
    import("@/widgets/pages/customers/components/customer-create-modal").then((mod) => ({
      default: mod.CustomerCreateModal,
    })),
  { ssr: false },
);

const ProductCreateModalLazy = dynamic(
  () =>
    import("@/widgets/pages/products/components/product-create-modal").then((mod) => ({
      default: mod.ProductCreateModal,
    })),
  { ssr: false },
);

const ACCOUNT_FORM_STYLE = `input:checked + div { border-color: var(--accent); background-color: rgba(85,202,2,0.05); } input:checked + div .check-icon { opacity: 1; transform: scale(1); }`;

function AccountIdentitySection({
  providers,
  selectedProviderId,
  onProviderChange,
  onCreateProvider,
  emailValue,
  onEmailChange,
  passwordValue,
  onPasswordChange,
  isEdit,
}: {
  providers: Provider[];
  selectedProviderId: string;
  onProviderChange: (id: string) => void;
  onCreateProvider: () => void;
  emailValue: string;
  onEmailChange: (value: string) => void;
  passwordValue?: string;
  onPasswordChange?: (value: string) => void;
  isEdit?: boolean;
}) {
  return (
    <CreateFormSection
      title="Thông tin tài khoản"
      description="Giữ form gọn ở những trường nhập thật sự cần thiết để thao tác nhanh và ít nhầm hơn."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-1.5 lg:col-span-2">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            Email đăng nhập *
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
            <Input
              name="email"
              type="email"
              value={emailValue}
              onChange={(event) => onEmailChange(event.target.value)}
              className="pl-9"
              placeholder="admin@example.com"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <label className="mb-1 flex justify-between text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            <span>{isEdit ? "Mật khẩu mới (tùy chọn)" : "Mật khẩu"}</span>
            <span className="flex items-center gap-1 text-[9px] normal-case text-[var(--warning)]">
              <ShieldAlert className="size-3" />
              {isEdit ? "Bỏ trống nếu không đổi" : "Sẽ được mã hóa"}
            </span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
            <Input
              name="password"
              type="text"
              className="pl-9 font-mono"
              placeholder="••••••••"
              value={passwordValue ?? ""}
              onChange={(event) => onPasswordChange?.(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            Nguồn cung cấp (Provider) *
          </label>
          <div className="relative">
            <input type="hidden" name="provider" value={selectedProviderId} />
            <ProviderCombobox
              providers={providers}
              value={selectedProviderId}
              onChange={onProviderChange}
              onCreateNew={onCreateProvider}
            />
          </div>
        </div>
      </div>
    </CreateFormSection>
  );
}

function AccountAllocationSection({
  products,
  selectedProductIds,
  onProductsChange,
  onCreateProduct,
  maxSlots,
  onMaxSlotsChange,
  expiresAt,
  onExpiresAtChange,
}: {
  products: ProductService[];
  selectedProductIds: string[];
  onProductsChange: (ids: string[]) => void;
  onCreateProduct: () => void;
  maxSlots: number;
  onMaxSlotsChange: (value: number) => void;
  expiresAt: string;
  onExpiresAtChange: (value: string) => void;
}) {
  return (
    <CreateFormSection
      title="Cấu hình cấp phát"
      description="Giữ các trường về sản phẩm, slot và hạn dùng trong cùng một vùng để đọc và rà nhanh hơn."
    >
      <div className="grid gap-4">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            Sản phẩm khả dụng *
          </label>
          <ProductMultiCombobox
            products={products}
            value={selectedProductIds}
            onChange={onProductsChange}
            onCreateNew={onCreateProduct}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Sức chứa (tổng slots) *
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
              <Input
                name="maxSlots"
                type="number"
                min="1"
                className="pl-9 font-mono"
                value={maxSlots}
                onChange={(event) => onMaxSlotsChange(Number(event.target.value) || 1)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Ngày hết hạn *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
              <Input
                name="expiresAt"
                type="date"
                className="pl-9"
                value={expiresAt}
                onChange={(event) => onExpiresAtChange(event.target.value)}
                required
              />
            </div>
          </div>
        </div>
      </div>
    </CreateFormSection>
  );
}

function AccountCredentialsSection({
  credentials,
  onCredentialsChange,
  emailValue,
  passwordValue,
  productMap,
  selectedProductIds,
  onAutoFillResult,
}: {
  credentials: WarehouseCredential[];
  onCredentialsChange: (credentials: WarehouseCredential[]) => void;
  emailValue: string;
  passwordValue?: string;
  productMap: Map<string, string>;
  selectedProductIds: string[];
  onAutoFillResult?: (result: DuolingoAutoFillResult) => void;
}) {
  return (
    <CreateFormSection
      title="Dữ liệu đăng nhập"
      description="Danh sách credential được giữ riêng để dễ tái sử dụng và giảm lỗi khi cần đối soát."
    >
      <DynamicCredentialList
        credentials={credentials}
        onChange={onCredentialsChange}
        baseUsername={emailValue}
        basePassword={passwordValue}
        suggestDuolingo={selectedProductIds.some((productId) => productMap.get(productId)?.toLowerCase().includes("duolingo"))}
        onAutoFillResult={onAutoFillResult}
      />
    </CreateFormSection>
  );
}

function AccountCostFields({
  costDefaults,
}: {
  costDefaults?: {
    purchaseCostVnd?: number;
    purchaseDate?: string;
    purchaseSource?: string;
  };
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
          Giá mua (VND)
        </label>
        <Input
          name="purchaseCostVnd"
          type="number"
          min="0"
          className="font-mono"
          placeholder="0"
          defaultValue={costDefaults?.purchaseCostVnd ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
          Ngày mua
        </label>
        <Input
          name="purchaseDate"
          type="date"
          defaultValue={costDefaults?.purchaseDate?.substring(0, 10) ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
          Nguồn mua
        </label>
        <Input
          name="purchaseSource"
          type="text"
          placeholder="VD: Shopee, Tiki, nhà cung cấp A"
          defaultValue={costDefaults?.purchaseSource ?? ""}
        />
      </div>
    </div>
  );
}

interface AccountFormFieldsProps {
  providers: Provider[];
  products: ProductService[];
  selectedProviderId: string;
  selectedProductIds: string[];
  onProviderChange: (id: string) => void;
  onProductsChange: (ids: string[]) => void;
  onCreateProvider: () => void;
  onCreateProduct: () => void;
  productMap: Map<string, string>;
  credentials: WarehouseCredential[];
  onCredentialsChange: (c: WarehouseCredential[]) => void;
  emailValue: string;
  onEmailChange: (v: string) => void;
  passwordValue?: string;
  onPasswordChange?: (v: string) => void;
  onAutoFillResult?: (result: DuolingoAutoFillResult) => void;
  maxSlots: number;
  onMaxSlotsChange: (v: number) => void;
  expiresAt: string;
  onExpiresAtChange: (v: string) => void;
  isEdit?: boolean;
  costDefaults?: {
    purchaseCostVnd?: number;
    purchaseDate?: string;
    purchaseSource?: string;
  };
}

const AccountFormFields = memo(function AccountFormFields({
  providers,
  products,
  selectedProviderId,
  selectedProductIds,
  onProviderChange,
  onProductsChange,
  onCreateProvider,
  onCreateProduct,
  productMap,
  credentials,
  onCredentialsChange,
  emailValue,
  onEmailChange,
  passwordValue,
  onPasswordChange,
  onAutoFillResult,
  maxSlots,
  onMaxSlotsChange,
  expiresAt,
  onExpiresAtChange,
  isEdit,
  costDefaults,
}: AccountFormFieldsProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ACCOUNT_FORM_STYLE }} />
      <div className="grid gap-5">
        <AccountIdentitySection
          providers={providers}
          selectedProviderId={selectedProviderId}
          onProviderChange={onProviderChange}
          onCreateProvider={onCreateProvider}
          emailValue={emailValue}
          onEmailChange={onEmailChange}
          passwordValue={passwordValue}
          onPasswordChange={onPasswordChange}
          isEdit={isEdit}
        />
        <AccountAllocationSection
          products={products}
          selectedProductIds={selectedProductIds}
          onProductsChange={onProductsChange}
          onCreateProduct={onCreateProduct}
          maxSlots={maxSlots}
          onMaxSlotsChange={onMaxSlotsChange}
          expiresAt={expiresAt}
          onExpiresAtChange={onExpiresAtChange}
        />
        <AccountCredentialsSection
          credentials={credentials}
          onCredentialsChange={onCredentialsChange}
          emailValue={emailValue}
          passwordValue={passwordValue}
          productMap={productMap}
          selectedProductIds={selectedProductIds}
          onAutoFillResult={onAutoFillResult}
        />
        <AdvancedOptionsDisclosure title="Tùy chọn nâng cao">
          <AccountCostFields costDefaults={costDefaults} />
        </AdvancedOptionsDisclosure>
      </div>
    </>
  );
});

interface CreateSourceAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  providers: Provider[];
  products: ProductService[];
  productMap: Map<string, string>;
  onSubmit: (body: {
    email: string;
    provider: string;
    productIds: string[];
    maxSlots: number;
    expiresAt: string;
    credentials: WarehouseCredential[];
    purchaseCostVnd?: number;
    purchaseDate?: string;
    purchaseSource?: string;
  }) => Promise<void>;
}

const DEFAULT_EXPIRY = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function CreateSourceAccountModal({ isOpen, onClose, providers, products, productMap, onSubmit }: CreateSourceAccountModalProps) {
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<WarehouseCredential[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [maxSlots, setMaxSlots] = useState(5);
  const [expiresAt, setExpiresAt] = useState(DEFAULT_EXPIRY);
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleClose = useCallback(() => {
    onClose();
    setSelectedProviderId("");
    setSelectedProductIds([]);
    setCredentials([]);
    setEmail("");
    setPassword("");
    setMaxSlots(5);
    setExpiresAt(DEFAULT_EXPIRY);
    setSaving(false);
  }, [onClose]);

  const handleAutoFill = useCallback((result: DuolingoAutoFillResult) => {
    if (result.subscription?.maxFamilyMembers) {
      setMaxSlots(result.subscription.maxFamilyMembers);
    }
    if (result.subscription?.expiresAt) {
      try {
        setExpiresAt(new Date(result.subscription.expiresAt).toISOString().slice(0, 10));
      } catch {
        // ignore invalid date payloads from lookups
      }
    }
  }, []);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const rawPassword = (fd.get("password") as string)?.trim() || undefined;
    const body = {
      email: fd.get("email") as string,
      provider: fd.get("provider") as string,
      productIds: fd.getAll("productIds") as string[],
      maxSlots,
      expiresAt,
      credentials,
      ...(rawPassword ? { password: rawPassword } : {}),
      ...(fd.get("purchaseCostVnd") ? { purchaseCostVnd: Number(fd.get("purchaseCostVnd")) } : {}),
      ...(fd.get("purchaseDate") ? { purchaseDate: fd.get("purchaseDate") as string } : {}),
      ...(fd.get("purchaseSource") ? { purchaseSource: fd.get("purchaseSource") as string } : {}),
    };

    if (!body.email || !body.provider) {
      appToast.error("Email và nhà cung cấp là bắt buộc.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit(body);
      handleClose();
      appToast.success("Tạo tài khoản nguồn thành công.");
    } catch {
      appToast.error("Không thể tạo tài khoản nguồn.");
    } finally {
      setSaving(false);
    }
  }, [credentials, expiresAt, handleClose, maxSlots, onSubmit]);

  return (
    <>
      <CreateFlowDialog
        isOpen={isOpen}
        onClose={handleClose}
        title="Thêm tài khoản nguồn"
        description="Giữ layout nhập liệu rộng và gọn, tối ưu cho thao tác nhanh trên màn hình lớn lẫn mobile."
        size="2xl"
        footer={
          <CreateActionFooter
            primaryLabel="Tạo tài khoản"
            onPrimary={() => {
              const form = document.getElementById("create-account-form") as HTMLFormElement | null;
              form?.requestSubmit();
            }}
            onCancel={handleClose}
            cancelLabel="Hủy"
            pending={saving}
            disabled={saving}
          />
        }
      >
        <form id="create-account-form" onSubmit={handleSubmit} className="grid gap-5">
          <AccountFormFields
            providers={providers}
            products={products}
            selectedProviderId={selectedProviderId}
            selectedProductIds={selectedProductIds}
            onProviderChange={setSelectedProviderId}
            onProductsChange={setSelectedProductIds}
            onCreateProvider={() => setIsProviderModalOpen(true)}
            onCreateProduct={() => setIsProductModalOpen(true)}
            productMap={productMap}
            credentials={credentials}
            onCredentialsChange={setCredentials}
            emailValue={email}
            onEmailChange={setEmail}
            passwordValue={password}
            onPasswordChange={setPassword}
            maxSlots={maxSlots}
            onMaxSlotsChange={setMaxSlots}
            expiresAt={expiresAt}
            onExpiresAtChange={setExpiresAt}
            onAutoFillResult={handleAutoFill}
          />
        </form>
      </CreateFlowDialog>

      {isProviderModalOpen && (
        <CustomerCreateModalLazy
          isOpen={isProviderModalOpen}
          onClose={() => setIsProviderModalOpen(false)}
          defaultEntityType="supplier"
          onSuccess={(newProvider) => setSelectedProviderId(newProvider.id)}
        />
      )}

      {isProductModalOpen && (
        <ProductCreateModalLazy
          isOpen={isProductModalOpen}
          onClose={() => setIsProductModalOpen(false)}
          onSuccess={(newProduct) => {
            setSelectedProductIds((current) =>
              current.includes(newProduct.id) ? current : [...current, newProduct.id],
            );
          }}
        />
      )}
    </>
  );
}

interface EditSourceAccountModalProps {
  account: SourceAccount | null;
  onClose: () => void;
  providers: Provider[];
  products: ProductService[];
  productMap: Map<string, string>;
  onSubmit: (body: {
    id: string;
    email: string;
    provider: string;
    productIds: string[];
    maxSlots: number;
    expiresAt: string;
    credentials: WarehouseCredential[];
    purchaseCostVnd?: number;
    purchaseDate?: string;
    purchaseSource?: string;
  }) => Promise<void>;
}

export function EditSourceAccountModal({ account, onClose, providers, products, productMap, onSubmit }: EditSourceAccountModalProps) {
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<WarehouseCredential[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [maxSlots, setMaxSlots] = useState(5);
  const [expiresAt, setExpiresAt] = useState("");
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [initialized, setInitialized] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const decryptQuery = useSourceAccountDecrypt(account?.id ?? "", !!account);

  useEffect(() => {
    if (account && initialized !== account.id) {
      setSelectedProviderId(account.provider);
      setSelectedProductIds(account.productIds);
      setInitialized(account.id);
      setCredentials(account.credentials ?? []);
      setEmail(account.email);
      setPassword("");
      setMaxSlots(account.maxSlots);
      setExpiresAt(account.expiresAt?.substring(0, 10) ?? "");
    }
  }, [account, initialized]);

  useEffect(() => {
    if (!account || !decryptQuery.data || decryptQuery.data.id !== account.id) {
      return;
    }

    if (decryptQuery.data.password) {
      setPassword(decryptQuery.data.password);
    }
    if (decryptQuery.data.credentials?.length) {
      setCredentials(decryptQuery.data.credentials);
    }
  }, [account, decryptQuery.data]);

  const handleClose = useCallback(() => {
    onClose();
    setInitialized(null);
    setSaving(false);
  }, [onClose]);

  const handleAutoFill = useCallback((result: DuolingoAutoFillResult) => {
    if (result.subscription?.maxFamilyMembers) {
      setMaxSlots(result.subscription.maxFamilyMembers);
    }
    if (result.subscription?.expiresAt) {
      try {
        setExpiresAt(new Date(result.subscription.expiresAt).toISOString().slice(0, 10));
      } catch {
        // ignore invalid date payloads from lookups
      }
    }
  }, []);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!account) {
      return;
    }

    const fd = new FormData(event.currentTarget);
    const rawPassword = (fd.get("password") as string)?.trim() || undefined;
    const body = {
      id: account.id,
      email: fd.get("email") as string,
      provider: fd.get("provider") as string,
      productIds: fd.getAll("productIds") as string[],
      maxSlots,
      expiresAt,
      credentials,
      ...(rawPassword ? { password: rawPassword } : {}),
      ...(fd.get("purchaseCostVnd") ? { purchaseCostVnd: Number(fd.get("purchaseCostVnd")) } : {}),
      ...(fd.get("purchaseDate") ? { purchaseDate: fd.get("purchaseDate") as string } : {}),
      ...(fd.get("purchaseSource") ? { purchaseSource: fd.get("purchaseSource") as string } : {}),
    };

    if (!body.email || !body.provider) {
      appToast.error("Email và nhà cung cấp là bắt buộc.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit(body);
      handleClose();
      appToast.success("Cập nhật tài khoản nguồn thành công.");
    } catch {
      appToast.error("Không thể cập nhật tài khoản nguồn.");
    } finally {
      setSaving(false);
    }
  }, [account, credentials, expiresAt, handleClose, maxSlots, onSubmit]);

  return (
    <>
      <CreateFlowDialog
        isOpen={!!account}
        onClose={handleClose}
        title="Sửa thông tin tài khoản nguồn"
        description="Nhập nhanh phần cần đổi, còn các phần nâng cao sẽ được giữ gọn ở dưới để giảm rối mắt."
        size="2xl"
        footer={
          <CreateActionFooter
            primaryLabel="Lưu thay đổi"
            onPrimary={() => {
              const form = document.getElementById("edit-account-form") as HTMLFormElement | null;
              form?.requestSubmit();
            }}
            onCancel={handleClose}
            cancelLabel="Hủy"
            pending={saving}
            disabled={saving}
          />
        }
      >
        {account ? (
          <form id="edit-account-form" onSubmit={handleSubmit} className="grid gap-5">
            <AccountFormFields
              providers={providers}
              products={products}
              selectedProviderId={selectedProviderId}
              selectedProductIds={selectedProductIds}
              onProviderChange={setSelectedProviderId}
              onProductsChange={setSelectedProductIds}
              onCreateProvider={() => setIsProviderModalOpen(true)}
              onCreateProduct={() => setIsProductModalOpen(true)}
              productMap={productMap}
              credentials={credentials}
              onCredentialsChange={setCredentials}
              emailValue={email}
              onEmailChange={setEmail}
              passwordValue={password}
              onPasswordChange={setPassword}
              maxSlots={maxSlots}
              onMaxSlotsChange={setMaxSlots}
              expiresAt={expiresAt}
              onExpiresAtChange={setExpiresAt}
              onAutoFillResult={handleAutoFill}
              isEdit
              costDefaults={{
                purchaseCostVnd: account.purchaseCostVnd,
                purchaseDate: account.purchaseDate,
                purchaseSource: account.purchaseSource,
              }}
            />
          </form>
        ) : null}
      </CreateFlowDialog>

      {isProviderModalOpen && (
        <CustomerCreateModalLazy
          isOpen={isProviderModalOpen}
          onClose={() => setIsProviderModalOpen(false)}
          defaultEntityType="supplier"
          onSuccess={(newProvider) => setSelectedProviderId(newProvider.id)}
        />
      )}

      {isProductModalOpen && (
        <ProductCreateModalLazy
          isOpen={isProductModalOpen}
          onClose={() => setIsProductModalOpen(false)}
          onSuccess={(newProduct) => {
            setSelectedProductIds((current) =>
              current.includes(newProduct.id) ? current : [...current, newProduct.id],
            );
          }}
        />
      )}
    </>
  );
}
