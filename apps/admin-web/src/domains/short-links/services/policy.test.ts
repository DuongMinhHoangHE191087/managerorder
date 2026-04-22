import { describe, expect, it } from "vitest";
import { resolveShortLinkPolicy, SHORT_LINK_POLICY_DEFAULTS } from "./policy";

describe("resolveShortLinkPolicy", () => {
  it("uses explicit direct redirect from link", () => {
    const policy = resolveShortLinkPolicy(
      {
        delivery_mode: "direct_redirect",
        landing_template_key: "ctv_neutral",
      },
      {
        default_delivery_mode: "landing_page",
        default_landing_template_key: "owner_intro",
      },
    );

    expect(policy.effectiveDeliveryMode).toBe("direct_redirect");
    expect(policy.effectiveLandingTemplateKey).toBeNull();
    expect(policy.deliveryModeSource).toBe("link_override");
    expect(policy.landingTemplateSource).toBe("not_applicable");
  });

  it("inherits delivery mode and template from channel when link is set to inherit", () => {
    const policy = resolveShortLinkPolicy(
      {
        delivery_mode: "inherit_channel",
        landing_template_key: null,
      },
      {
        default_delivery_mode: "landing_page",
        default_landing_template_key: "ctv_neutral",
      },
    );

    expect(policy.effectiveDeliveryMode).toBe("landing_page");
    expect(policy.effectiveLandingTemplateKey).toBe("ctv_neutral");
    expect(policy.deliveryModeSource).toBe("channel_default");
    expect(policy.landingTemplateSource).toBe("channel_default");
  });

  it("allows template override even when delivery mode comes from channel", () => {
    const policy = resolveShortLinkPolicy(
      {
        delivery_mode: "inherit_channel",
        landing_template_key: "owner_intro",
      },
      {
        default_delivery_mode: "landing_page",
        default_landing_template_key: "ctv_neutral",
      },
    );

    expect(policy.effectiveDeliveryMode).toBe("landing_page");
    expect(policy.effectiveLandingTemplateKey).toBe("owner_intro");
    expect(policy.deliveryModeSource).toBe("channel_default");
    expect(policy.landingTemplateSource).toBe("link_override");
  });

  it("falls back to system defaults when no channel policy exists", () => {
    const policy = resolveShortLinkPolicy({
      delivery_mode: "inherit_channel",
      landing_template_key: null,
    });

    expect(policy.effectiveDeliveryMode).toBe(SHORT_LINK_POLICY_DEFAULTS.deliveryMode);
    expect(policy.effectiveLandingTemplateKey).toBeNull();
  });

  it("falls back to system default landing template for landing pages", () => {
    const policy = resolveShortLinkPolicy({
      delivery_mode: "landing_page",
      landing_template_key: null,
    });

    expect(policy.effectiveDeliveryMode).toBe("landing_page");
    expect(policy.effectiveLandingTemplateKey).toBe(SHORT_LINK_POLICY_DEFAULTS.landingTemplateKey);
    expect(policy.deliveryModeSource).toBe("link_override");
    expect(policy.landingTemplateSource).toBe("system_default");
  });
});
