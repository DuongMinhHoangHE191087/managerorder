import type {
  ShortLinkDeliveryMode,
  ShortLinkLandingTemplateKey,
  ShortLinkResolvedDeliveryMode,
} from "@/lib/domain/types";

export interface ShortLinkPolicyCarrier {
  delivery_mode?: ShortLinkDeliveryMode | null;
  landing_template_key?: ShortLinkLandingTemplateKey | null;
}

export interface SalesChannelPolicyCarrier {
  default_delivery_mode?: ShortLinkResolvedDeliveryMode | null;
  defaultDeliveryMode?: ShortLinkResolvedDeliveryMode | null;
  default_landing_template_key?: ShortLinkLandingTemplateKey | null;
  defaultLandingTemplateKey?: ShortLinkLandingTemplateKey | null;
}

export type ShortLinkPolicySource =
  | "link_override"
  | "channel_default"
  | "system_default"
  | "not_applicable";

export interface ResolvedShortLinkPolicy {
  effectiveDeliveryMode: ShortLinkResolvedDeliveryMode;
  effectiveLandingTemplateKey: ShortLinkLandingTemplateKey | null;
  deliveryModeSource: Exclude<ShortLinkPolicySource, "not_applicable">;
  landingTemplateSource: ShortLinkPolicySource;
}

export const SHORT_LINK_POLICY_DEFAULTS = {
  deliveryMode: "direct_redirect" as ShortLinkResolvedDeliveryMode,
  landingTemplateKey: "owner_intro" as ShortLinkLandingTemplateKey,
} as const;

export function resolveShortLinkPolicy(
  link: ShortLinkPolicyCarrier,
  salesChannel?: SalesChannelPolicyCarrier | null,
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

  if (effectiveDeliveryMode === "direct_redirect") {
    return {
      effectiveDeliveryMode,
      effectiveLandingTemplateKey: null,
      deliveryModeSource,
      landingTemplateSource: "not_applicable",
    };
  }

  if (link.landing_template_key) {
    return {
      effectiveDeliveryMode,
      effectiveLandingTemplateKey: link.landing_template_key,
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
      deliveryModeSource,
      landingTemplateSource: "channel_default",
    };
  }

  return {
    effectiveDeliveryMode,
    effectiveLandingTemplateKey: SHORT_LINK_POLICY_DEFAULTS.landingTemplateKey,
    deliveryModeSource,
    landingTemplateSource: "system_default",
  };
}
