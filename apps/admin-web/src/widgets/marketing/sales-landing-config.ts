import {
  AlertTriangle,
  Brain,
  Clock,
  Film,
  Languages,
  Lock,
  Palette,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { vi } from "@/shared/messages/vi";

export type SalesLandingVariant =
  | "not_found"
  | "error"
  | "expired"
  | "token_required"
  | "blocked"
  | "unauthorized"
  | "auth_failed";

export const BRAND = {
  name: vi.navigation.brand.title,
  tagline: vi.navigation.brand.title,
  domain: "duongminhhoang.store",
  logoUrl:
    "https://ucqmmgopljyugxojntjv.supabase.co/storage/v1/object/public/anhAVT/avt-duolingodmh-duongminhhoang.jpeg",
} as const;

export const CONTACTS = {
  zaloPersonal: "https://zalo.me/0394497949",
  zaloGroup: "https://zalo.me/g/ioinvk167",
  messenger: "https://m.me/61581961902821",
  phone: "0394497949",
} as const;

export type OfferCard = {
  icon: LucideIcon;
  label: string;
  tag: string;
  price: string;
  gradient: string;
  desc: string;
  href: string;
};

export const PREMIUM_OFFERS: OfferCard[] = [
  {
    icon: Brain,
    label: vi.marketing.salesLanding.offers.chatgptPlus.label,
    tag: vi.marketing.salesLanding.offers.chatgptPlus.tag,
    price: vi.marketing.salesLanding.offers.chatgptPlus.price,
    gradient: "from-slate-700 to-slate-900",
    desc: vi.marketing.salesLanding.offers.chatgptPlus.desc,
    href: CONTACTS.zaloPersonal,
  },
  {
    icon: Palette,
    label: vi.marketing.salesLanding.offers.canvaPro.label,
    tag: vi.marketing.salesLanding.offers.canvaPro.tag,
    price: vi.marketing.salesLanding.offers.canvaPro.price,
    gradient: "from-fuchsia-500 to-violet-600",
    desc: vi.marketing.salesLanding.offers.canvaPro.desc,
    href: CONTACTS.zaloPersonal,
  },
  {
    icon: Film,
    label: vi.marketing.salesLanding.offers.capcutPro.label,
    tag: vi.marketing.salesLanding.offers.capcutPro.tag,
    price: vi.marketing.salesLanding.offers.capcutPro.price,
    gradient: "from-emerald-500 to-teal-600",
    desc: vi.marketing.salesLanding.offers.capcutPro.desc,
    href: CONTACTS.zaloPersonal,
  },
  {
    icon: Languages,
    label: vi.marketing.salesLanding.offers.duolingoSuper.label,
    tag: vi.marketing.salesLanding.offers.duolingoSuper.tag,
    price: vi.marketing.salesLanding.offers.duolingoSuper.price,
    gradient: "from-lime-500 to-green-600",
    desc: vi.marketing.salesLanding.offers.duolingoSuper.desc,
    href: CONTACTS.zaloPersonal,
  },
];

export const TRUST_STACK = [
  { icon: ShieldCheck, label: vi.marketing.salesLanding.trustStack.verified.label, desc: vi.marketing.salesLanding.trustStack.verified.desc },
  { icon: Sparkles, label: vi.marketing.salesLanding.trustStack.activation.label, desc: vi.marketing.salesLanding.trustStack.activation.desc },
  { icon: Zap, label: vi.marketing.salesLanding.trustStack.support.label, desc: vi.marketing.salesLanding.trustStack.support.desc },
  { icon: Star, label: vi.marketing.salesLanding.trustStack.review.label, desc: vi.marketing.salesLanding.trustStack.review.desc },
] as const;

export type VariantCopy = {
  icon: LucideIcon;
  iconColor: string;
  gradient: string;
  accent: string;
  title: string;
  desc: string;
  primaryAction: { label: string; href?: string };
  secondaryAction?: { label: string; href?: string };
};

export const SALES_VARIANT_COPY: Record<SalesLandingVariant, VariantCopy> = {
  not_found: {
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    gradient: "from-amber-50 to-orange-50",
    accent: "border-amber-200/60",
    title: vi.marketing.salesLanding.variants.not_found.title,
    desc: vi.marketing.salesLanding.variants.not_found.desc,
    primaryAction: { label: vi.marketing.salesLanding.variants.not_found.primaryActionLabel, href: "#offers" },
    secondaryAction: { label: vi.marketing.salesLanding.variants.not_found.secondaryActionLabel, href: "/" },
  },
  blocked: {
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    gradient: "from-amber-50 to-orange-50",
    accent: "border-amber-200/60",
    title: vi.marketing.salesLanding.variants.blocked.title,
    desc: vi.marketing.salesLanding.variants.blocked.desc,
    primaryAction: { label: vi.marketing.salesLanding.variants.blocked.primaryActionLabel, href: "#offers" },
    secondaryAction: { label: vi.marketing.salesLanding.variants.blocked.secondaryActionLabel, href: "/" },
  },
  unauthorized: {
    icon: Lock,
    iconColor: "text-violet-500",
    gradient: "from-violet-50 to-purple-50",
    accent: "border-violet-200/60",
    title: vi.marketing.salesLanding.variants.unauthorized.title,
    desc: vi.marketing.salesLanding.variants.unauthorized.desc,
    primaryAction: { label: vi.marketing.salesLanding.variants.unauthorized.primaryActionLabel, href: "/login" },
    secondaryAction: { label: vi.marketing.salesLanding.variants.unauthorized.secondaryActionLabel, href: "#offers" },
  },
  auth_failed: {
    icon: Lock,
    iconColor: "text-violet-500",
    gradient: "from-violet-50 to-purple-50",
    accent: "border-violet-200/60",
    title: vi.marketing.salesLanding.variants.auth_failed.title,
    desc: vi.marketing.salesLanding.variants.auth_failed.desc,
    primaryAction: { label: vi.marketing.salesLanding.variants.auth_failed.primaryActionLabel, href: "/login" },
    secondaryAction: { label: vi.marketing.salesLanding.variants.auth_failed.secondaryActionLabel, href: CONTACTS.zaloPersonal },
  },
  expired: {
    icon: Clock,
    iconColor: "text-rose-500",
    gradient: "from-rose-50 to-pink-50",
    accent: "border-rose-200/60",
    title: vi.marketing.salesLanding.variants.expired.title,
    desc: vi.marketing.salesLanding.variants.expired.desc,
    primaryAction: { label: vi.marketing.salesLanding.variants.expired.primaryActionLabel, href: CONTACTS.zaloPersonal },
    secondaryAction: { label: vi.marketing.salesLanding.variants.expired.secondaryActionLabel, href: "#offers" },
  },
  token_required: {
    icon: Lock,
    iconColor: "text-violet-500",
    gradient: "from-violet-50 to-purple-50",
    accent: "border-violet-200/60",
    title: vi.marketing.salesLanding.variants.token_required.title,
    desc: vi.marketing.salesLanding.variants.token_required.desc,
    primaryAction: { label: vi.marketing.salesLanding.variants.token_required.primaryActionLabel, href: CONTACTS.zaloPersonal },
    secondaryAction: { label: vi.marketing.salesLanding.variants.token_required.secondaryActionLabel, href: "/" },
  },
  error: {
    icon: AlertTriangle,
    iconColor: "text-rose-500",
    gradient: "from-rose-50 to-pink-50",
    accent: "border-rose-200/60",
    title: vi.marketing.salesLanding.variants.error.title,
    desc: vi.marketing.salesLanding.variants.error.desc,
    primaryAction: { label: vi.marketing.salesLanding.variants.error.primaryActionLabel, href: "/" },
    secondaryAction: { label: vi.marketing.salesLanding.variants.error.secondaryActionLabel, href: "#offers" },
  },
};

export const AUTH_ERROR_COPY: Record<string, string> = {
  auth_failed: vi.marketing.salesLanding.authErrors.auth_failed,
  callback_failed: vi.marketing.salesLanding.authErrors.callback_failed,
  oauth_denied: vi.marketing.salesLanding.authErrors.oauth_denied,
  oauth_error: vi.marketing.salesLanding.authErrors.oauth_error,
  access_denied: vi.marketing.salesLanding.authErrors.access_denied,
};

export function getSalesVariantCopy(variant: SalesLandingVariant): VariantCopy {
  return SALES_VARIANT_COPY[variant];
}

export function getAuthErrorMessage(errorCode?: string | null, reason?: string | null) {
  if (!errorCode) {
    return null;
  }

  if (errorCode === "auth_failed" || errorCode === "callback_failed") {
    return reason?.trim() || AUTH_ERROR_COPY[errorCode];
  }

  return AUTH_ERROR_COPY[errorCode] || reason?.trim() || vi.marketing.salesLanding.authErrors.default;
}
