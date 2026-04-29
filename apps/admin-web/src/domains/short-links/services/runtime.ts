import type { ResolvedShortLinkPolicy } from "./policy";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

export interface ShortLinkRuntimePolicy {
  landingEnabled: boolean;
  forceDirectRedirect: boolean;
}

function readBooleanFlag(value: string | undefined): boolean | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (FALSE_VALUES.has(normalized)) {
    return false;
  }
  return null;
}

export function getShortLinkRuntimePolicy(
  env: Record<string, string | undefined> = process.env,
): ShortLinkRuntimePolicy {
  const forceDirectRedirect = readBooleanFlag(env.SHORT_LINK_FORCE_DIRECT_REDIRECT) === true;
  const landingEnabledFlag = readBooleanFlag(env.SHORT_LINK_PUBLIC_LANDING_ENABLED);
  const landingEnabled = forceDirectRedirect ? false : landingEnabledFlag ?? true;

  return {
    landingEnabled,
    forceDirectRedirect,
  };
}

export function applyShortLinkRuntimePolicy(
  policy: ResolvedShortLinkPolicy,
  runtimePolicy: ShortLinkRuntimePolicy,
): ResolvedShortLinkPolicy {
  if (!runtimePolicy.forceDirectRedirect && runtimePolicy.landingEnabled) {
    return policy;
  }

  if (policy.effectiveDeliveryMode === "direct_redirect") {
    return policy;
  }

  return {
    ...policy,
    effectiveDeliveryMode: "direct_redirect",
    effectiveLandingTemplateKey: null,
    deliveryModeSource: "system_default",
    landingTemplateSource: "not_applicable",
  };
}
