"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Building2, Loader2, Star, User, Users } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { Modal } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ChoiceCard, ChoiceGrid, FieldLabel, FormSection } from "@/shared/ui/form-primitives";
import type { ContactInfo, Provider } from "@/lib/domain/types";
import { useCreateCustomer } from "@/widgets/pages/customers/hooks/use-customers";
import { useCreateProvider } from "@/widgets/pages/providers/hooks/use-providers";
import { DynamicContactList } from "@/shared/ui/dynamic-contact-list";
import type { CreateCustomerResult, DuplicateCandidate } from "@/shared/types/customers";
import { CustomerTagPicker } from "@/widgets/pages/customers/components/customer-tag-picker";
import { DuplicateWarning } from "@/widgets/pages/customers/components/duplicate-warning";
import { useCheckDuplicates } from "@/widgets/pages/customers/hooks/use-check-duplicates";
import { vi } from "@/shared/messages/vi";

export type EntityType = "customer" | "supplier" | "both";

interface CustomerCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: CreateCustomerResult) => void;
  initialName?: string;
  defaultEntityType?: EntityType;
}

const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string; desc: string; icon: ReactNode }[] = [
  { value: "customer", label: vi.customers.createModal.entityTypes.customer.label, desc: vi.customers.createModal.entityTypes.customer.desc, icon: <User className="size-4" /> },
  { value: "supplier", label: vi.customers.createModal.entityTypes.supplier.label, desc: vi.customers.createModal.entityTypes.supplier.desc, icon: <Building2 className="size-4" /> },
  { value: "both", label: vi.customers.createModal.entityTypes.both.label, desc: vi.customers.createModal.entityTypes.both.desc, icon: <Users className="size-4" /> },
];

const TIER_OPTIONS = [
  { value: "regular", label: vi.customers.createModal.tierOptions.regular.label, desc: vi.customers.createModal.tierOptions.regular.desc },
  { value: "vip", label: vi.customers.createModal.tierOptions.vip.label, desc: vi.customers.createModal.tierOptions.vip.desc },
] as const;

