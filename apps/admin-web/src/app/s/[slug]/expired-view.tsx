import type { ShortLinkFailureTemplateKey } from "@/lib/domain/types";
import type { SalesLandingVariant } from "@/widgets/marketing/sales-landing-view";
import { PublicShortLinkFailureView } from "@/widgets/marketing/public-short-link-failure-view";
import type { OfferCard } from "@/widgets/marketing/sales-landing-config";

interface ExpiredViewProps {
  reason: SalesLandingVariant;
  offers?: OfferCard[];
  templateKey?: ShortLinkFailureTemplateKey;
  sellerContactUrl?: string | null;
  customerOfferCtaHref?: string;
  sellerUnlockMessage?: string;
}

export function ExpiredView({
  reason,
  offers,
  templateKey = "customer_offer_wall",
  sellerContactUrl,
  customerOfferCtaHref,
  sellerUnlockMessage,
}: ExpiredViewProps) {
  return (
    <PublicShortLinkFailureView
      reason={reason}
      offers={offers}
      templateKey={templateKey}
      sellerContactUrl={sellerContactUrl}
      customerOfferCtaHref={customerOfferCtaHref}
      sellerUnlockMessage={sellerUnlockMessage}
    />
  );
}

