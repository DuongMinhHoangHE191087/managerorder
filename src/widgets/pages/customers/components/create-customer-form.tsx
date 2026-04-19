"use client";

import { memo, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Bolt, ShieldCheck, Store, User } from "lucide-react";
import type { ContactInfo } from "@/lib/domain/types";
import { appToast } from "@/shared/ui/app-toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { DynamicContactList } from "@/shared/ui/dynamic-contact-list";
import { ChoiceCard, ChoiceGrid, FieldLabel, FormSection } from "@/shared/ui/form-primitives";
import { SlideUp } from "@/shared/ui/animations";
import { useCreateCustomer } from "@/widgets/pages/customers/hooks/use-customers";

type CustomerTier = "regular" | "vip" | "agency";

const CUSTOMER_TYPE_OPTIONS = [
  { value: "regular", label: "Khách lẻ", desc: "Mua lẻ / chăm sóc riêng", icon: <User className="size-4" /> },
  { value: "vip", label: "Bán sỉ / VIP", desc: "Khách lớn hoặc đại lý", icon: <Store className="size-4" /> },
  { value: "agency", label: "Đại lý", desc: "Đối tác phân phối", icon: <Briefcase className="size-4" /> },
] as const satisfies ReadonlyArray<{
  value: CustomerTier;
  label: string;
  desc: string;
  icon: ReactNode;
}>;

const CustomerFormHeader = memo(function CustomerFormHeader() {
  return (
    <div className="border-b border-[var(--border-soft)] bg-[var(--surface-light)] px-6 py-5">
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
          <User className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[18px] font-black tracking-tight text-[var(--fg-base)]">
            Hồ sơ khách hàng mới
          </h2>
          <p className="mt-1 text-[13px] font-medium text-[var(--fg-muted)]">
            Điền thông tin định danh, phân loại và các kênh liên hệ chính.
          </p>
        </div>
      </div>
    </div>
  );
});

const CustomerIdentitySection = memo(function CustomerIdentitySection({
  name,
  nameError,
  onNameChange,
}: {
  name: string;
  nameError: string;
  onNameChange: (value: string) => void;
}) {
  return (
    <FormSection title="Thông tin chính" description="Tên khách hàng và phân loại hồ sơ.">
      <div className="space-y-3">
        <FieldLabel required icon={<User className="size-3" />}>
          Họ và tên
        </FieldLabel>
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Ví dụ: Nguyễn Văn A"
        />
        {nameError ? <p className="text-xs font-medium text-[var(--danger)]">{nameError}</p> : null}
      </div>
    </FormSection>
  );
});

const CustomerTypeSection = memo(function CustomerTypeSection({
  tier,
  onTierChange,
}: {
  tier: CustomerTier;
  onTierChange: (value: CustomerTier) => void;
}) {
  return (
    <div className="space-y-3">
      <FieldLabel icon={<ShieldCheck className="size-3" />}>Phân loại</FieldLabel>
      <ChoiceGrid className="grid-cols-1 sm:grid-cols-3">
        {CUSTOMER_TYPE_OPTIONS.map((option) => (
          <ChoiceCard
            key={option.value}
            selected={tier === option.value}
            title={option.label}
            description={option.desc}
            icon={option.icon}
            onClick={() => onTierChange(option.value)}
          />
        ))}
      </ChoiceGrid>
    </div>
  );
});

const CustomerContactsSection = memo(function CustomerContactsSection({
  contacts,
  onContactsChange,
  onFacebookResolved,
}: {
  contacts: ContactInfo[];
  onContactsChange: (contacts: ContactInfo[]) => void;
  onFacebookResolved: (id: string, fbName: string) => void;
}) {
  return (
    <DynamicContactList
      contacts={contacts}
      onChange={onContactsChange}
      onFacebookResolved={onFacebookResolved}
      title="Thông tin liên hệ"
      description="Zalo, Facebook, Telegram, Email, SĐT..."
    />
  );
});

const CustomerActionsSection = memo(function CustomerActionsSection({
  isSubmitting,
  onCancel,
}: {
  isSubmitting: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="border-t border-[var(--border-soft)] bg-[var(--surface-light)] px-6 py-4">
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={onCancel}
        >
          HỦY BỎ
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="w-full sm:w-auto"
          isLoading={isSubmitting}
          disabled={isSubmitting}
        >
          LƯU KHÁCH HÀNG
          {!isSubmitting ? <Bolt className="ml-2 size-4" /> : null}
        </Button>
      </div>
    </div>
  );
});

export function CreateCustomerForm() {
  const router = useRouter();
  const { mutateAsync: createCustomer } = useCreateCustomer();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [name, setName] = useState("");
  const [tier, setTier] = useState<CustomerTier>("regular");
  const [nameError, setNameError] = useState("");
  const nameRef = useRef(name);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  const handleFacebookResolved = useCallback((_id: string, fbName: string) => {
    void _id;
    if (!nameRef.current.trim() && fbName) {
      setName(fbName);
    }
  }, []);

  const handleCancel = useCallback(() => {
    router.push("/customers");
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setNameError("Vui lòng nhập họ tên");
      return;
    }

    setNameError("");
    setIsSubmitting(true);
    try {
      await createCustomer({
        name: name.trim(),
        contacts,
        tier,
      });
      appToast.success("Đã tạo khách hàng mới thành công!");
      router.push("/customers");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lỗi tạo khách hàng";
      appToast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl text-[var(--fg-base)]">
      <SlideUp delay={0.1} className="app-card overflow-hidden border border-[var(--border-soft)] shadow-sm">
        <CustomerFormHeader />

        <div className="space-y-4 p-6">
          <CustomerIdentitySection
            name={name}
            nameError={nameError}
            onNameChange={setName}
          />
          <CustomerTypeSection
            tier={tier}
            onTierChange={setTier}
          />
          <CustomerContactsSection
            contacts={contacts}
            onContactsChange={setContacts}
            onFacebookResolved={handleFacebookResolved}
          />
        </div>

        <CustomerActionsSection
          isSubmitting={isSubmitting}
          onCancel={handleCancel}
        />
      </SlideUp>
    </form>
  );
}
