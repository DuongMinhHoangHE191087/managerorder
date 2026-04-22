import { describe, expect, it } from "vitest";
import { buildSalesChannelRuntimeRows, type SalesChannelRow } from "./repository";

describe("buildSalesChannelRuntimeRows", () => {
  it("aggregates order and short-link usage by effective sales channel", () => {
    const channels = [
      {
        id: "channel-1",
        name: "CTV",
        default_delivery_mode: "landing_page",
        default_landing_template_key: "ctv_neutral",
      },
    ] as SalesChannelRow[];

    const orders = [
      { id: "order-1", sales_channel_id: "channel-1" },
      { id: "order-2", sales_channel_id: null },
    ];

    const shortLinks = [
      {
        id: "link-1",
        order_id: null,
        sales_channel_id: "channel-1",
        delivery_mode: "direct_redirect",
      },
      {
        id: "link-2",
        order_id: "order-1",
        sales_channel_id: null,
        delivery_mode: "inherit_channel",
      },
      {
        id: "link-3",
        order_id: "order-1",
        sales_channel_id: "channel-1",
        delivery_mode: "landing_page",
      },
      {
        id: "link-4",
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
