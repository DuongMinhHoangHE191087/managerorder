import { describe, expect, it } from "vitest";
import { base32Decode, generateTotp, isTotpCredentialValue, parseTotpSecret } from "./totp";

describe("account-sharing totp", () => {
  it("decodes base32 secrets", () => {
    expect(base32Decode("JBSWY3DPEHPK3PXP").toString("hex")).toBe("48656c6c6f21deadbeef");
  });

  it("generates RFC-compatible TOTP codes", () => {
    const result = generateTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", { nowMs: 59_000 });
    expect(result.code).toBe("287082");
    expect(result.remainingSeconds).toBe(1);
    expect(result.period).toBe(30);
  });

  it("parses otpauth URIs and detects only explicit TOTP values", () => {
    const parsed = parseTotpSecret("otpauth://totp/App:user?secret=JBSWY3DPEHPK3PXP&period=45&digits=6");
    expect(parsed.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(parsed.period).toBe(45);
    expect(isTotpCredentialValue("JBSWY3DPEHPK3PXP")).toBe(false);
    expect(isTotpCredentialValue("JBSWY3DPEHPK3PXP", "totp_secret")).toBe(true);
    expect(isTotpCredentialValue("totp:JBSWY3DPEHPK3PXP")).toBe(true);
  });
});
