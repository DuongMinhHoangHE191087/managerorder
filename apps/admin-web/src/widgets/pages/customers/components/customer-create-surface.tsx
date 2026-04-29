"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Store,
  User,
  Users,
} from "lucide-react";
import type { ContactInfo, Provider } from "@/lib/domain/types";
import { appToast } from "@/shared/ui/app-toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  ChoiceCard,
  ChoiceGrid,
  FieldLabel,
  FormSection,
} from "@/shared/ui/form-primitives";
import { CreateFlowShell } from "@/shared/ui/create-flow-shell";
import type { CreateCustomerResult, DuplicateCandidate } from "@/shared/types/customers";
import { DynamicContactList } from "@/shared/ui/dynamic-contact-list";
import { CustomerTagPicker } from "@/widgets/pages/customers/components/customer-tag-picker";
import { DuplicateWarning } from "@/widgets/pages/customers/components/duplicate-warning";
import { useCreateCustomer } from "@/widgets/pages/customers/hooks/use-customers";
import { useCreateProvider } from "@/widgets/pages/providers/hooks/use-providers";
import { useCheckDuplicates } from "@/widgets/pages/customers/hooks/use-check-duplicates";
import { vi } from "@/shared/messages/vi";

export type EntityType = "customer" | "supplier" | "both";
type CustomerType = "retail" | "wholesale" | "agency";
type ProviderTier = "regular" | "vip";

interface CustomerCreateSurfaceProps {
  mode: "page" | "modal";
  onCancel: () => void;
  onSuccess: (customer: CreateCustomerResult) => void;
  initialName?: string;
  defaultEntityType?: EntityType;
}

const ENTITY_TYPE_OPTIONS = [
  {
    value: "customer",
    label: vi.customers.createModal.entityTypes.customer.label,
    desc: vi.customers.createModal.entityTypes.customer.desc,
    icon: <User className="size-4" />,
  },
  {
    value: "supplier",
    label: vi.customers.createModal.entityTypes.supplier.label,
    desc: vi.customers.createModal.entityTypes.supplier.desc,
    icon: <Building2 className="size-4" />,
  },
  {
    value: "both",
    label: vi.customers.createModal.entityTypes.both.label,
    desc: vi.customers.createModal.entityTypes.both.desc,
    icon: <Users className="size-4" />,
  },
] as const satisfies ReadonlyArray<{
  value: EntityType;
  label: string;
  desc: string;
  icon: ReactNode;
}>;

const CUSTOMER_TYPE_OPTIONS = [
  {
    value: "retail",
    label: vi.customers.editModal.options.retail.label,
    desc: vi.customers.editModal.options.retail.desc,
    icon: <User className="size-4" />,
  },
  {
    value: "wholesale",
    label: vi.customers.editModal.options.wholesale.label,
    desc: vi.customers.editModal.options.wholesale.desc,
    icon: <Store className="size-4" />,
  },
  {
    value: "agency",
    label: vi.customers.editModal.options.agency.label,
    desc: vi.customers.editModal.options.agency.desc,
    icon: <Briefcase className="size-4" />,
  },
] as const satisfies ReadonlyArray<{
  value: CustomerType;
  label: string;
  desc: string;
  icon: ReactNode;
}>;

const PROVIDER_TIER_OPTIONS = [
  {
    value: "regular",
    label: vi.customers.createModal.tierOptions.regular.label,
    desc: vi.customers.createModal.tierOptions.regular.desc,
  },
  {
    value: "vip",
    label: vi.customers.createModal.tierOptions.vip.label,
    desc: vi.customers.createModal.tierOptions.vip.desc,
  },
] as const satisfies ReadonlyArray<{
  value: ProviderTier;
  label: string;
  desc: string;
}>;

function createInitialContact(): ContactInfo {
  return {
    id: crypto.randomUUID(),
    type: "phone",
    value: "",
    isPrimary: true,
  };
}

function getCustomerTier(customerType: CustomerType) {
  if (customerType === "retail") {
    return "regular" as const;
  }

  if (customerType === "agency") {
    return "agency" as const;
  }

  return "vip" as const;
}

function getEntityHeadline(entityType: EntityType) {
  if (entityType === "supplier") {
    return vi.customers.createModal.titleSupplier;
  }

  if (entityType === "both") {
    return vi.customers.createModal.titleBoth;
  }

  return vi.customers.createModal.titleCustomer;
}

