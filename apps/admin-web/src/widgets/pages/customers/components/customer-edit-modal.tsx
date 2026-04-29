"use client";

import { memo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Star, StickyNote, User, Store, Briefcase } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { Input } from "@/shared/ui/input";
import { CreateActionFooter, CreateFlowDialog } from "@/shared/ui/create-flow-shell";
import { ChoiceCard, ChoiceGrid, FieldLabel, FormSection } from "@/shared/ui/form-primitives";
import type { ContactInfo, Customer } from "@/lib/domain/types";
import { useUpdateCustomer } from "@/widgets/pages/customers/hooks/use-customers";
import { formatMoney } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";

const CustomerTagPickerLazy = dynamic(
  () =>
    import("@/widgets/pages/customers/components/customer-tag-picker").then((mod) => ({
      default: mod.CustomerTagPicker,
    })),
  {
    ssr: false,
    loading: () => <div className="h-10 rounded-xl bg-[var(--surface-light)] animate-pulse" />,
  },
);

const DynamicContactListLazy = dynamic(
  () =>
    import("@/shared/ui/dynamic-contact-list").then((mod) => ({
      default: mod.DynamicContactList,
    })),
  {
    ssr: false,
    loading: () => <div className="h-28 rounded-xl bg-[var(--surface-light)] animate-pulse" />,
  },
);

interface CustomerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: Customer) => void;
  customer: Customer;
}

function normalizeContacts(source: Customer["contacts"]) {
  return source.length > 0
    ? source.map((contact) => ({ ...contact, id: contact.id || crypto.randomUUID() }))
    : [{ id: crypto.randomUUID(), type: "phone" as const, value: "", isPrimary: true }];
}

const CUSTOMER_TYPE_OPTIONS = [
  { value: "retail", label: vi.customers.editModal.options.retail.label, desc: vi.customers.editModal.options.retail.desc, icon: <User className="size-4" /> },
  { value: "wholesale", label: vi.customers.editModal.options.wholesale.label, desc: vi.customers.editModal.options.wholesale.desc, icon: <Store className="size-4" /> },
  { value: "agency", label: vi.customers.editModal.options.agency.label, desc: vi.customers.editModal.options.agency.desc, icon: <Briefcase className="size-4" /> },
] as const;

