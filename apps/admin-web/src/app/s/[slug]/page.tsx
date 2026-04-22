import type { Metadata, Viewport } from "next";
import {
  resolvePublicShortLinkBySlug,
  resolvePublicShortLinkSummaryBySlug,
} from "@/domains/short-links";
import { buildSalesLandingOffers } from "@/lib/settings/sales-landing";
import { getSystemSettings } from "@/lib/supabase/repositories/system-settings.repo";
import { vi } from "@/shared/messages/vi";
import { ExpiredView } from "./expired-view";
import { ShortLinkPublicView } from "@/widgets/marketing/short-link-public-view";

// Active links -> instant server-side redirect (fastest possible)
// Expired/invalid -> branded trust page with contacts + QR
export const dynamic = "force-dynamic";

const LOGO_URL = "https://ucqmmgopljyugxojntjv.supabase.co/storage/v1/object/public/anhAVT/avt-duolingodmh-duongminhhoang.jpeg";
const SITE_NAME = vi.navigation.brand.title;
const BRAND_FULL = `${vi.navigation.brand.subtitle} — ${vi.navigation.brand.title}`;
const BRAND_DOMAIN = "duongminhhoang.store";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ t?: string | string[] }>;
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await resolvePublicShortLinkSummaryBySlug(slug);
  const link = detail?.link ?? null;

  const isActive = link && link.status === "active";

  const title = isActive
    ? `${link.title || vi.shortLinks.detail.unnamed} — ${SITE_NAME}`
    : `${SITE_NAME} — ${vi.shortLinks.detail.notFoundTitle}`;

  const description = isActive
    ? vi.shortLinks.public.activeDescription
    : vi.shortLinks.public.expiredDescription;

  return {
    title,
    description,
    applicationName: SITE_NAME,
    authors: [{ name: vi.navigation.brand.title, url: `https://${BRAND_DOMAIN}` }],
    creator: vi.navigation.brand.title,
    publisher: SITE_NAME,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: BRAND_FULL,
      locale: "vi_VN",
      images: [
        {
          url: LOGO_URL,
          width: 512,
          height: 512,
          alt: SITE_NAME,
          type: "image/jpeg",
        },
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [LOGO_URL],
      creator: "@duongminhhoang",
    },
    icons: {
      icon: LOGO_URL,
      apple: LOGO_URL,
    },
    other: {
      "zalo:title": title,
      "zalo:description": description,
      "zalo:image": LOGO_URL,
    },
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function ShortLinkPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const summary = await resolvePublicShortLinkSummaryBySlug(slug);
  const systemSettings = await getSystemSettings().catch(() => null);
  const offers = buildSalesLandingOffers(systemSettings?.sales_landing_config ?? null);
  const tokenParam = await searchParams;
  const token = typeof tokenParam?.t === "string" ? tokenParam.t : Array.isArray(tokenParam?.t) ? tokenParam.t[0] : null;

  if (!summary) return <ExpiredView reason="not_found" offers={offers} />;

  const { link: summaryLink, resolvedPolicy } = summary;

  if (summaryLink.status !== "active") return <ExpiredView reason="expired" offers={offers} />;
  if (summaryLink.expires_at && new Date(summaryLink.expires_at) <= new Date()) return <ExpiredView reason="expired" offers={offers} />;
  if (summaryLink.max_clicks > 0 && summaryLink.current_clicks >= summaryLink.max_clicks) return <ExpiredView reason="expired" offers={offers} />;
  if (summaryLink.require_token && summaryLink.access_token && token !== summaryLink.access_token) {
    return <ExpiredView reason="token_required" offers={offers} />;
  }

  if (resolvedPolicy.effectiveDeliveryMode === "landing_page") {
    const detail = await resolvePublicShortLinkBySlug(slug);
    if (!detail) return <ExpiredView reason="not_found" offers={offers} />;
    const { link, salesChannel } = detail;
    const url = new URL(`/s/${slug}/go`, "https://placeholder.local");
    if (token) {
      url.searchParams.set("t", token);
    }

    return (
      <ShortLinkPublicView
        slug={slug}
        title={link.title}
        targetUrl={link.target_url}
        ctaHref={`${url.pathname}${url.search}`}
        templateKey={resolvedPolicy.effectiveLandingTemplateKey ?? "owner_intro"}
        requiresToken={Boolean(link.require_token)}
        resolvedDeliveryMode={resolvedPolicy.effectiveDeliveryMode}
        salesChannelName={salesChannel?.name ?? null}
      />
    );
  }

  const apiRedirectUrl = new URL(`/s/${slug}/go`, "https://placeholder.local");
  if (token) {
    apiRedirectUrl.searchParams.set("t", token);
  }

  const apiRedirectPath = `${apiRedirectUrl.pathname}${apiRedirectUrl.search}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
      <div className="max-w-md space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">
          Đang chuyển hướng an toàn
        </p>
        <p className="text-sm text-slate-300">
          Hệ thống đang dẫn bạn qua lớp bảo vệ nội bộ trước khi mở liên kết đích.
        </p>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.location.replace(${JSON.stringify(apiRedirectPath)});`,
          }}
        />
        <p className="text-xs text-slate-500">
          Nếu trình duyệt không tự chuyển, hãy mở liên kết nội bộ sau: {apiRedirectPath}
        </p>
      </div>
    </main>
  );
}
