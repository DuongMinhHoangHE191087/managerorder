"use client";

import { SalesLandingView, SalesLandingVariant } from "@/widgets/marketing/sales-landing-view";

interface ExpiredViewProps {
  reason: SalesLandingVariant;
}

export function ExpiredView({ reason }: ExpiredViewProps) {
  return <SalesLandingView variant={reason} />;
}

