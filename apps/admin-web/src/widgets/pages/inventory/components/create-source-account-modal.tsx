"use client";

import { Server, Mail, Lock, ShieldAlert, Package, Users, Calendar, DollarSign } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { memo, useCallback, useState, useEffect, type ChangeEvent } from "react";
import dynamic from "next/dynamic";

import { Modal } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { DynamicCredentialList } from "@/widgets/pages/inventory/components/dynamic-credential-list";
import type { DuolingoAutoFillResult } from "@/widgets/pages/inventory/components/dynamic-credential-list";
import { ProviderCombobox, ProductMultiCombobox } from "@/widgets/pages/inventory/components/comboboxes";
import type { SourceAccount, WarehouseCredential, Provider, ProductService } from "@/lib/domain/types";
import { useSourceAccountDecrypt } from "@/widgets/pages/inventory/hooks/use-source-accounts";

const CustomerCreateModalLazy = dynamic(
  () =>
    import("@/widgets/pages/customers/components/customer-create-modal").then((mod) => ({
      default: mod.CustomerCreateModal,
    })),
  { ssr: false }
);

const ProductCreateModalLazy = dynamic(
  () =>
    import("@/widgets/pages/products/components/product-create-modal").then((mod) => ({
      default: mod.ProductCreateModal,
    })),
  { ssr: false }
);

const ACCOUNT_FORM_STYLE = `input:checked + div { border-color: var(--accent); background-color: rgba(85,202,2,0.05); } input:checked + div .check-icon { opacity: 1; transform: scale(1); }`;

const AccountIdentitySection = memo(function AccountIdentitySection({
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
    <div className="space-y-4">
      <h3 className="mb-4 flex items-center gap-2 border-b border-[var(--border-soft)] pb-2 text-[13px] font-bold text-[var(--fg-base)]">
        <Server className="size-4 text-[var(--accent)]" />
        Thông tin tài khoản
      </h3>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-1.5 lg:col-span-2">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Email đăng nhập *</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
            <Input
              name="email"
              type="email"
              value={emailValue}
              onChange={(e) => onEmailChange(e.target.value)}
              className="pl-9"
              placeholder="admin@example.com"
              required
            />
          </div>
        </div>
        <div className="space-y-1.5 lg:col-span-2">
          <label className="mb-1 flex justify-between text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            <span>{isEdit ? "Mật khẩu mới (Tùy chọn)" : "Mật khẩu"}</span>
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
              {...(onPasswordChange
                ? { value: passwordValue ?? "", onChange: (e: ChangeEvent<HTMLInputElement>) => onPasswordChange(e.target.value) }
                : {})}
            />
          </div>
        </div>
        <div className="space-y-1.5 lg:col-span-2">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Nguồn cung cấp (Provider) *</label>
          <div className="relative">
            <input type="hidden" name="provider" value={selectedProviderId} />
            <ProviderCombobox providers={providers} value={selectedProviderId} onChange={onProviderChange} onCreateNew={onCreateProvider} />
          </div>
        </div>
      </div>
    </div>
  );
});

