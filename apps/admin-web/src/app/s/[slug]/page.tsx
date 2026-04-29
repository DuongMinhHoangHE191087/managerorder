import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import {
  logShortLinkClick,
  resolvePublicShortLinkBySlug,
  resolvePublicShortLinkSummaryBySlug,
} from "@/domains/short-links";
import {
  createShortLinkClickRecord,
  getShortLinkVisitorFingerprint,
  type ShortLinkVisitorFingerprint,
} from "@/domains/short-links/services/visitor";
import { DEFAULT_SALES_LANDING_CONFIG, buildSalesLandingOffers } from "@/lib/settings/sales-landing";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import { getSystemSettings } from "@/lib/supabase/repositories/system-settings.repo";
import { vi } from "@/shared/messages/vi";
import {
  isShortLinkRelayEnabled,
  SHORT_LINK_RELAY_COOKIE_NAME,
  verifyShortLinkRelayCookieValue,
} from "@/domains/short-links/services/public-relay";
import { PublicPageSecurityGuard } from "@/widgets/marketing/public-page-security-guard";
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

async function logKnownShortLinkVisit(
  linkId: string,
  eventType: "bot_preview" | "landing_view" | "blocked",
  visitor: ShortLinkVisitorFingerprint,
  suspiciousReason?: string | null,
  forceSuspicious = false,
) {
  await logShortLinkClick(
    supabase,
    createShortLinkClickRecord(linkId, eventType, visitor, {
      is_suspicious: forceSuspicious || visitor.isAutomated,
      suspicious_reason: suspiciousReason ?? visitor.suspiciousReason,
    }),
    "[ShortLinkPublic]",
  );
}

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
  const requestHeaders = await headers();
  const requestCookies = await cookies();
  const visitor = getShortLinkVisitorFingerprint(requestHeaders);
  const landingViewLoggedByProxy = requestHeaders.get("x-short-link-landing-view-logged") === "1";
  const blockedLoggedByProxy = requestHeaders.get("x-short-link-blocked-logged") === "1";
  const proxyBlockedReason = requestHeaders.get("x-short-link-blocked-reason");
  const systemSettings = await getSystemSettings().catch(() => null);
  const landingConfig = systemSettings?.sales_landing_config ?? DEFAULT_SALES_LANDING_CONFIG;
  const failureDefaults = landingConfig.shortLinkFailureDefaults ?? DEFAULT_SALES_LANDING_CONFIG.shortLinkFailureDefaults;
  const summary = await resolvePublicShortLinkSummaryBySlug(slug, {
    defaultFailureTemplateKey: failureDefaults.defaultTemplateKey,
  });
  const offers = buildSalesLandingOffers(landingConfig);
  const tokenParam = await searchParams;
  const token =
    typeof tokenParam?.t === "string" ? tokenParam.t : Array.isArray(tokenParam?.t) ? tokenParam.t[0] : null;
  const relayState = await verifyShortLinkRelayCookieValue(
    requestCookies.get(SHORT_LINK_RELAY_COOKIE_NAME)?.value,
    { userAgent: requestHeaders.get("user-agent") },
  );
  const effectiveToken = token ?? (relayState?.slug === slug ? relayState.token : null);

  const failureViewProps = {
    offers,
    customerOfferCtaHref: failureDefaults.customerOfferCtaHref,
    sellerUnlockMessage: failureDefaults.sellerUnlockMessage,
  };

  if (!summary) {
    return (
      <ExpiredView
        reason="not_found"
        templateKey={failureDefaults.defaultTemplateKey}
        {...failureViewProps}
      />
    );
  }

  const { link: summaryLink, resolvedPolicy } = summary;
  const knownLinkFailureProps = {
    ...failureViewProps,
    templateKey: resolvedPolicy.effectiveFailureTemplateKey,
    sellerContactUrl: resolvedPolicy.sellerContactUrl,
  };

  if (summaryLink.status !== "active") {
    await logKnownShortLinkVisit(summaryLink.id, "blocked", visitor, "inactive_link");
    return <ExpiredView reason="expired" {...knownLinkFailureProps} />;
  }
  if (summaryLink.expires_at && new Date(summaryLink.expires_at) <= new Date()) {
    await logKnownShortLinkVisit(summaryLink.id, "blocked", visitor, "expired_link");
    return <ExpiredView reason="expired" {...knownLinkFailureProps} />;
  }
  if (summaryLink.max_clicks > 0 && summaryLink.current_clicks >= summaryLink.max_clicks) {
    await logKnownShortLinkVisit(summaryLink.id, "blocked", visitor, "click_limit_reached");
    return <ExpiredView reason="expired" {...knownLinkFailureProps} />;
  }
  if (summaryLink.require_token && summaryLink.access_token && effectiveToken !== summaryLink.access_token) {
    await logKnownShortLinkVisit(
      summaryLink.id,
      "blocked",
      visitor,
      effectiveToken ? "invalid_token" : "missing_token",
      true,
    );
    return <ExpiredView reason="token_required" {...knownLinkFailureProps} />;
  }
  const lockedIp = visitor.ipVersion === "IPv6" ? summaryLink.locked_ipv6 : summaryLink.locked_ip;
  if (lockedIp && lockedIp !== visitor.ipAddress) {
    if (!blockedLoggedByProxy) {
      await logKnownShortLinkVisit(
        summaryLink.id,
        "blocked",
        visitor,
        proxyBlockedReason ?? `ip_mismatch_${visitor.ipVersion}`,
        true,
      );
    }
    return <ExpiredView reason="blocked" {...knownLinkFailureProps} />;
  }

  if (resolvedPolicy.effectiveDeliveryMode === "landing_page") {
    const detail = await resolvePublicShortLinkBySlug(slug, {
      defaultFailureTemplateKey: failureDefaults.defaultTemplateKey,
    });
    if (!detail) return <ExpiredView reason="not_found" templateKey={failureDefaults.defaultTemplateKey} {...failureViewProps} />;
    const { link } = detail;
    const url = new URL(`/s/${slug}/go`, "https://placeholder.local");
    if (effectiveToken) {
      url.searchParams.set("t", effectiveToken);
    }
    const ctaHref = isShortLinkRelayEnabled() ? "/s/go" : `${url.pathname}${url.search}`;

    if (!landingViewLoggedByProxy) {
      await logKnownShortLinkVisit(
        link.id,
        visitor.isAutomated ? "bot_preview" : "landing_view",
        visitor,
        visitor.suspiciousReason,
      );
    }

    return (
      <ShortLinkPublicView
        title={link.title}
        ctaHref={ctaHref}
        templateKey={resolvedPolicy.effectiveLandingTemplateKey ?? "owner_intro"}
        requiresToken={Boolean(link.require_token)}
        resolvedDeliveryMode={resolvedPolicy.effectiveDeliveryMode}
      />
    );
  }

  const apiRedirectUrl = new URL(`/s/${slug}/go`, "https://placeholder.local");
  if (token) {
    apiRedirectUrl.searchParams.set("t", token);
  }

  const apiRedirectPath = `${apiRedirectUrl.pathname}${apiRedirectUrl.search}`;
  if (visitor.isAutomated) {
    await logKnownShortLinkVisit(summaryLink.id, "bot_preview", visitor, visitor.suspiciousReason);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
      <PublicPageSecurityGuard />
      <div className="max-w-md space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">
          Đang chuyển hướng an toàn
        </p>
        <p className="text-sm text-slate-300">
          Yêu cầu đang được chuyển qua lớp xử lý máy chủ trước khi mở liên kết đích.
        </p>
        <div className="pt-2">
          <a
            href={apiRedirectPath}
            rel="nofollow"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition-transform hover:-translate-y-0.5"
          >
            Tiếp tục qua lớp bảo vệ
          </a>
        </div>
      </div>
    </main>
  );
}
