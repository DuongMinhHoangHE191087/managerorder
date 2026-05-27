import { describe, expect, it } from "vitest";
import { accountShareExposurePolicyContainsSensitiveData, buildSharePayload } from "./services";
import type { AccountShareLinkRow } from "./types";

const baseRow: AccountShareLinkRow = {
  id: "00000000-0000-4000-8000-000000000001",
  account_id: "00000000-0000-4000-8000-000000000002",
  source_account_id: "00000000-0000-4000-8000-000000000003",
  order_id: null,
  order_item_id: null,
  customer_id: null,
  short_link_id: null,
  slug: "share123",
  title: "Customer share",
  status: "active",
  expires_at: null,
  max_views: 20,
  view_count: 4,
  max_unlocks: 10,
  unlock_count: 1,
  passcode_hash: "hash",
  exposure_policy: {},
  access_policy: {},
  locked_ip: null,
  locked_ipv6: null,
  created_by: null,
  deleted_at: null,
  created_at: "2026-05-06T00:00:00.000Z",
  updated_at: "2026-05-06T00:00:00.000Z",
};

describe("account-sharing payload", () => {
  it("only includes fields selected by exposure policy and hides TOTP secrets", () => {
    const payload = buildSharePayload(
      baseRow,
      { fields: ["email", "2fa"], includeLabels: true },
      {
        id: baseRow.source_account_id,
        email: "owner@example.com",
        password: "secret-password",
        credentials: [
          {
            id: "totp-1",
            type: "2fa",
            label: "Authenticator",
            value: "otpauth://totp/App?secret=JBSWY3DPEHPK3PXP",
            format: "totp_secret",
          },
          {
            id: "invite-1",
            type: "link_join",
            label: "Invite",
            value: "https://invite.example",
          },
        ],
      },
    );

    expect(payload.email).toBe("owner@example.com");
    expect(payload.password).toBeNull();
    expect(payload.credentials).toHaveLength(1);
    expect(payload.credentials[0]).toMatchObject({
      id: "totp-1",
      value: null,
      totpAvailable: true,
    });
    expect(payload.remainingViews).toBe(16);
  });

  it("respects credential allowlists and shareable flags", () => {
    const payload = buildSharePayload(
      baseRow,
      { fields: ["link_join", "2fa", "other"], credentialIds: ["invite-1", "hidden-1"], includeLabels: true },
      {
        id: baseRow.source_account_id,
        email: "owner@example.com",
        password: "secret-password",
        credentials: [
          {
            id: "invite-1",
            type: "link_join",
            label: "Invite",
            value: "https://invite.example",
          },
          {
            id: "totp-1",
            type: "2fa",
            label: "Authenticator",
            value: "otpauth://totp/App?secret=JBSWY3DPEHPK3PXP",
            format: "totp_secret",
          },
          {
            id: "hidden-1",
            type: "other",
            label: "Hidden",
            value: "not-shared",
            shareable: false,
          },
        ],
      },
    );

    expect(payload.credentials).toHaveLength(1);
    expect(payload.credentials[0]).toMatchObject({
      id: "invite-1",
      value: "https://invite.example",
      totpAvailable: false,
    });
  });

  it("detects sensitive no-passcode policies without overblocking allowlisted safe credentials", () => {
    const secrets = {
      id: baseRow.source_account_id,
      email: "owner@example.com",
      password: "secret-password",
      credentials: [
        {
          id: "invite-1",
          type: "link_join" as const,
          label: "Invite",
          value: "https://invite.example",
        },
        {
          id: "totp-1",
          type: "2fa" as const,
          label: "Authenticator",
          value: "otpauth://totp/App?secret=JBSWY3DPEHPK3PXP",
          format: "totp_secret" as const,
        },
        {
          id: "masked-1",
          type: "other" as const,
          label: "Masked custom",
          value: "sensitive",
          masked: true,
        },
      ],
    };

    expect(accountShareExposurePolicyContainsSensitiveData(
      { fields: ["password"], includeLabels: true },
      secrets,
    )).toBe(true);
    expect(accountShareExposurePolicyContainsSensitiveData(
      { fields: ["2fa"], credentialIds: ["invite-1"], includeLabels: true },
      secrets,
    )).toBe(false);
    expect(accountShareExposurePolicyContainsSensitiveData(
      { fields: ["other"], credentialIds: ["masked-1"], includeLabels: true },
      secrets,
    )).toBe(true);
  });
});
