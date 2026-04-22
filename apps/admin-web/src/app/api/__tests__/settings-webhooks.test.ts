import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestRequest,
  mockRBAC,
  mockWithAccount,
  mockWithErrorHandler,
} from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/api/rbac", () => mockRBAC());

const mockCreateActivityLog = vi.fn().mockResolvedValue(undefined);
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: (...args: unknown[]) => mockCreateActivityLog(...args),
}));

import { POST as createWebhook } from "@/app/api/settings/webhooks/route";
import { POST as testWebhook } from "@/app/api/settings/webhooks/[id]/test/route";

type ChainState = {
  table: string;
  action: string;
};

function createChain(endpointRow?: Record<string, unknown>) {
  const state: ChainState = { table: "", action: "" };
  const chain: Record<string, unknown> = {};

  chain.select = vi.fn().mockImplementation(() => {
    if (state.action !== "insert") {
      state.action = "select";
    }
    return chain;
  });
  chain.insert = vi.fn().mockImplementation(() => {
    state.action = "insert";
    return chain;
  });
  chain.update = vi.fn().mockImplementation(() => {
    state.action = "update";
    return chain;
  });
  chain.eq = vi.fn().mockImplementation(() => chain);
  chain.order = vi.fn().mockImplementation(() => chain);
  chain.single = vi.fn().mockImplementation(async () => {
    if (state.table === "webhook_endpoints" && state.action === "select") {
      return {
        data: endpointRow ?? {
          id: "wh-1",
          url: "https://example.com/webhook",
          secret: "whsec_test",
          is_active: true,
          consecutive_failures: 0,
          last_success_at: null,
          last_failure_at: null,
        },
        error: null,
      };
    }

    if (state.table === "webhook_events") {
      return {
        data: { id: "event-1" },
        error: null,
      };
    }

    return { data: null, error: null };
  });

  return {
    chain,
    from: vi.fn().mockImplementation((table: string) => {
      state.table = table;
      state.action = "";
      return chain;
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("POST /api/settings/webhooks", () => {
  it("rejects invalid webhook URLs", async () => {
    const response = await createWebhook(
      createTestRequest("http://localhost:3000/api/settings/webhooks", {
        method: "POST",
        body: {
          url: "http://127.0.0.1/hook",
          events: ["order.created"],
        },
      }),
      { params: {} } as never,
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("HTTPS");
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("POST /api/settings/webhooks/[id]/test", () => {
  it("delivers a synthetic test event and updates health state", async () => {
    const supabase = createChain();
    mockFrom.mockImplementation(supabase.from);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("pong"),
      } as never)
    );

    const response = await testWebhook(
      createTestRequest("http://localhost:3000/api/settings/webhooks/wh-1/test", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "wh-1" }) } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.ok).toBe(true);
    expect(body.data.responseStatus).toBe(200);
    expect(mockCreateActivityLog).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Webhook-Test": "true",
          "X-Webhook-Event": "webhook.test",
        }),
      })
    );
  });
});