const AccountAllocationSection = memo(function AccountAllocationSection({
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
    <div className="space-y-4">
      <h3 className="mb-4 mt-6 flex items-center gap-2 border-b border-[var(--border-soft)] pb-2 text-[13px] font-bold text-[var(--fg-base)]">
        <Package className="size-4 text-[#ff9500]" />
        Cấu hình cấp phát
      </h3>
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Sản phẩm khả dụng *</label>
          <ProductMultiCombobox products={products} value={selectedProductIds} onChange={onProductsChange} onCreateNew={onCreateProduct} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Sức chứa (Tổng slots) *</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
              <Input
                name="maxSlots"
                type="number"
                min="1"
                className="pl-9 font-mono"
                value={maxSlots}
                onChange={(e) => onMaxSlotsChange(Number(e.target.value) || 1)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Ngày hết hạn *</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
              <Input
                name="expiresAt"
                type="date"
                className="pl-9"
                value={expiresAt}
                onChange={(e) => onExpiresAtChange(e.target.value)}
                required
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const AccountCredentialsSection = memo(function AccountCredentialsSection({
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
    <div className="pt-2">
      <DynamicCredentialList
        credentials={credentials}
        onChange={onCredentialsChange}
        baseUsername={emailValue}
        basePassword={passwordValue}
        suggestDuolingo={selectedProductIds.some((pid) => productMap.get(pid)?.toLowerCase().includes("duolingo"))}
        onAutoFillResult={onAutoFillResult}
      />
    </div>
  );
});

const AccountCostSection = memo(function AccountCostSection({
  costDefaults,
}: {
  costDefaults?: {
    purchaseCostVnd?: number;
    purchaseDate?: string;
    purchaseSource?: string;
  };
}) {
  return (
    <div className="space-y-4">
      <h3 className="mb-4 mt-6 flex items-center gap-2 border-b border-[var(--border-soft)] pb-2 text-[13px] font-bold text-[var(--fg-base)]">
        <DollarSign className="size-4 text-emerald-500" />
        Chi phí mua hàng (Tùy chọn)
      </h3>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Giá mua (VND)</label>
          <Input name="purchaseCostVnd" type="number" min="0" className="font-mono" placeholder="0" defaultValue={costDefaults?.purchaseCostVnd ?? ""} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Ngày mua</label>
          <Input name="purchaseDate" type="date" defaultValue={costDefaults?.purchaseDate?.substring(0, 10) ?? ""} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Nguồn mua</label>
          <Input name="purchaseSource" type="text" placeholder="VD: Shopee, Tiki, Nhà cung cấp A" defaultValue={costDefaults?.purchaseSource ?? ""} />
        </div>
      </div>
    </div>
  );
});

/* ─── Shared form fields for create & edit ─────────────────────────────── */
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
  // Controlled maxSlots & expiresAt
  maxSlots: number;
  onMaxSlotsChange: (v: number) => void;
  expiresAt: string;
  onExpiresAtChange: (v: string) => void;
  /** Is edit mode? */
  isEdit?: boolean;
  /** Cost defaults for edit mode */
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
      <AccountCostSection costDefaults={costDefaults} />
    </>
  );
});

/* ─── CREATE MODAL ─────────────────────────────────────────────────────── */
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

  const handleClose = () => {
    onClose();
    setSelectedProviderId("");
    setSelectedProductIds([]);
    setCredentials([]);
    setEmail("");
    setPassword("");
    setMaxSlots(5);
    setExpiresAt(DEFAULT_EXPIRY);
  };

  const handleAutoFill = useCallback((result: DuolingoAutoFillResult) => {
    // Auto-fill maxSlots from family plan
    if (result.subscription?.maxFamilyMembers) {
      setMaxSlots(result.subscription.maxFamilyMembers);
    }
    // Auto-fill expiresAt from subscription
    if (result.subscription?.expiresAt) {
      try {
        const expDate = new Date(result.subscription.expiresAt).toISOString().slice(0, 10);
        setExpiresAt(expDate);
      } catch { /* ignore invalid date */ }
    }
  }, []);

  const handleOpenProviderModal = useCallback(() => {
    setIsProviderModalOpen(true);
  }, []);

  const handleOpenProductModal = useCallback(() => {
    setIsProductModalOpen(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
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
      appToast.error("Email và nhà cung cấp là bắt buộc");
      return;
    }

    try {
      await onSubmit(body);
      handleClose();
      appToast.success("Tạo tài khoản nguồn thành công!");
    } catch {
      appToast.error("Lỗi tạo tài khoản nguồn");
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} title="Thêm Tài Khoản Nguồn" size="2xl"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={handleClose} className="w-full sm:w-auto">Hủy</Button>
            <Button variant="primary" type="submit" form="create-account-form" className="w-full sm:w-auto">Tạo Tài Khoản</Button>
          </div>
        }
      >
        <form id="create-account-form" onSubmit={handleSubmit} className="space-y-8">
          <AccountFormFields
            providers={providers}
            products={products}
            selectedProviderId={selectedProviderId}
            selectedProductIds={selectedProductIds}
            onProviderChange={setSelectedProviderId}
            onProductsChange={setSelectedProductIds}
            onCreateProvider={handleOpenProviderModal}
            onCreateProduct={handleOpenProductModal}
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
      </Modal>

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
            if (!selectedProductIds.includes(newProduct.id)) {
              setSelectedProductIds(prev => [...prev, newProduct.id]);
            }
          }}
        />
      )}
    </>
  );
}

