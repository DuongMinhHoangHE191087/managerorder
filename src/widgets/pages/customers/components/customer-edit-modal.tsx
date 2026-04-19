"use client";

import { memo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Star, StickyNote, User, Store, Briefcase } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { Modal } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ChoiceCard, ChoiceGrid, FieldLabel, FormSection } from "@/shared/ui/form-primitives";
import type { ContactInfo, Customer } from "@/lib/domain/types";
import { useUpdateCustomer } from "@/widgets/pages/customers/hooks/use-customers";
import { formatMoney } from "@/lib/utils";

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
  { value: "retail", label: "Khách lẻ", desc: "Mua lẻ thông thường", icon: <User className="size-4" /> },
  { value: "wholesale", label: "Bán sỉ", desc: "Mua sỉ số lượng", icon: <Store className="size-4" /> },
  { value: "agency", label: "Đại lý", desc: "Đối tác phân phối", icon: <Briefcase className="size-4" /> },
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
      title="Thông tin chính"
      description="Kiểu khách hàng và định danh chính."
    >
      <div className="space-y-3">
        <FieldLabel required>Họ tên khách hàng</FieldLabel>
        <Input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="VD: Nguyễn Văn A"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <FieldLabel>Phân loại khách hàng</FieldLabel>
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
            Điểm tín nhiệm ({reliabilityScore}/100)
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
            <span>Thấp</span>
            <span>Trung bình</span>
            <span>Cao</span>
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
      title="Thông tin liên hệ"
      description="Quản lý danh bạ liên hệ khách hàng"
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
        ⚠ Công nợ hiện tại: {formatMoney(debtAmountVnd)}
        {debtOverdueDays > 0 ? ` — quá hạn ${debtOverdueDays} ngày` : null}
      </p>
      <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
        Công nợ được tính tự động từ đơn hàng. Thanh toán tại trang chi tiết khách hàng.
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
      title="Tags"
      description="Gắn nhãn để lọc và vận hành theo nhóm."
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
      title="Ghi chú"
      description="Lưu bối cảnh hoặc yêu cầu đặc biệt."
    >
      <div className="space-y-3">
        <FieldLabel icon={<StickyNote className="size-3.5" />}>Ghi chú nội bộ</FieldLabel>
        <textarea
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Thêm ghi chú về khách hàng này..."
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
      appToast.error("Vui lòng nhập tên");
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

      appToast.success(`Đã cập nhật khách hàng "${updatedCustomer?.name ?? trimmedName}"!`);
      onSuccess(updatedCustomer as Customer);
      onClose();
    } catch (error: unknown) {
      appToast.error(error instanceof Error ? error.message : "Lỗi cập nhật");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cập nhật hồ sơ khách hàng"
      size="lg"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Hủy
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="w-full sm:w-auto"
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      }
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
    </Modal>
  );
}
