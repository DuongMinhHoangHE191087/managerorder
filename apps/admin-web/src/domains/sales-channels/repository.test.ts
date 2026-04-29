import { describe, expect, it } from "vitest";
import { buildSalesChannelRuntimeRows, type SalesChannelRow } from "./repository";

describe("buildSalesChannelRuntimeRows", () => {
  it("aggregates order and short-link usage by effective sales channel", () => {
    const channels = [
      {
        id: "00000000-0000-4000-8000-00000000000b",
        name: "CTV",
        default_delivery_mode: "landing_page",
        default_landing_template_key: "ctv_neutral",
      },
    ] as SalesChannelRow[];

    const orders = [
      { id: "00000000-0000-4000-8000-00000000005b", sales_channel_id: "00000000-0000-4000-8000-00000000000b" },
      { id: "00000000-0000-4000-8000-0000000000c5", sales_channel_id: null },
    ];

    const shortLinks = [
      {
        id: "00000000-0000-4000-8000-0000000000ad",
        order_id: null,
        sales_channel_id: "00000000-0000-4000-8000-00000000000b",
        delivery_mode: "direct_redirect",
      },
      {
        id: "00000000-0000-4000-8000-0000000000c6",
        order_id: "00000000-0000-4000-8000-00000000005b",
        sales_channel_id: null,
        delivery_mode: "inherit_channel",
      },
      {
        id: "00000000-0000-4000-8000-0000000000c7",
        order_id: "00000000-0000-4000-8000-00000000005b",
        sales_channel_id: "00000000-0000-4000-8000-00000000000b",
        delivery_mode: "landing_page",
      },
      {
        id: "00000000-0000-4000-8000-0000000000c8",
        order_id: null,
        sales_channel_id: null,
        delivery_mode: "inherit_channel",
      },
    ] as const;

    const result = buildSalesChannelRuntimeRows(channels, orders, shortLinks as never);

    expect(result).toHaveLength(1);
    expect(result[0].runtime).toEqual({
      linkedOrderCount: 1,
      shortLinkCount: 3,
      landingLinkCount: 2,
      directLinkCount: 1,
      inheritedLinkCount: 1,
      overrideLinkCount: 2,
    });
  });
});
