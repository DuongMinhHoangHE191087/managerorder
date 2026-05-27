"use client";

import { Calendar, AlertTriangle } from "lucide-react";
import { SmartSelector } from "@/shared/ui/smart-selector";
import { FadeIn } from "@/shared/ui/animations";
import { formatMoney, formatDateLabel } from "@/lib/utils";
import type { Customer, ProductService, SourceAccount, PaymentSource, SalesChannel } from "@/lib/domain/types";

export function CustomerCombobox({ customers, value, onChange, onCreateNew }: { customers: Customer[]; value: string; onChange: (id: string) => void; onCreateNew?: () => void }) {
  const items = customers.map(c => ({
    id: c.id,
    label: c.name,
    sublabel: c.contacts.find(x => x.isPrimary)?.value || c.contacts[0]?.value || "No contact",
    createdAt: c.createdAt,
  }));
  const sel = customers.find(c => c.id === value);
  return (
    <div className="space-y-3">
      <SmartSelector items={items} value={value} onSelect={i => onChange(i.id)} onCreateNew={onCreateNew} placeholder="Tìm kiếm theo tên, email, SĐT..." createLabel="Thêm khách hàng mới" />
      {sel && (
        <FadeIn className="flex items-center justify-between p-4 bg-gradient-to-r from-[var(--accent)]/5 to-transparent rounded-xl border border-[var(--accent)]/30 shadow-sm overflow-hidden group relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--accent)]/5 rounded-full blur-[30px] -mr-8 -mt-8 group-hover:scale-110 transition-[background-color,border-color,box-shadow,color,opacity,transform,width]" />
          <div className="flex items-center gap-3 relative z-10 flex-1 min-w-0">
            <div className="size-11 rounded-full bg-[var(--accent)]/10 border-2 border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] font-black text-[15px] shrink-0">{sel.name.charAt(0).toUpperCase()}</div>
            <div className="min-w-0">
              <p className="font-bold text-[15px] tracking-tight truncate">{sel.name}</p>
              <p className="text-[12px] text-[var(--fg-muted)] truncate">{sel.contacts.find(x => x.isPrimary)?.value || sel.contacts[0]?.value || "No contact"}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--accent)] text-white text-[9px] font-black rounded uppercase tracking-widest"><span className="material-symbols-outlined text-[11px] leading-none">stars</span>{sel.tier === "vip" ? "VIP" : "Thân thiết"}</span>
                <span className="text-[10px] text-[var(--fg-muted)]/70 flex items-center gap-1"><Calendar className="size-3" />Tạo: {formatDateLabel(sel.createdAt)}</span>
              </div>
            </div>
          </div>
          {sel.debtAmountVnd > 0 && <div className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 border border-amber-300 rounded-lg text-amber-700 text-[11px] font-bold ml-3 relative z-10"><AlertTriangle className="size-3.5" />Công nợ {formatMoney(sel.debtAmountVnd)}</div>}
        </FadeIn>
      )}
    </div>
  );
}

export function ProductCombobox({ products, value, onChange, onCreateNew }: { products: ProductService[]; value: string; onChange: (id: string) => void; onCreateNew?: () => void }) {
  const items = products.map(p => ({
    id: p.id,
    label: p.name,
    sublabel: `${formatMoney(p.sellPriceVnd)} / ${p.durationValue} ${p.durationType === 'months' ? 'tháng' : p.durationType === 'years' ? 'năm' : 'ngày'}`,
  }));
  return <SmartSelector items={items} value={value} onSelect={i => onChange(i.id)} onCreateNew={onCreateNew} placeholder="Tìm kiếm sản phẩm..." createLabel="Thêm sản phẩm mới" />;
}

export function SourceAccountCombobox({ accounts, productId, productIds, value, onChange, onCreateNew }: { accounts: SourceAccount[]; productId?: string; productIds?: string[]; value: string; onChange: (id: string) => void; onCreateNew?: () => void }) {
  const slotsLeft = (a: SourceAccount) => a.maxSlots - a.usedSlots;
  // Support both single productId and multi productIds
  const filterIds = productIds?.length ? productIds : productId ? [productId] : [];
  const relevant = filterIds.length > 0 ? accounts.filter(a => a.productIds.some(pid => filterIds.includes(pid))) : accounts;
  const sortedRelevant = [...relevant].sort((left, right) => {
    const leftExpiry = new Date(left.expiresAt).getTime();
    const rightExpiry = new Date(right.expiresAt).getTime();
    if (leftExpiry !== rightExpiry) return leftExpiry - rightExpiry;

    const leftSlots = slotsLeft(left);
    const rightSlots = slotsLeft(right);
    if (leftSlots !== rightSlots) return leftSlots - rightSlots;

    return left.email.localeCompare(right.email);
  });
  const items = sortedRelevant.map(a => ({
    id: a.id,
    label: a.email,
    sublabel: `${slotsLeft(a)} slot còn / ${a.maxSlots} • HH: ${formatDateLabel(a.expiresAt)}`,
  }));
  return <SmartSelector items={items} value={value} onSelect={i => onChange(i.id)} onCreateNew={onCreateNew} placeholder={items.length === 0 ? "Không tìm thấy kho tương thích" : "Tìm kho theo email..."} createLabel="Tạo tài khoản kho mới" />;
}

export function PaymentSourceCombobox({ sources, value, onChange }: { sources: PaymentSource[]; value: string; onChange: (id: string) => void }) {
  const items = sources.map(s => ({
    id: s.id,
    label: `${s.icon} ${s.name}`,
  }));
  return <SmartSelector items={items} value={value} onSelect={i => onChange(i.id)} placeholder="Chọn nguồn thanh toán..." />;
}

export function SalesChannelCombobox({ channels, value, onChange }: { channels: SalesChannel[]; value: string; onChange: (id: string) => void }) {
  const items = channels.map(c => ({
    id: c.id,
    label: c.name,
  }));
  return <SmartSelector items={items} value={value} onSelect={i => onChange(i.id)} placeholder="Mua hàng qua kênh nào?" />;
}