const CustomerProfileSection = memo(function CustomerProfileSection({
  name,
  customerType,
  reliabilityScore,
  setName,
  setCustomerType,
  setReliabilityScore,
}: {
  name: string;
  customerType: "retail" | "wholesale" | "agency";
  reliabilityScore: string;
  setName: (value: string) => void;
  setCustomerType: (value: "retail" | "wholesale" | "agency") => void;
  setReliabilityScore: (value: string) => void;
}) {
  return (
    <FormSection
      title={vi.customers.editModal.sections.main}
      description={vi.customers.editModal.sections.mainDescription}
    >
      <div className="space-y-3">
        <FieldLabel required>{vi.customers.editModal.labels.fullName}</FieldLabel>
        <Input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={vi.customers.editModal.placeholders.name}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <FieldLabel>{vi.customers.editModal.labels.type}</FieldLabel>
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

        <div className="space-y-3">
          <FieldLabel icon={<Star className="size-3" />}>
            {vi.customers.editModal.labels.debtScore} ({reliabilityScore}/100)
          </FieldLabel>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={reliabilityScore}
            onChange={(event) => setReliabilityScore(event.target.value)}
            className="h-2 w-full cursor-pointer appearance-none rounded-full accent-[var(--accent)]"
            style={{
              background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${reliabilityScore}%, #e2e8f0 ${reliabilityScore}%, #e2e8f0 100%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-[var(--fg-muted)]">
            <span>{vi.customers.editModal.labels.low}</span>
            <span>{vi.customers.editModal.labels.medium}</span>
            <span>{vi.customers.editModal.labels.high}</span>
          </div>
        </div>
      </div>
    </FormSection>
  );
});

const CustomerContactsSection = memo(function CustomerContactsSection({
  contacts,
  setContacts,
}: {
  contacts: ContactInfo[];
  setContacts: (contacts: ContactInfo[]) => void;
}) {
  return (
    <DynamicContactListLazy
      contacts={contacts}
      onChange={setContacts}
      title={vi.customers.editModal.sections.contacts}
      description={vi.customers.editModal.sections.contactsDescription}
    />
  );
});

const CustomerDebtBanner = memo(function CustomerDebtBanner({
  debtAmountVnd,
  debtOverdueDays,
}: {
  debtAmountVnd: number;
  debtOverdueDays: number;
}) {
  if (debtAmountVnd <= 0) return null;

  return (
    <div className="rounded-ios-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-[12px] font-bold text-amber-700">
        {vi.customers.editModal.sections.debtBanner(formatMoney(debtAmountVnd), debtOverdueDays)}
      </p>
      <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
        {vi.customers.editModal.sections.debtDescription}
      </p>
    </div>
  );
});

const CustomerTagsSection = memo(function CustomerTagsSection({
  selectedTagIds,
  setSelectedTagIds,
}: {
  selectedTagIds: string[];
  setSelectedTagIds: (tagIds: string[]) => void;
}) {
  return (
    <FormSection
      title={vi.customers.editModal.sections.tags}
      description={vi.customers.editModal.sections.tagsDescription}
    >
      <CustomerTagPickerLazy selectedTagIds={selectedTagIds} onChange={setSelectedTagIds} />
    </FormSection>
  );
});

const CustomerNotesSection = memo(function CustomerNotesSection({
  notes,
  onNotesChange,
}: {
  notes: string;
  onNotesChange: (value: string) => void;
}) {
  return (
    <FormSection
      title={vi.customers.editModal.sections.notes}
      description={vi.customers.editModal.sections.notesDescription}
    >
      <div className="space-y-3">
        <FieldLabel icon={<StickyNote className="size-3.5" />}>{vi.customers.editModal.labels.internalNotes}</FieldLabel>
        <textarea
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder={vi.customers.editModal.placeholders.notes}
          rows={3}
          className="w-full resize-none rounded-ios-sm border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-3 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>
    </FormSection>
  );
});

export function CustomerEditModal({
  isOpen,
  onClose,
  onSuccess,
  customer,
}: CustomerEditModalProps) {
  const [name, setName] = useState(customer.name);
  const [customerType, setCustomerType] = useState<"retail" | "wholesale" | "agency">(customer.customerType ?? "retail");
  const [contacts, setContacts] = useState(normalizeContacts(customer.contacts));
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [reliabilityScore, setReliabilityScore] = useState(String(customer.reliabilityScore ?? 100));
  const [saving, setSaving] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(customer.tags?.map((tag) => tag.id) ?? []);

  const { mutateAsync: updateCustomer } = useUpdateCustomer();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName(customer.name);
    setCustomerType(customer.customerType ?? "retail");
    setContacts(normalizeContacts(customer.contacts));
    setNotes(customer.notes ?? "");
    setReliabilityScore(String(customer.reliabilityScore ?? 100));
    setSelectedTagIds(customer.tags?.map((tag) => tag.id) ?? []);
  }, [customer, isOpen]);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      appToast.error(vi.customers.editModal.errors.enterName);
      return;
    }

    setSaving(true);
    try {
      const updatedCustomer = await updateCustomer({
        id: customer.id,
        name: trimmedName,
        customerType,
        contacts: contacts.filter((contact) => contact.value.trim()).map((contact) => ({
          type: contact.type,
          value: contact.value.trim(),
          isPrimary: contact.isPrimary,
        })),
        notes: notes.trim(),
        reliabilityScore: Number(reliabilityScore),
        tagIds: selectedTagIds,
      });

      appToast.success(vi.customers.editModal.success(updatedCustomer?.name ?? trimmedName));
      onSuccess(updatedCustomer as Customer);
      onClose();
    } catch (error: unknown) {
      appToast.error(error instanceof Error ? error.message : vi.customers.editModal.errors.updateFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <CreateFlowDialog
      isOpen={isOpen}
      onClose={onClose}
      title={vi.customers.editModal.title}
      size="xl"
      description="Chỉnh sửa hồ sơ khách hàng theo cùng cấu trúc với create flow để sales, CSKH và premium team thao tác nhất quán hơn."
      footer={
        <CreateActionFooter
          primaryLabel={vi.customers.editModal.save}
          onPrimary={() => {
            void handleSave();
          }}
          onCancel={onClose}
          pending={saving}
          disabled={!name.trim()}
        />
      }
      contentClassName="gap-5"
    >
      <div className="space-y-4">
        <CustomerProfileSection
          name={name}
          customerType={customerType}
          reliabilityScore={reliabilityScore}
          setName={setName}
          setCustomerType={setCustomerType}
          setReliabilityScore={setReliabilityScore}
        />

        <CustomerContactsSection contacts={contacts} setContacts={setContacts} />

        <CustomerDebtBanner debtAmountVnd={customer.debtAmountVnd} debtOverdueDays={customer.debtOverdueDays} />

        <CustomerTagsSection selectedTagIds={selectedTagIds} setSelectedTagIds={setSelectedTagIds} />

        <CustomerNotesSection notes={notes} onNotesChange={setNotes} />
      </div>
    </CreateFlowDialog>
  );
}
