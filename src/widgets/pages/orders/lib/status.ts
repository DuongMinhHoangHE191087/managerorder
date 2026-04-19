import { formatDateShort } from "@/lib/utils";

export const getStatusStyle = (status: string) => {
  switch (status) {
    case "paid":
      return "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20";
    case "active":
      return "bg-emerald-100 text-emerald-600 border-emerald-500/20";
    case "pending_payment":
      return "bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20";
    case "provisioning":
      return "bg-blue-100 text-blue-600 border-blue-500/20";
    case "draft":
      return "bg-[var(--fg-muted)]/10 text-[var(--fg-muted)] border-[var(--border-soft)]";
    case "expired":
      return "bg-red-100 text-red-500 border-red-500/20";
    case "refunded":
      return "bg-purple-100 text-purple-600 border-purple-500/20";
    default:
      return "bg-[var(--fg-muted)]/10 text-[var(--fg-muted)] border-[var(--border-soft)]";
  }
};

export const getDotStyle = (status: string) => {
  switch (status) {
    case "paid":
      return "bg-[var(--accent)]";
    case "active":
      return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
    case "pending_payment":
      return "bg-[var(--warning)] shadow-[0_0_8px_rgba(245,158,11,0.5)]";
    case "provisioning":
      return "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]";
    case "expired":
      return "bg-red-500";
    case "refunded":
      return "bg-purple-500";
    case "draft":
      return "bg-[var(--fg-muted)]";
    default:
      return "bg-[var(--fg-muted)]";
  }
};

export const getStatusLabel = (status: string) => {
  switch (status) {
    case "draft":
      return "Nháp";
    case "pending_payment":
      return "Chờ thanh toán";
    case "paid":
      return "Đã thanh toán";
    case "provisioning":
      return "Đang cấp phát";
    case "active":
      return "Hoạt động";
    case "expired":
      return "Hết hạn";
    case "refunded":
      return "Hoàn tiền";
    default:
      return status.toUpperCase();
  }
};

export const getExpiryBadge = (expiresAt: string) => {
  if (!expiresAt) {
    return null;
  }

  const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86400000);

  if (diff < 0) {
    return {
      label: "Đã hết hạn",
      class: "bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/20",
    };
  }

  if (diff <= 7) {
    return {
      label: `Còn ${diff} ngày`,
      class: "bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20",
    };
  }

  return {
    label: formatDateShort(expiresAt),
    class: "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20",
  };
};