export function CustomerCreateModal({
  isOpen,
  onClose,
  onSuccess,
  initialName = "",
  defaultEntityType = "customer",
}: CustomerCreateModalProps) {
  const [name, setName] = useState(initialName);
  const [entityType, setEntityType] = useState<EntityType>(defaultEntityType);
  const [tier, setTier] = useState<"regular" | "vip">("regular");
  const [contacts, setContacts] = useState<ContactInfo[]>([
    { id: crypto.randomUUID(), type: "phone", value: "", isPrimary: true },
  ]);
  const [saving, setSaving] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { mutateAsync: createCustomer } = useCreateCustomer();
  const { mutateAsync: createProvider } = useCreateProvider();
  const checkDuplicates = useCheckDuplicates();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName(initialName);
    setEntityType(defaultEntityType);
    setTier("regular");
    setContacts([{ id: crypto.randomUUID(), type: "phone", value: "", isPrimary: true }]);
    setSelectedTagIds([]);
    setDuplicates([]);
    setShowDuplicateWarning(false);
  }, [defaultEntityType, initialName, isOpen]);

  useEffect(() => {
    return () => {
      if (dupTimerRef.current) {
        clearTimeout(dupTimerRef.current);
      }
    };
  }, []);

  const handleNameChange = useCallback(
    (value: string) => {
      setName(value);
      setShowDuplicateWarning(false);

      if (dupTimerRef.current) {
        clearTimeout(dupTimerRef.current);
      }

      if (value.trim().length < 3) {
        setDuplicates([]);
        return;
      }

      dupTimerRef.current = setTimeout(async () => {
        try {
          const result = await checkDuplicates.mutateAsync({ name: value.trim() });
          setDuplicates(result);
          setShowDuplicateWarning(result.length > 0);
        } catch {
          setDuplicates([]);
        }
      }, 600);
    },
    [checkDuplicates],
  );

  const handleFacebookResolved = useCallback((_id: string, fbName: string) => {
    void _id;
    setName((prev) => (prev.trim() ? prev : fbName));
  }, []);

  function handleClose() {
    if (dupTimerRef.current) {
      clearTimeout(dupTimerRef.current);
      dupTimerRef.current = null;
    }
    setName(initialName);
    setEntityType(defaultEntityType);
    setTier("regular");
    setContacts([{ id: crypto.randomUUID(), type: "phone", value: "", isPrimary: true }]);
    setSelectedTagIds([]);
    setDuplicates([]);
    setShowDuplicateWarning(false);
    onClose();
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      appToast.error(vi.customers.createModal.errors.enterName);
      return;
    }

    setSaving(true);
    try {
      let createdCustomer: CreateCustomerResult | null = null;
      let createdProvider: Provider | null = null;
      const validContacts = contacts.filter((contact) => contact.value.trim());

      if (entityType === "customer" || entityType === "both") {
        createdCustomer = (await createCustomer({
          name: trimmedName,
          tier,
          contacts: validContacts.map((contact) => ({
            type: contact.type,
            value: contact.value.trim(),
            isPrimary: !!contact.isPrimary,
            facebookId: contact.facebookId,
            facebookName: contact.facebookName,
          })),
          tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        })) as CreateCustomerResult;
      }

      if (entityType === "supplier" || entityType === "both") {
        createdProvider = (await createProvider({
          name: trimmedName,
          tier,
          reliabilityScore: 100,
          contacts: validContacts.map((contact) => ({
            type: contact.type,
            value: contact.value.trim(),
            isPrimary: !!contact.isPrimary,
            facebookId: contact.facebookId,
            facebookName: contact.facebookName,
          })),
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
      handleClose();
    } catch (error: unknown) {
      appToast.error(error instanceof Error ? error.message : vi.customers.createModal.errors.network);
    } finally {
      setSaving(false);
    }
  }

  const headerLabel =
    entityType === "supplier"
      ? vi.customers.createModal.titleSupplier
      : entityType === "both"
        ? vi.customers.createModal.titleBoth
        : vi.customers.createModal.titleCustomer;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={headerLabel}
      size="lg"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="secondary" onClick={handleClose} className="w-full sm:w-auto">
            {vi.common.cancel}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="w-full sm:w-auto"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? vi.customers.createModal.buttons.saving : vi.customers.createModal.buttons.createAndFinish}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
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

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <FieldLabel required icon={<User className="size-3" />}>
              {entityType === "supplier" ? vi.customers.createModal.sections.supplierName : vi.customers.createModal.sections.name}
            </FieldLabel>
            <Input
              autoFocus
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSave()}
              placeholder={entityType === "supplier" ? vi.customers.createModal.placeholders.supplierName : vi.customers.createModal.placeholders.customerName}
            />
            {showDuplicateWarning && duplicates.length > 0 ? (
              <DuplicateWarning
                duplicates={duplicates}
                onContinue={() => setShowDuplicateWarning(false)}
                onCancel={handleClose}
                isSubmitting={saving}
              />
            ) : null}
          </div>

          <div className="space-y-3">
            <FieldLabel icon={<Star className="size-3" />}>{vi.customers.createModal.sections.tier}</FieldLabel>
            <ChoiceGrid className="grid-cols-2">
              {TIER_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  selected={tier === option.value}
                  title={option.label}
                  description={option.desc}
                  onClick={() => setTier(option.value)}
                />
              ))}
            </ChoiceGrid>
          </div>
        </div>

        <DynamicContactList
          contacts={contacts}
          onChange={setContacts}
          onFacebookResolved={handleFacebookResolved}
        />

        {entityType !== "supplier" ? (
          <FormSection
            title={vi.customers.createModal.sections.tags}
            description={vi.customers.createModal.sections.tagsDescription}
          >
            <CustomerTagPicker selectedTagIds={selectedTagIds} onChange={setSelectedTagIds} />
          </FormSection>
        ) : null}

        <FormSection
          title={vi.customers.createModal.sections.notes}
          description={vi.customers.createModal.sections.notesDescription}
        >
          <textarea
            placeholder={vi.customers.createModal.placeholders.notes}
            rows={3}
            className="w-full resize-none rounded-ios-sm border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-3 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
          />
        </FormSection>
      </div>
    </Modal>
  );
}
