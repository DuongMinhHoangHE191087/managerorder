import type {
  ShortLinkDeliveryMode,
  ShortLinkFailureTemplateKey,
  ShortLinkLandingTemplateKey,
  ShortLinkResolvedDeliveryMode,
} from "@/lib/domain/types";

export interface ShortLinkPolicyCarrier {
  delivery_mode?: ShortLinkDeliveryMode | null;
  landing_template_key?: ShortLinkLandingTemplateKey | null;
  failure_template_key?: ShortLinkFailureTemplateKey | null;
  seller_contact_url?: string | null;
}

export interface SalesChannelPolicyCarrier {
  default_delivery_mode?: ShortLinkResolvedDeliveryMode | null;
  defaultDeliveryMode?: ShortLinkResolvedDeliveryMode | null;
  default_landing_template_key?: ShortLinkLandingTemplateKey | null;
  defaultLandingTemplateKey?: ShortLinkLandingTemplateKey | null;
  default_failure_template_key?: ShortLinkFailureTemplateKey | null;
  defaultFailureTemplateKey?: ShortLinkFailureTemplateKey | null;
  seller_contact_url?: string | null;
  sellerContactUrl?: string | null;
}

export interface ShortLinkSystemPolicyCarrier {
  default_failure_template_key?: ShortLinkFailureTemplateKey | null;
  defaultFailureTemplateKey?: ShortLinkFailureTemplateKey | null;
}

export type ShortLinkPolicySource =
  | "link_override"
  | "channel_default"
  | "system_default"
  | "not_applicable";

export interface ResolvedShortLinkPolicy {
  effectiveDeliveryMode: ShortLinkResolvedDeliveryMode;
  effectiveLandingTemplateKey: ShortLinkLandingTemplateKey | null;
  effectiveFailureTemplateKey: ShortLinkFailureTemplateKey;
  sellerContactUrl: string | null;
  deliveryModeSource: Exclude<ShortLinkPolicySource, "not_applicable">;
  landingTemplateSource: ShortLinkPolicySource;
  failureTemplateSource: Exclude<ShortLinkPolicySource, "not_applicable">;
  sellerContactSource: Exclude<ShortLinkPolicySource, "not_applicable"> | "not_configured";
}

export const SHORT_LINK_POLICY_DEFAULTS = {
  deliveryMode: "direct_redirect" as ShortLinkResolvedDeliveryMode,
  landingTemplateKey: "owner_intro" as ShortLinkLandingTemplateKey,
  failureTemplateKey: "customer_offer_wall" as ShortLinkFailureTemplateKey,
} as const;

export function resolveShortLinkPolicy(
  link: ShortLinkPolicyCarrier,
  salesChannel?: SalesChannelPolicyCarrier | null,
  systemPolicy?: ShortLinkSystemPolicyCarrier | null,
): ResolvedShortLinkPolicy {
  const linkMode = link.delivery_mode ?? "inherit_channel";
  const channelMode =
    salesChannel?.default_delivery_mode ?? salesChannel?.defaultDeliveryMode ?? null;

  let effectiveDeliveryMode: ShortLinkResolvedDeliveryMode;
  let deliveryModeSource: ResolvedShortLinkPolicy["deliveryModeSource"];

  if (linkMode === "direct_redirect" || linkMode === "landing_page") {
    effectiveDeliveryMode = linkMode;
    deliveryModeSource = "link_override";
  } else if (channelMode) {
    effectiveDeliveryMode = channelMode;
    deliveryModeSource = "channel_default";
  } else {
    effectiveDeliveryMode = SHORT_LINK_POLICY_DEFAULTS.deliveryMode;
    deliveryModeSource = "system_default";
  }

  const failurePolicy = resolveFailurePolicy(link, salesChannel, systemPolicy);

  if (effectiveDeliveryMode === "direct_redirect") {
    return {
      effectiveDeliveryMode,
      effectiveLandingTemplateKey: null,
      ...failurePolicy,
      deliveryModeSource,
      landingTemplateSource: "not_applicable",
    };
  }

  if (link.landing_template_key) {
    return {
      effectiveDeliveryMode,
      effectiveLandingTemplateKey: link.landing_template_key,
      ...failurePolicy,
      deliveryModeSource,
      landingTemplateSource: "link_override",
    };
  }

  const channelLandingTemplateKey =
    salesChannel?.default_landing_template_key ?? salesChannel?.defaultLandingTemplateKey ?? null;

  if (channelLandingTemplateKey) {
    return {
      effectiveDeliveryMode,
      effectiveLandingTemplateKey: channelLandingTemplateKey,
      ...failurePolicy,
      deliveryModeSource,
      landingTemplateSource: "channel_default",
    };
  }

  return {
    effectiveDeliveryMode,
    effectiveLandingTemplateKey: SHORT_LINK_POLICY_DEFAULTS.landingTemplateKey,
    ...failurePolicy,
    deliveryModeSource,
    landingTemplateSource: "system_default",
  };
}

function resolveFailurePolicy(
  link: ShortLinkPolicyCarrier,
  salesChannel?: SalesChannelPolicyCarrier | null,
  systemPolicy?: ShortLinkSystemPolicyCarrier | null,
): Pick<
  ResolvedShortLinkPolicy,
  "effectiveFailureTemplateKey" | "failureTemplateSource" | "sellerContactUrl" | "sellerContactSource"
> {
  const channelFailureTemplateKey =
    salesChannel?.default_failure_template_key ?? salesChannel?.defaultFailureTemplateKey ?? null;
  const channelSellerContactUrl =
    salesChannel?.seller_contact_url ?? salesChannel?.sellerContactUrl ?? null;
  const systemFailureTemplateKey =
    systemPolicy?.default_failure_template_key
    ?? systemPolicy?.defaultFailureTemplateKey
    ?? SHORT_LINK_POLICY_DEFAULTS.failureTemplateKey;

  if (link.failure_template_key) {
    return {
      effectiveFailureTemplateKey: link.failure_template_key,
      failureTemplateSource: "link_override",
      sellerContactUrl: link.seller_contact_url ?? channelSellerContactUrl ?? null,
      sellerContactSource: link.seller_contact_url
        ? "link_override"
        : channelSellerContactUrl
          ? "channel_default"
          : "not_configured",
    };
  }

  if (channelFailureTemplateKey) {
    return {
      effectiveFailureTemplateKey: channelFailureTemplateKey,
      failureTemplateSource: "channel_default",
      sellerContactUrl: link.seller_contact_url ?? channelSellerContactUrl ?? null,
      sellerContactSource: link.seller_contact_url
        ? "link_override"
        : channelSellerContactUrl
          ? "channel_default"
          : "not_configured",
    };
  }

  return {
    effectiveFailureTemplateKey: systemFailureTemplateKey,
    failureTemplateSource: "system_default",
    sellerContactUrl: link.seller_contact_url ?? channelSellerContactUrl ?? null,
    sellerContactSource: link.seller_contact_url
      ? "link_override"
      : channelSellerContactUrl
        ? "channel_default"
        : "not_configured",
  };
}
