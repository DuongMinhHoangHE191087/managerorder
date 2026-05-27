import type { Metadata, Viewport } from "next";
import { AccountSharePublicView } from "@/widgets/pages/share/account-share-public-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chia sẻ tài khoản",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <AccountSharePublicView slug={slug} />;
}