/* ─── EDIT MODAL ───────────────────────────────────────────────────────── */
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
  const decryptQuery = useSourceAccountDecrypt(account?.id ?? "", !!account);

  // Sync state when account changes; decrypted secrets hydrate from shared query
  useEffect(() => {
    if (account && initialized !== account.id) {
      Promise.resolve().then(() => {
        setSelectedProviderId(account.provider);
        setSelectedProductIds(account.productIds);
        setInitialized(account.id);
        setCredentials(account.credentials ?? []);
        setEmail(account.email);
        setPassword("");
        setMaxSlots(account.maxSlots);
        setExpiresAt(account.expiresAt?.substring(0, 10) ?? "");
      });
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

  const handleClose = () => {
    onClose();
    setInitialized(null);
  };

  const handleAutoFill = useCallback((result: DuolingoAutoFillResult) => {
    if (result.subscription?.maxFamilyMembers) {
      setMaxSlots(result.subscription.maxFamilyMembers);
    }
    if (result.subscription?.expiresAt) {
      try {
        const expDate = new Date(result.subscription.expiresAt).toISOString().slice(0, 10);
        setExpiresAt(expDate);
      } catch { /* ignore */ }
    }
  }, []);

  const handleOpenProviderModal = useCallback(() => {
    setIsProviderModalOpen(true);
  }, []);

  const handleOpenProductModal = useCallback(() => {
    setIsProductModalOpen(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!account) return;
    const fd = new FormData(e.currentTarget);
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
      appToast.error("Email và nhà cung cấp là bắt buộc");
      return;
    }

    try {
      await onSubmit(body);
      handleClose();
      appToast.success("Cập nhật tài khoản nguồn thành công!");
    } catch {
      appToast.error("Lỗi cập nhật tài khoản nguồn");
    }
  };

  return (
    <>
      <Modal isOpen={!!account} onClose={handleClose} title="Sửa Thông Tin Tài Khoản Nguồn" size="2xl"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={handleClose} className="w-full sm:w-auto">Hủy</Button>
            <Button variant="primary" type="submit" form="edit-account-form" className="w-full sm:w-auto">Lưu Thay Đổi</Button>
          </div>
        }
      >
        {account && (
          <form id="edit-account-form" onSubmit={handleSubmit} className="space-y-8">
            <AccountFormFields
              providers={providers}
              products={products}
              selectedProviderId={selectedProviderId}
              selectedProductIds={selectedProductIds}
              onProviderChange={setSelectedProviderId}
              onProductsChange={setSelectedProductIds}
              onCreateProvider={handleOpenProviderModal}
              onCreateProduct={handleOpenProductModal}
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
              costDefaults={{ purchaseCostVnd: account.purchaseCostVnd, purchaseDate: account.purchaseDate, purchaseSource: account.purchaseSource }}
            />
          </form>
        )}
      </Modal>

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
            if (!selectedProductIds.includes(newProduct.id)) {
              setSelectedProductIds(prev => [...prev, newProduct.id]);
            }
          }}
        />
      )}
    </>
  );
}
