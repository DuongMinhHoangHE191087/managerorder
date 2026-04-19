import { SalesLandingView } from "@/widgets/marketing/sales-landing-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function BlockedBySecurity404Page() {
  return <SalesLandingView variant="blocked" />;
}
