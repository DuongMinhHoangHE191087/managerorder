import {
  ArrowRight,
  BadgeCheck,
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
import { PublicPageSecurityGuard } from "./public-page-security-guard";

type ShortLinkPublicViewProps = {
  title: string | null;
  ctaHref: string;
  templateKey: ShortLinkLandingTemplateKey;
  requiresToken: boolean;
  resolvedDeliveryMode: ShortLinkResolvedDeliveryMode;
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

export function ShortLinkPublicView({
  title,
  ctaHref,
  templateKey,
  requiresToken,
  resolvedDeliveryMode,
}: ShortLinkPublicViewProps) {
  const copy = TEMPLATE_COPY[templateKey];
  const isCtv = templateKey === "ctv_neutral";
  const showOwnerBranding = templateKey === "owner_intro";
  const showSupportAction = templateKey === "owner_intro";
  const themeColor = isCtv ? "sky" : ("emerald" as const);

  // Dynamic visual configurations
  const bgGradient = isCtv
    ? "bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_38%),linear-gradient(180deg,_#050811_0%,_#08101e_50%,_#050811_100%)]"
    : "bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_38%),linear-gradient(180deg,_#050c08_0%,_#091711_50%,_#050c08_100%)]";

  const orb1 = isCtv ? "bg-sky-500/5 blur-[120px]" : "bg-emerald-500/10 blur-[150px]";
  const orb2 = isCtv ? "bg-slate-500/3 blur-[150px] opacity-15" : "bg-cyan-500/10 blur-[180px] opacity-20";

  const badgeClass = isCtv
    ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

  const accentText = isCtv ? "text-sky-400" : "text-emerald-400";
  
  const ctaButton = isCtv
    ? "from-sky-400 to-cyan-500 text-white shadow-sky-500/20 hover:shadow-sky-500/30 hover:from-sky-500 hover:to-cyan-600"
    : "from-lime-400 to-emerald-500 text-slate-950 shadow-emerald-500/25 hover:shadow-emerald-500/35 hover:from-lime-550 hover:to-emerald-600";

  const sectionBorder = isCtv
    ? "border-sky-500/10 hover:border-sky-500/20"
    : "border-white/10 hover:border-emerald-500/20";

  return (
    <main className={`relative min-h-screen overflow-hidden px-4 py-8 text-white sm:px-6 lg:px-8 ${bgGradient}`}>
      <PublicPageSecurityGuard />
      <div className="pointer-events-none absolute inset-0">
        <div className={`absolute left-1/4 top-0 h-96 w-96 rounded-full ${orb1}`} />
        <div className={`absolute right-1/4 bottom-0 h-[500px] w-[500px] rounded-full ${orb2}`} />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.003)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.003)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col justify-center gap-6">
        <section className={`overflow-hidden rounded-[32px] border bg-white/[0.03] shadow-[0_32px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-all duration-300 ${sectionBorder}`}>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="px-6 py-8 sm:px-8 lg:px-10">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${badgeClass}`}>
                <BadgeCheck className="size-3.5 animate-pulse" />
                {copy.badge}
              </div>

              {showOwnerBranding ? (
                <div className="mt-5 flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={BRAND.logoUrl}
                    alt={BRAND.name}
                    className="h-16 w-16 rounded-[20px] border-4 border-white/10 object-cover shadow-lg shadow-emerald-500/10"
                  />
                  <div>
                    <p className={`text-xs font-black uppercase tracking-[0.18em] ${accentText}`}>
                      {BRAND.tagline}
                    </p>
                    <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                      {title || "Liên kết chia sẻ"}
                    </h1>
                    <p className="mt-1 text-sm font-medium text-slate-400">{copy.subtitle}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                    {title || "Liên kết chia sẻ"}
                  </h1>
                  <p className="mt-2 text-sm font-medium text-slate-400">{copy.subtitle}</p>
                </div>
              )}

              <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-350">{copy.description}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <PublicMetric
                  icon={ShieldCheck}
                  label="Lớp xử lý"
                  value={resolvedDeliveryMode === "landing_page" ? "Landing relay bảo mật" : "Chuyển tiếp máy chủ"}
                  themeColor={themeColor}
                />
                <PublicMetric
                  icon={Lock}
                  label="Kiểm tra"
                  value={requiresToken ? "Token, IP và thiết bị" : "Bot, IPv4 và IPv6"}
                  themeColor={themeColor}
                />
                <PublicMetric
                  icon={BadgeCheck}
                  label="Ẩn đích"
                  value="URL đích được giữ trong lớp máy chủ"
                  themeColor={themeColor}
                />
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={ctaHref}
                  rel="nofollow"
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r px-6 py-3.5 text-sm font-black shadow-lg transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 ${ctaButton}`}
                >
                  {copy.cta}
                  <ArrowRight className="size-4" />
                </a>
                {showSupportAction ? (
                  <a
                    href={CONTACTS.zaloPersonal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-black text-slate-200 hover:bg-white/10 hover:border-emerald-500/20 transition-all duration-150"
                  >
                    Liên hệ hỗ trợ Zalo
                  </a>
                ) : null}
              </div>
            </div>

            <aside className="border-t border-white/10 bg-black/30 px-6 py-8 text-white lg:border-l lg:border-t-0 lg:px-8">
              <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] ${isCtv ? "text-sky-300" : "text-emerald-300"}`}>
                <Sparkles className="size-4 animate-pulse" />
                Điểm tin cậy
              </div>

              <div className="mt-5 space-y-3">
                {TRUST_STACK.map((item) => (
                  <TrustCard key={item.label} icon={item.icon} title={item.label} description={item.desc} themeColor={themeColor} />
                ))}
              </div>

              {showOwnerBranding ? (
                <div className="mt-6 rounded-3xl border border-white/5 bg-white/[0.02] p-4 hover:border-emerald-500/10 transition-colors">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">Thông tin chính thức</p>
                  <p className="mt-3 text-lg font-black text-slate-100">{BRAND.name}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-350">
                    Trang chia sẻ đang dùng mẫu giới thiệu của shop để người mua hoặc cộng tác viên có thể gửi link an toàn hơn khi bán hàng.
                  </p>
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-white/5 bg-white/[0.02] p-4 hover:border-sky-500/10 transition-colors">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">Mẫu CTV trung tính</p>
                  <p className="mt-3 text-sm leading-6 text-slate-350">
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
  themeColor = "emerald",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  themeColor?: "emerald" | "sky";
}) {
  const iconColor = themeColor === "sky" ? "text-sky-400" : "text-emerald-400";
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 transition hover:bg-white/[0.04]">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
        <Icon className={`size-3.5 ${iconColor}`} />
        {label}
      </div>
      <p className="mt-2 text-sm font-bold text-slate-200">{value}</p>
    </div>
  );
}

function TrustCard({
  icon: Icon,
  title,
  description,
  themeColor = "emerald",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  themeColor?: "emerald" | "sky";
}) {
  const iconColor = themeColor === "sky" ? "text-sky-300" : "text-emerald-300";
  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10 hover:bg-white/[0.04]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5">
          <Icon className={`size-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm font-black text-slate-100">{title}</p>
          <p className="mt-1 text-xs text-slate-450 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}
