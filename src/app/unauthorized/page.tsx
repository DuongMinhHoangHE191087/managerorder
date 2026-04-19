import type { Metadata } from "next";
import { UnauthorizedClientPage } from "./unauthorized-client";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function UnauthorizedPage() {
  return <UnauthorizedClientPage />;
}
