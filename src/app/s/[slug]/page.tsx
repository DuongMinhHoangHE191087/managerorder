import { getShortLinkBySlug } from "@/lib/supabase/repositories/short-links.repo";
import { ExpiredView } from "./expired-view";
import { redirect } from "next/navigation";
import type { Metadata, Viewport } from "next";

// Active links → instant server-side redirect (fastest possible)
// Expired/invalid → branded trust page with contacts + QR
export const dynamic = "force-dynamic";

const LOGO_URL = "https://ucqmmgopljyugxojntjv.supabase.co/storage/v1/object/public/anhAVT/avt-duolingodmh-duongminhhoang.jpeg";
const SITE_NAME = "Dương Minh Hoàng";
const BRAND_FULL = "Hệ thống quản lý — Dương Minh Hoàng";
const BRAND_DOMAIN = "duongminhhoang.store";

interface PageProps {
  params: Promise<{ slug: string }>;
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
  const link = await getShortLinkBySlug(slug);

  const isActive = link && link.status === "active";

  // Rich, trust-building OG metadata
  const title = isActive
    ? `${link.title || "Liên kết được bảo vệ"} — ${SITE_NAME}`
    : `${SITE_NAME} — Liên kết đã hết hạn`;

  const description = isActive
    ? `🔒 Truy cập an toàn qua hệ thống bảo mật Dương Minh Hoàng. Liên kết được xác minh SSL, chống gian lận và bảo vệ bởi Anti-Fraud System.`
    : `⚠️ Liên kết đã hết hạn hoặc không khả dụng. Vui lòng liên hệ Dương Minh Hoàng để nhận link mới — Zalo: 0394497949`;

  return {
    title,
    description,
    applicationName: SITE_NAME,
    authors: [{ name: "Dương Minh Hoàng", url: `https://${BRAND_DOMAIN}` }],
    creator: "Dương Minh Hoàng",
    publisher: SITE_NAME,

    openGraph: {
      title,
      description,
      type: "website",
      siteName: BRAND_FULL,
      locale: "vi_VN",
      images: [{
        url: LOGO_URL,
        width: 512,
        height: 512,
        alt: SITE_NAME,
        type: "image/jpeg",
      }],
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

    // Zalo specific — uses OG tags but benefits from clear locale
    other: {
      "zalo:title": title,
      "zalo:description": description,
      "zalo:image": LOGO_URL,
    },

    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function ShortLinkPage({ params }: PageProps) {
  const { slug } = await params;
  const link = await getShortLinkBySlug(slug);

  if (!link) return <ExpiredView reason="not_found" />;
  if (link.require_token) return <ExpiredView reason="token_required" />;
  if (link.status !== "active") return <ExpiredView reason="expired" />;

  // Active link → instant server-side redirect (no animation, fastest)
  redirect(link.target_url);
}

