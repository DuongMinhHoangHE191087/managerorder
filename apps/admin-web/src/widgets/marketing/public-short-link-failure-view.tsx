import { ArrowRight, BadgeCheck, ExternalLink, LockKeyhole, MessageCircle, Sparkles } from "lucide-react";
import type { ShortLinkFailureTemplateKey } from "@/lib/domain/types";
import type { OfferCard } from "@/widgets/marketing/sales-landing-config";
import { BRAND, CONTACTS, PREMIUM_OFFERS, type SalesLandingVariant } from "@/widgets/marketing/sales-landing-config";
import { PublicPageSecurityGuard } from "./public-page-security-guard";

const REASON_LABELS: Record<SalesLandingVariant, string> = {
  not_found: "Liên kết không tồn tại",
  error: "Liên kết đang gián đoạn",
  expired: "Liên kết đã hết hạn",
  token_required: "Cần mã xác thực",
  blocked: "Liên kết đang bị khóa",
  unauthorized: "Không có quyền truy cập",
  auth_failed: "Xác thực không thành công",
};

interface PublicShortLinkFailureViewProps {
  reason: SalesLandingVariant;
  templateKey: ShortLinkFailureTemplateKey;
  offers?: OfferCard[];
  sellerContactUrl?: string | null;
  customerOfferCtaHref?: string;
  sellerUnlockMessage?: string;
}

export function PublicShortLinkFailureView({
  reason,
  templateKey,
  offers,
  sellerContactUrl,
  customerOfferCtaHref = "https://duongminhhoang.store",
  sellerUnlockMessage = "Link này đã hết hạn. Hãy gửi yêu cầu đến người bán để mở lại.",
}: PublicShortLinkFailureViewProps) {
  if (templateKey === "seller_unlock_request") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#f6fbf3] px-4 py-8 text-slate-900">
        <PublicPageSecurityGuard />
        <div className="absolute left-[-10%] top-[-18%] h-72 w-72 rounded-full bg-lime-300/35 blur-3xl" />
        <div className="absolute bottom-[-12%] right-[-8%] h-80 w-80 rounded-full bg-emerald-300/30 blur-3xl" />

        <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl items-center justify-center">
          <div className="w-full rounded-[34px] border border-white/80 bg-white/92 p-7 text-center shadow-[0_28px_90px_-24px_rgba(22,101,52,0.35)] backdrop-blur sm:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-lime-400 to-emerald-600 text-white shadow-xl shadow-emerald-500/25">
              <LockKeyhole className="size-9" />
            </div>
            <p className="mt-7 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">
              {REASON_LABELS[reason]}
            </p>
            <h1 className="mt-3 text-balance text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {sellerUnlockMessage}
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm font-medium leading-7 text-slate-600">
              Đây là link dành cho cộng tác viên hoặc người mua qua người bán. Hệ thống không hiển thị quảng cáo ở màn này để tránh gây nhiễu luồng hỗ trợ.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {sellerContactUrl ? (
                <a
                  href={sellerContactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-xl shadow-slate-900/20 transition-transform hover:-translate-y-0.5"
                >
                  <MessageCircle className="size-4" />
                  Liên hệ người bán
                </a>
              ) : null}
              <a
                href={CONTACTS.zaloPersonal}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-800 transition-colors hover:bg-emerald-100"
              >
                Hỗ trợ hệ thống
                <ExternalLink className="size-4" />
              </a>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const visibleOffers = offers?.length ? offers : PREMIUM_OFFERS;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07130d] px-4 py-8 text-white">
      <PublicPageSecurityGuard />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.32),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.28),transparent_34%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/70 to-transparent" />

      <section className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[36px] border border-white/10 bg-white/[0.07] p-7 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/30 bg-lime-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-lime-100">
            <BadgeCheck className="size-4 text-lime-300" />
            {BRAND.name}
          </div>
          <p className="mt-8 text-sm font-black uppercase tracking-[0.24em] text-lime-300">
            {REASON_LABELS[reason]}
          </p>
          <h1 className="mt-4 text-balance text-4xl font-black tracking-tight sm:text-5xl">
            Link không còn mở được, nhưng bạn vẫn có thể mua gói chính hãng tại đây.
          </h1>
          <p className="mt-5 max-w-xl text-base font-medium leading-8 text-emerald-50/75">
            Chọn nhanh dịch vụ phù hợp hoặc chuyển sang website bán hàng để xem đầy đủ bảng giá, ưu đãi và hướng dẫn kích hoạt.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={customerOfferCtaHref}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-lime-300 px-6 py-3 text-sm font-black text-slate-950 shadow-xl shadow-lime-300/20 transition-transform hover:-translate-y-0.5"
            >
              Mua hàng tại duongminhhoang.store
              <ArrowRight className="size-4" />
            </a>
            <a
              href={CONTACTS.zaloPersonal}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-black text-white backdrop-blur transition-colors hover:bg-white/15"
            >
              Tư vấn nhanh
              <MessageCircle className="size-4" />
            </a>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {visibleOffers.map((offer) => (
            <a
              key={offer.label}
              href={offer.href || customerOfferCtaHref}
              rel="noopener noreferrer nofollow"
              className="group rounded-[28px] border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-lime-300/50 hover:bg-white/[0.12]"
            >
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${offer.gradient} shadow-inner`}>
                <offer.icon className="size-7 text-white" />
              </div>
              <div className="mt-5 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-lime-300/15 px-2 py-0.5 text-[10px] font-black text-lime-100">
                      {offer.tag}
                    </span>
                    <Sparkles className="size-3.5 text-lime-300" />
                  </div>
                  <h2 className="mt-2 text-lg font-black tracking-tight">{offer.label}</h2>
                  <p className="mt-1 text-sm font-medium leading-6 text-emerald-50/65">{offer.desc}</p>
                </div>
                <p className="shrink-0 text-xl font-black text-lime-300">{offer.price}</p>
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
