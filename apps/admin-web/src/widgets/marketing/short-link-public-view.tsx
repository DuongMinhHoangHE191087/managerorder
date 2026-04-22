import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Globe,
  Lock,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type {
  ShortLinkLandingTemplateKey,
  ShortLinkResolvedDeliveryMode,
} from "@/lib/domain/types";
import { BRAND, CONTACTS, TRUST_STACK } from "./sales-landing-config";

type ShortLinkPublicViewProps = {
  slug: string;
  title: string | null;
  targetUrl: string;
  ctaHref: string;
  templateKey: ShortLinkLandingTemplateKey;
  requiresToken: boolean;
  resolvedDeliveryMode: ShortLinkResolvedDeliveryMode;
  salesChannelName?: string | null;
};

type TemplateCopy = {
  badge: string;
  title: string;
  description: string;
  cta: string;
  subtitle: string;
};

const TEMPLATE_COPY: Record<ShortLinkLandingTemplateKey, TemplateCopy> = {
  owner_intro: {
    badge: "Giới thiệu chính thức",
    title: "Mở liên kết an toàn",
    description:
      "Liên kết này đang dùng trang giới thiệu bán hàng chuẩn của shop. Bạn có thể xem nhanh thông tin tin cậy rồi tiếp tục tới trang đích khi sẵn sàng.",
    cta: "Tiếp tục tới trang đích",
    subtitle: "Kèm phần giới thiệu và nhận diện chính thức của shop",
  },
  ctv_neutral: {
    badge: "Mẫu trung tính cho CTV",
    title: "Xác nhận trước khi tiếp tục",
    description:
      "Trang chia sẻ này dùng mẫu trung tính để CTV có thể bán hàng mà không hiển thị phần giới thiệu riêng của chủ shop. Bạn vẫn được bảo vệ bởi lớp kiểm tra truy cập và chống gian lận.",
    cta: "Mở trang đích ngay",
    subtitle: "Không hiển thị branding của chủ shop, chỉ giữ thông tin tin cậy cơ bản",
  },
};

function maskTargetHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function ShortLinkPublicView({
  slug,
  title,
  targetUrl,
  ctaHref,
  templateKey,
  requiresToken,
  resolvedDeliveryMode,
  salesChannelName,
}: ShortLinkPublicViewProps) {
  const copy = TEMPLATE_COPY[templateKey];
  const targetHost = maskTargetHost(targetUrl);
  const showOwnerBranding = templateKey === "owner_intro";
  const showSupportAction = templateKey === "owner_intro";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eff6ff_45%,_#f8fafc_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute right-0 top-32 h-64 w-64 rounded-full bg-indigo-300/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col justify-center gap-6">
        <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/90 shadow-[0_28px_80px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="px-6 py-8 sm:px-8 lg:px-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">
                <BadgeCheck className="size-3.5" />
                {copy.badge}
              </div>

              {showOwnerBranding ? (
                <div className="mt-5 flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={BRAND.logoUrl}
                    alt={BRAND.name}
                    className="h-16 w-16 rounded-[20px] border-4 border-white object-cover shadow-lg"
                  />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-600">
                      {BRAND.tagline}
                    </p>
                    <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                      {title || "Liên kết chia sẻ"}
                    </h1>
                    <p className="mt-1 text-sm font-medium text-slate-500">{copy.subtitle}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                    {title || "Liên kết chia sẻ"}
                  </h1>
                  <p className="mt-2 text-sm font-medium text-slate-500">{copy.subtitle}</p>
                </div>
              )}

              <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-600">{copy.description}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <PublicMetric
                  icon={ShieldCheck}
                  label="Chế độ phát"
                  value={resolvedDeliveryMode === "landing_page" ? "Qua landing" : "Chuyển trực tiếp"}
                />
                <PublicMetric icon={Globe} label="Tên miền đích" value={targetHost} />
                <PublicMetric
                  icon={Lock}
                  label="Bảo vệ"
                  value={requiresToken ? "Token + khóa IP" : "Chuẩn an toàn"}
                />
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={ctaHref}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  {copy.cta}
                  <ArrowRight className="size-4" />
                </Link>
                {showSupportAction ? (
                  <a
                    href={CONTACTS.zaloPersonal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-sky-300 hover:text-slate-950"
                  >
                    Liên hệ hỗ trợ Zalo
                  </a>
                ) : null}
              </div>

              <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Slug: /s/{slug}</span>
                {salesChannelName ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                    Kênh bán: {salesChannelName}
                  </span>
                ) : null}
              </div>
            </div>

            <aside className="border-t border-slate-200/70 bg-slate-950 px-6 py-8 text-white lg:border-l lg:border-t-0 lg:px-8">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-sky-200">
                <Sparkles className="size-4" />
                Điểm tin cậy
              </div>

              <div className="mt-5 space-y-3">
                {TRUST_STACK.map((item) => (
                  <TrustCard key={item.label} icon={item.icon} title={item.label} description={item.desc} />
                ))}
              </div>

              {showOwnerBranding ? (
                <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-200">Thông tin chính thức</p>
                  <p className="mt-3 text-lg font-black">{BRAND.name}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Trang chia sẻ đang dùng mẫu giới thiệu của shop để người mua hoặc cộng tác viên có thể gửi link an toàn hơn khi bán hàng.
                  </p>
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-200">Mẫu CTV trung tính</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Mẫu này ẩn phần branding riêng của chủ shop và chỉ giữ các tín hiệu tin cậy, phù hợp để CTV dùng chung khi bán hàng.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function PublicMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
        <Icon className="size-3.5 text-sky-600" />
        {label}
      </div>
      <p className="mt-2 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function TrustCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
          <Icon className="size-5 text-sky-200" />
        </div>
        <div>
          <p className="text-sm font-black">{title}</p>
          <p className="mt-1 text-xs text-slate-300">{description}</p>
        </div>
      </div>
    </div>
  );
}
