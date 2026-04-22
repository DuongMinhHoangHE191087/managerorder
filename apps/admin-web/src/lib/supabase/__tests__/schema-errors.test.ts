import { describe, expect, it } from "vitest";
import { isMissingRelationError } from "../schema-errors";

describe("isMissingRelationError", () => {
  it("detects Postgres relation errors for public tables", () => {
    expect(
      isMissingRelationError(
        {
          code: "42P01",
          message: 'relation "public.sales_channels" does not exist',
        },
        "sales_channels",
      ),
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(
      isMissingRelationError(
        {
          code: "23505",
          message: "duplicate key value violates unique constraint",
        },
        "sales_channels",
      ),
    ).toBe(false);
  });
});
