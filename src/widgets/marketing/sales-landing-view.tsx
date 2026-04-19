"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Clock,
  Globe,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  BRAND,
  CONTACTS,
  PREMIUM_OFFERS,
  TRUST_STACK,
  getSalesVariantCopy,
  type SalesLandingVariant,
} from "./sales-landing-config";

export type { SalesLandingVariant } from "./sales-landing-config";

type SalesLandingProps = {
  variant: SalesLandingVariant;
  errorMessage?: string;
  reset?: () => void;
  resetLabel?: string;
};

export function SalesLandingView({ variant, errorMessage, reset, resetLabel }: SalesLandingProps) {
  const copy = getSalesVariantCopy(variant);
  const bannerCopy = variant === "error" && errorMessage ? { ...copy, desc: errorMessage } : copy;

  const hasResetAction = Boolean(reset);
  const primaryActionLabel = hasResetAction ? resetLabel || copy.primaryAction.label : copy.primaryAction.label;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/20 px-3 py-6 pb-20 sm:px-6">
      <DecorativeBackground />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative w-full max-w-[560px]"
      >
        <div className="overflow-hidden rounded-[32px] border border-white/80 bg-white/95 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.15)] backdrop-blur-3xl">
          <div className="px-6 pb-5 pt-8 text-center sm:px-8">
            <div className="flex flex-col items-center gap-4">
              <div className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={BRAND.logoUrl}
                  alt={BRAND.name}
                  className="h-20 w-20 rounded-[24px] border-4 border-white object-cover shadow-2xl shadow-blue-500/20 ring-4 ring-blue-500/10 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3"
                />
                <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow-md">
                  <BadgeCheck className="size-4 text-white" strokeWidth={2.5} />
                </div>
              </div>

              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-800 leading-tight">{BRAND.name}</h1>
                <p className="mt-1.5 bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-xs font-black uppercase tracking-[0.2em] text-transparent">
                  {BRAND.tagline} OFFICIAL
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TRUST_STACK.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center rounded-xl border border-slate-100 bg-slate-50 p-2 transition-colors hover:bg-slate-100"
                >
                  <item.icon className="mb-1 size-4 text-blue-500" />
                  <span className="whitespace-nowrap text-[10px] font-bold text-slate-700">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <Divider />

          <div className="px-6 py-5 sm:px-8">
            <div className={`rounded-2xl border ${bannerCopy.accent} bg-gradient-to-br ${bannerCopy.gradient} p-4 shadow-inner`}>
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white bg-white shadow-sm">
                  <bannerCopy.icon className={`size-6 ${bannerCopy.iconColor}`} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="mb-1.5 text-base font-extrabold tracking-tight text-slate-800">{bannerCopy.title}</h2>
                  <p className="text-xs font-medium leading-relaxed text-slate-600">{bannerCopy.desc}</p>
                </div>
              </div>
            </div>

            {variant === "error" && errorMessage ? (
              <div className="mt-3 rounded-2xl border border-rose-200/70 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}
          </div>

          <Divider />

          <section id="offers" className="bg-gradient-to-b from-white to-blue-50/30 px-6 py-6 sm:px-8">
            <div className="mb-4 flex items-center justify-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-800">
                Bảng giá nâng cấp
              </p>
              <Sparkles className="size-4 text-amber-500" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {PREMIUM_OFFERS.map((offer) => (
                <OfferCard key={offer.label} offer={offer} />
              ))}
            </div>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] font-medium text-slate-500">
              <Clock className="size-3" />
              Cam kết email chính chủ, hỗ trợ nhanh, không dán tài khoản lạ.
            </p>
          </section>

          <Divider />

          <section className="px-6 py-5 sm:px-8">
            <div className="flex flex-col gap-3 sm:flex-row">
              <ActionButton
                action={copy.primaryAction}
                onClick={hasResetAction ? reset : undefined}
                label={primaryActionLabel}
                className="bg-slate-900 text-white hover:bg-slate-800"
              />
              {copy.secondaryAction ? (
                <ActionButton
                  action={copy.secondaryAction}
                  className="border border-slate-200 bg-white text-slate-700 hover:border-blue-500 hover:text-slate-900"
                />
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ContactButton
                href={CONTACTS.zaloPersonal}
                className="bg-gradient-to-br from-[#0068FF] to-[#0052cc] text-white shadow-lg shadow-blue-500/30"
                icon={MessageCircle}
                title="Nhắn Zalo Admin"
                subtitle="Phản hồi 1 phút"
              />
              <ContactButton
                href={CONTACTS.messenger}
                className="bg-gradient-to-br from-[#0084FF] to-[#0061fa] text-white shadow-lg shadow-blue-500/30"
                icon={Users}
                title="Messenger Fb"
                subtitle="Hỗ trợ 24/7"
              />
            </div>

            <a
              href={CONTACTS.zaloGroup}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:border-blue-500"
            >
              <GroupDots />
              Tham gia Nhóm Zalo Báo Giá (+2000 TV)
            </a>
          </section>
        </div>

        <div className="mt-5 flex animate-[fadeSlideUp_1s_ease-out_0.3s_forwards] justify-center opacity-0" style={{ transform: "translateY(0.5rem)" }}>
          <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-5 py-2.5 shadow-xl backdrop-blur-xl">
            <Globe className="size-4 text-blue-500" />
            <span className="text-xs font-bold tracking-wide text-slate-600">{BRAND.tagline} Network</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-60" />;
}

function OfferCard({ offer }: { offer: (typeof PREMIUM_OFFERS)[number] }) {
  return (
    <a
      href={CONTACTS.zaloPersonal}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex items-center gap-4 rounded-2xl border-2 border-slate-100 bg-white p-3 pr-4 shadow-sm transition-all duration-300 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10"
    >
      {offer.tag === "HOT" ? (
        <div className="absolute -right-2.5 -top-2.5 animate-pulse rounded-full border border-white bg-rose-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-lg">
          Bán chạy
        </div>
      ) : null}

      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br ${offer.gradient} shadow-inner transition-transform group-hover:scale-105`}
      >
        <offer.icon className="size-6 text-white" strokeWidth={2} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black leading-tight text-slate-800 transition-colors group-hover:text-blue-600">
          {offer.label}
        </p>
        <p className="mt-1 truncate text-[10px] font-bold text-slate-500">{offer.desc}</p>
      </div>

      <div className="flex flex-col items-end border-l border-slate-100 pl-2">
        <span className="mb-0.5 text-[10px] font-bold uppercase text-slate-400 line-through opacity-60">Gốc</span>
        <p className="text-lg font-black leading-none tracking-tighter text-blue-600">{offer.price}</p>
      </div>
    </a>
  );
}

function ActionButton({
  action,
  onClick,
  label,
  className,
}: {
  action: { label: string; href?: string };
  onClick?: () => void;
  label?: string;
  className: string;
}) {
  const content = (
    <>
      <span>{label || action.label}</span>
      {onClick ? <RotateCcw className="size-3.5" /> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-colors ${className}`}
      >
        {content}
      </button>
    );
  }

  const href = action.href || "/";
  if (href.startsWith("http")) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-colors ${className}`}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-colors ${className}`}>
      {content}
    </Link>
  );
}

function ContactButton({
  href,
  className,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  className: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex flex-col items-center gap-2 rounded-2xl p-3 transition-all active:scale-[0.98] ${className}`}
    >
      <Icon className="size-6" />
      <div className="text-center">
        <span className="block text-xs font-bold">{title}</span>
        <span className="text-[9px] font-medium opacity-80">{subtitle}</span>
      </div>
    </a>
  );
}

function GroupDots() {
  return (
    <div className="flex -space-x-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white bg-blue-100 text-[8px]">👤</div>
      <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white bg-green-100 text-[8px]">👤</div>
      <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white bg-purple-100 text-[8px]">👤</div>
    </div>
  );
}

function DecorativeBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full bg-blue-500/10 blur-[120px] animate-pulse" />
      <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-violet-400/10 to-cyan-400/10 blur-[150px]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.02)_1px,transparent_1px)] bg-[size:32px_32px]" />
    </div>
  );
}
