import { describe, expect, it } from "vitest";
import {
  applyShortLinkRuntimePolicy,
  getShortLinkRuntimePolicy,
} from "./runtime";
import type { ResolvedShortLinkPolicy } from "./policy";

const landingPolicy: ResolvedShortLinkPolicy = {
  effectiveDeliveryMode: "landing_page",
  effectiveLandingTemplateKey: "ctv_neutral",
  deliveryModeSource: "channel_default",
  landingTemplateSource: "channel_default",
};

describe("getShortLinkRuntimePolicy", () => {
  it("keeps landing enabled by default", () => {
    expect(getShortLinkRuntimePolicy({})).toEqual({
      landingEnabled: true,
      forceDirectRedirect: false,
    });
  });

  it("disables landing when the public landing flag is false", () => {
    expect(
      getShortLinkRuntimePolicy({ SHORT_LINK_PUBLIC_LANDING_ENABLED: "false" }),
    ).toEqual({
      landingEnabled: false,
      forceDirectRedirect: false,
    });
  });

  it("forces direct redirect when the rollback flag is enabled", () => {
    expect(
      getShortLinkRuntimePolicy({ SHORT_LINK_FORCE_DIRECT_REDIRECT: "1" }),
    ).toEqual({
      landingEnabled: false,
      forceDirectRedirect: true,
    });
  });
});

describe("applyShortLinkRuntimePolicy", () => {
  it("returns the original policy while landing is enabled", () => {
    expect(
      applyShortLinkRuntimePolicy(landingPolicy, {
        landingEnabled: true,
        forceDirectRedirect: false,
      }),
    ).toEqual(landingPolicy);
  });

  it("forces direct redirect when rollback is active", () => {
    expect(
      applyShortLinkRuntimePolicy(landingPolicy, {
        landingEnabled: false,
        forceDirectRedirect: true,
      }),
    ).toEqual({
      effectiveDeliveryMode: "direct_redirect",
      effectiveLandingTemplateKey: null,
      deliveryModeSource: "system_default",
      landingTemplateSource: "not_applicable",
    });
  });
});
