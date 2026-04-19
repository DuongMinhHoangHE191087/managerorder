import * as React from "react";
import { Plus, Trash2, CheckCircle, Mail, Phone, MessageCircle, Send, Loader2, ExternalLink } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { Button } from "./button";
import { Input } from "./input";
import { Select } from "./select";
import type { ContactInfo } from "@/lib/domain/types";

interface DynamicContactListProps {
  contacts: ContactInfo[];
  onChange: (contacts: ContactInfo[]) => void;
  title?: string;
  description?: string;
  /** Called when Facebook contact is resolved — for auto-filling customer name */
  onFacebookResolved?: (id: string, name: string) => void;
}

const contactTypes = [
  { value: "phone", label: "Điện thoại", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "zalo", label: "Zalo", icon: MessageCircle },
  { value: "facebook", label: "Facebook", icon: MessageCircle },
  { value: "telegram", label: "Telegram", icon: Send },
  { value: "other", label: "Khác", icon: Phone },
] as const;

/** Debounce utility for auto-fetch */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Per-contact FB resolve state */
interface FbState {
  loading: boolean;
  id?: string;
  name?: string;
  profileUrl?: string;
  error?: string;
}

export function DynamicContactList({
  contacts,
  onChange,
  title = "Thông tin liên hệ",
  description = "Thêm các kênh để liên lạc với khách hàng",
  onFacebookResolved,
}: DynamicContactListProps) {
  // Ensure we always have at least one empty contact if array is empty
  React.useEffect(() => {
    if (contacts.length === 0) {
      onChange([{ id: crypto.randomUUID(), type: "phone", value: "", isPrimary: true }]);
    }
  }, [contacts, onChange]);

  const addContact = () => {
    onChange([
      ...contacts,
      { id: crypto.randomUUID(), type: "phone", value: "", isPrimary: contacts.length === 0 },
    ]);
  };

  const updateContact = (id: string, updates: Partial<ContactInfo>) => {
    let newContacts = contacts.map((c) => (c.id === id ? { ...c, ...updates } : c));
    
    // If setting a contact as primary, un-set all others
    if (updates.isPrimary) {
       newContacts = newContacts.map(c => ({ ...c, isPrimary: c.id === id }));
    }

    onChange(newContacts);
  };

  const removeContact = (id: string) => {
    const newContacts = contacts.filter((c) => c.id !== id);
    // If we removed the primary contact, make the first one primary
    if (newContacts.length > 0 && contacts.find(c => c.id === id)?.isPrimary) {
      newContacts[0].isPrimary = true;
    }
    onChange(newContacts);
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-[var(--border-soft)] pb-2 mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-bold text-[var(--fg-base)] flex items-center gap-2">
            <Phone className="size-4 text-[var(--accent)]" />
            {title}
          </h3>
          <p className="text-[11px] text-[var(--fg-muted)] mt-0.5">{description}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={addContact} type="button" className="h-8 gap-1.5 text-[var(--accent)] hover:text-[var(--accent-strong)]">
          <Plus className="size-3.5" /> Thêm kênh
        </Button>
      </div>

      <div className="space-y-3">
        {contacts.map((contact, index) => {
          const typeInfo = contactTypes.find((t) => t.value === contact.type) || contactTypes[0];
          const Icon = typeInfo.icon;
          const isFacebook = contact.type === "facebook";
          const isSocial = contact.type === "zalo" || isFacebook;

          return (
            <ContactRow
              key={contact.id || index}
              contact={contact}
              Icon={Icon}
              isFacebook={isFacebook}
              isSocial={isSocial}
              contactsCount={contacts.length}
              onUpdate={updateContact}
              onRemove={removeContact}
              onFacebookResolved={onFacebookResolved}
              titleKey={title}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── ContactRow extracted to enable per-contact hooks ────────────────────────
interface ContactRowProps {
  contact: ContactInfo;
  Icon: React.FC<{ className?: string }>;
  isFacebook: boolean;
  isSocial: boolean;
  contactsCount: number;
  titleKey: string;
  onUpdate: (id: string, updates: Partial<ContactInfo>) => void;
  onRemove: (id: string) => void;
  onFacebookResolved?: (id: string, name: string) => void;
}

function ContactRow({
  contact, Icon, isFacebook, isSocial: _isSocial, contactsCount, titleKey,
  onUpdate, onRemove, onFacebookResolved,
}: ContactRowProps) {
  const [fbState, setFbState] = React.useState<FbState>({ loading: false });
  const debouncedValue = useDebounce(contact.value, 1500);

  // Auto-fetch Facebook ID when type=facebook and value changes (debounced 1.5s)
  React.useEffect(() => {
    if (!isFacebook || !debouncedValue.trim()) {
      setFbState({ loading: false });
      return;
    }
    // Only trigger for URLs that look like Facebook links
    if (!debouncedValue.includes("facebook.com") && !debouncedValue.includes("fb.com")) {
      return;
    }
    // Validate URL format before fetching
    try {
      new URL(debouncedValue.trim());
    } catch {
      return; // Not a valid URL yet — user may still be typing
    }

    let cancelled = false;
    setFbState({ loading: true });

    fetch(`/api/proxy/facebook-id?link=${encodeURIComponent(debouncedValue.trim())}`)
      .then(res => res.json())
      .then((data: { id?: string; name?: string; profileUrl?: string; error?: string }) => {
        if (cancelled) return;
        if (data.error || !data.id) {
          setFbState({ loading: false, error: data.error ?? "Không tìm thấy ID" });
          return;
        }
        setFbState({
          loading: false,
          id: data.id,
          name: data.name ?? undefined,
          profileUrl: data.profileUrl,
        });
        // Persist resolved fields into the contact object
        onUpdate(contact.id!, {
          facebookId: data.id,
          facebookName: data.name ?? undefined,
        });
        // Notify parent to auto-fill customer name
        if (data.name && onFacebookResolved) {
          onFacebookResolved(data.id!, data.name);
        }
      })
      .catch(() => {
        if (!cancelled) setFbState({ loading: false, error: "Lỗi kết nối" });
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue, isFacebook]);

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)]">
      <div className="flex gap-2 items-start lg:items-center flex-col lg:flex-row">
        <div className="flex-1 w-full flex flex-col sm:flex-row gap-2">
          <Select
            className="h-10 !w-full sm:!w-[120px] shrink-0 rounded-lg text-sm"
            value={contact.type}
            onChange={(e) => {
              setFbState({ loading: false });
              onUpdate(contact.id!, { type: e.target.value as ContactInfo["type"] });
            }}
          >
            {contactTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <div className="relative flex-1">
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-muted)]" />
            <Input
              value={contact.value}
              onChange={(e) => onUpdate(contact.id!, { value: e.target.value })}
              className="pl-9 h-10 pr-9"
              placeholder={
                contact.type === "phone" ? "Nhập số điện thoại"
                : contact.type === "email" ? "Nhập email"
                : contact.type === "facebook" ? "https://facebook.com/your.name"
                : "Nhập đường dẫn/ID"
              }
              required
            />
            {isFacebook && fbState.loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-blue-400 animate-spin" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-auto flex-wrap">
          {isFacebook && (
            <Button variant="secondary" size="sm" type="button" className="h-10 px-3 text-[12px] whitespace-nowrap gap-1.5" onClick={() => appToast.info("Hệ thống tự động verify ID từ link Facebook", { description: "Vui lòng nhập đúng địa chỉ trang cá nhân" })}>
              <CheckCircle className="size-3.5 text-blue-500" />
              Verify
            </Button>
          )}
          
          <label className="flex items-center gap-1.5 cursor-pointer h-10 px-3 border border-[var(--border-soft)] rounded-lg hover:bg-[var(--bg-app)]">
            <input
              type="radio"
              name={`primary-contact-${titleKey}`}
              checked={!!contact.isPrimary}
              onChange={() => onUpdate(contact.id!, { isPrimary: true })}
              className="size-3.5 text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            <span className="text-[11px] font-medium text-[var(--fg-muted)] whitespace-nowrap">Chính</span>
          </label>

          <button
            type="button"
            onClick={() => onRemove(contact.id!)}
            disabled={contactsCount <= 1}
            className="h-10 w-10 flex items-center justify-center rounded-lg border border-[var(--border-soft)] text-[var(--fg-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Facebook resolved info */}
      {isFacebook && fbState.id && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[12px]">
          <CheckCircle className="size-3.5 text-blue-400 shrink-0" />
          <span className="text-blue-300 font-medium">
            ID: <span className="font-mono font-bold">{fbState.id}</span>
            {fbState.name && <span className="text-slate-300 ml-2">• {fbState.name}</span>}
          </span>
          {fbState.profileUrl && (
            <a
              href={fbState.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              <ExternalLink className="size-3" />
              Mở FB
            </a>
          )}
        </div>
      )}
      {isFacebook && fbState.error && (
        <p className="text-[11px] text-red-400 px-2">{fbState.error}</p>
      )}
    </div>
  );
}