function getEntityDescription(entityType: EntityType) {
  if (entityType === "supplier") {
    return "Tạo hồ sơ nhà cung cấp với liên hệ, mức độ hợp tác và ghi chú vận hành để dùng lại ở kho, nhập hàng và các luồng cấp phát.";
  }

  if (entityType === "both") {
    return "Ghi nhận một đối tác vừa mua dịch vụ vừa cung cấp tài khoản, giúp đội vận hành theo dõi xuyên suốt trên customer, provider và các luồng premium.";
  }

  return "Mở hồ sơ khách hàng theo chuẩn vận hành mới, gom đầy đủ phân loại, liên hệ, nhãn và bối cảnh để các trang khác không phải vá thủ công.";
}

export function CustomerCreateSurface({
  mode,
  onCancel,
  onSuccess,
  initialName = "",
  defaultEntityType = "customer",
}: CustomerCreateSurfaceProps) {
  const [name, setName] = useState(initialName);
  const [entityType, setEntityType] = useState<EntityType>(defaultEntityType);
  const [customerType, setCustomerType] = useState<CustomerType>("retail");
  const [providerTier, setProviderTier] = useState<ProviderTier>("regular");
  const [contacts, setContacts] = useState<ContactInfo[]>([createInitialContact()]);
  const [notes, setNotes] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [saving, setSaving] = useState(false);

  const duplicateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { mutateAsync: createCustomer } = useCreateCustomer();
  const { mutateAsync: createProvider } = useCreateProvider();
  const checkDuplicates = useCheckDuplicates();

  useEffect(() => {
    return () => {
      if (duplicateTimerRef.current) {
        clearTimeout(duplicateTimerRef.current);
      }
    };
  }, []);

  const handleNameChange = useCallback(
    (value: string) => {
      setName(value);
      setShowDuplicateWarning(false);

      if (duplicateTimerRef.current) {
        clearTimeout(duplicateTimerRef.current);
      }

      if (value.trim().length < 3 || entityType === "supplier") {
        setDuplicates([]);
        return;
      }

      duplicateTimerRef.current = setTimeout(async () => {
        try {
          const result = await checkDuplicates.mutateAsync({ name: value.trim() });
          setDuplicates(result);
          setShowDuplicateWarning(result.length > 0);
        } catch {
          setDuplicates([]);
        }
      }, 500);
    },
    [checkDuplicates, entityType],
  );

  const handleFacebookResolved = useCallback((_: string, facebookName: string) => {
    setName((previous) => (previous.trim() ? previous : facebookName));
  }, []);

  const activeContacts = useMemo(
    () =>
      contacts
        .filter((contact) => contact.value.trim())
        .map((contact) => ({
          type: contact.type,
          value: contact.value.trim(),
          isPrimary: Boolean(contact.isPrimary),
          facebookId: contact.facebookId,
          facebookName: contact.facebookName,
        })),
    [contacts],
  );

  const saveDisabled = saving || !name.trim();

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      appToast.error(vi.customers.createModal.errors.enterName);
      return;
    }

    if (activeContacts.length === 0) {
      appToast.error("Cần ít nhất một thông tin liên hệ hợp lệ trước khi tạo mới.");
      return;
    }

    setSaving(true);
    try {
      let createdCustomer: CreateCustomerResult | null = null;
      let createdProvider: Provider | null = null;

      if (entityType === "customer" || entityType === "both") {
        createdCustomer = (await createCustomer({
          name: trimmedName,
          tier: getCustomerTier(customerType),
          customerType,
          contacts: activeContacts,
          notes: notes.trim() || undefined,
          tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        })) as CreateCustomerResult;
      }

      if (entityType === "supplier" || entityType === "both") {
        createdProvider = (await createProvider({
          name: trimmedName,
          tier: providerTier,
          reliabilityScore: 100,
          contacts: activeContacts,
        })) as unknown as Provider;
      }

      const result = createdCustomer || createdProvider;
      if (!result) {
        throw new Error(vi.customers.createModal.errors.createEither);
      }

      appToast.success(
        vi.customers.createModal.success(
          entityType === "supplier"
            ? vi.customers.createModal.successLabels.supplier
            : entityType === "both"
              ? vi.customers.createModal.successLabels.both
              : vi.customers.createModal.successLabels.customer,
          result.name,
        ),
      );
      onSuccess(result as CreateCustomerResult);
    } catch (error: unknown) {
      appToast.error(
        error instanceof Error ? error.message : vi.customers.createModal.errors.network,
      );
    } finally {
      setSaving(false);
    }
  }, [
    activeContacts,
    createCustomer,
    createProvider,
    customerType,
    entityType,
    name,
    notes,
    onSuccess,
    providerTier,
    selectedTagIds,
  ]);

  return (
    <div className="text-[var(--fg-base)]">
      <CreateFlowShell
        title={getEntityHeadline(entityType)}
        description={getEntityDescription(entityType)}
        className={mode === "page" ? "mx-auto max-w-6xl" : "max-h-[92vh]"}
        scrollBody={mode === "modal"}
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={onCancel}
              className="h-12 justify-center"
            >
              {vi.common.cancel}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              isLoading={saving}
              disabled={saveDisabled}
              onClick={() => void handleSave()}
              className="h-12 justify-center"
            >
              {saving ? (
                vi.customers.createModal.buttons.saving
              ) : (
                <>
                  <Sparkles className="size-4" />
                  {vi.customers.createModal.buttons.createAndFinish}
                </>
              )}
            </Button>
          </div>
        }
      >
          <FormSection
            title={vi.customers.createModal.sections.type}
            description={vi.customers.createModal.sections.typeDescription}
          >
            <ChoiceGrid className="grid-cols-1 sm:grid-cols-3">
              {ENTITY_TYPE_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  selected={entityType === option.value}
                  title={option.label}
                  description={option.desc}
                  icon={option.icon}
                  onClick={() => setEntityType(option.value)}
                />
              ))}
            </ChoiceGrid>
          </FormSection>

          <FormSection
            title="Thông tin nhận diện"
            description="Chuẩn hóa phần tên, phân loại và các trường cốt lõi để dùng lại nhất quán giữa customer, provider và các màn tìm kiếm."
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="space-y-3">
                <FieldLabel required icon={<User className="size-3" />}>
                  {entityType === "supplier"
                    ? vi.customers.createModal.sections.supplierName
                    : vi.customers.createModal.sections.name}
                </FieldLabel>
                <Input
                  autoFocus
                  value={name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSave();
                    }
                  }}
                  placeholder={
                    entityType === "supplier"
                      ? vi.customers.createModal.placeholders.supplierName
                      : vi.customers.createModal.placeholders.customerName
                  }
                  className="h-12 text-[15px] font-semibold"
                />
                {showDuplicateWarning && duplicates.length > 0 ? (
                  <DuplicateWarning
                    duplicates={duplicates}
                    onContinue={() => setShowDuplicateWarning(false)}
                    onCancel={onCancel}
                    isSubmitting={saving}
                  />
                ) : null}
              </div>

              <div className="space-y-5">
                {entityType !== "supplier" ? (
                  <div className="space-y-3">
                    <FieldLabel icon={<ShieldCheck className="size-3" />}>
                      {vi.customers.editModal.labels.type}
                    </FieldLabel>
                    <ChoiceGrid className="grid-cols-1 sm:grid-cols-3">
                      {CUSTOMER_TYPE_OPTIONS.map((option) => (
                        <ChoiceCard
                          key={option.value}
                          selected={customerType === option.value}
                          title={option.label}
                          description={option.desc}
                          icon={option.icon}
                          onClick={() => setCustomerType(option.value)}
                        />
                      ))}
                    </ChoiceGrid>
                  </div>
                ) : null}

                {entityType !== "customer" ? (
                  <div className="space-y-3">
                    <FieldLabel icon={<BadgeCheck className="size-3" />}>
                      {vi.customers.createModal.sections.tier}
                    </FieldLabel>
                    <ChoiceGrid className="grid-cols-1 sm:grid-cols-2">
                      {PROVIDER_TIER_OPTIONS.map((option) => (
                        <ChoiceCard
                          key={option.value}
                          selected={providerTier === option.value}
                          title={option.label}
                          description={option.desc}
                          onClick={() => setProviderTier(option.value)}
                        />
                      ))}
                    </ChoiceGrid>
                  </div>
                ) : null}
              </div>
            </div>
          </FormSection>

          <FormSection
            title={vi.customers.dynamicContactList.title}
            description="Giữ contact list theo cùng chuẩn ở mọi flow tạo mới để search, duplicate check và các automation không bị lệch shape."
          >
            <DynamicContactList
              contacts={contacts}
              onChange={setContacts}
              onFacebookResolved={handleFacebookResolved}
            />
          </FormSection>

          {entityType !== "supplier" ? (
            <FormSection
              title={vi.customers.createModal.sections.tags}
              description={vi.customers.createModal.sections.tagsDescription}
            >
              <CustomerTagPicker
                selectedTagIds={selectedTagIds}
                onChange={setSelectedTagIds}
              />
            </FormSection>
          ) : null}

          <FormSection
            title={vi.customers.createModal.sections.notes}
            description={vi.customers.createModal.sections.notesDescription}
          >
            <div className="space-y-3">
              <FieldLabel icon={<MessageSquareText className="size-3" />}>
                Ghi chú nội bộ
              </FieldLabel>
              <textarea
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={vi.customers.createModal.placeholders.notes}
                className="min-h-[132px] w-full resize-y rounded-[1.25rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-3 text-[14px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          </FormSection>
      </CreateFlowShell>
    </div>
  );
}
