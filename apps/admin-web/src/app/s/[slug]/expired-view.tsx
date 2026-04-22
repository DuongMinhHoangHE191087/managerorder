"use client";

import { SalesLandingView, SalesLandingVariant } from "@/widgets/marketing/sales-landing-view";
import type { OfferCard } from "@/widgets/marketing/sales-landing-config";

interface ExpiredViewProps {
  reason: SalesLandingVariant;
  offers?: OfferCard[];
}

export function ExpiredView({ reason, offers }: ExpiredViewProps) {
  return <SalesLandingView variant={reason} offers={offers} />;
}

