import { describe, expect, it } from "vitest";
import {
  buildSearchIndex,
  filterRowsBySearchQuery,
  hasSearchTokens,
  matchesSearchQuery,
  normalizeSearchText,
  paginateRows,
  tokenizeSearchQuery,
} from "@/shared/lib/filtering/search";

describe("search filtering helpers", () => {
  it("normalizes Vietnamese text and collapses whitespace", () => {
    expect(normalizeSearchText("  Gia \u0110\u00ecnh  Premium  ")).toBe("gia dinh premium");
    expect(normalizeSearchText("\u0110\u1eb7ng V\u0103n L\u00e2m")).toBe("dang van lam");
  });

  it("tokenizes only meaningful search words", () => {
    expect(tokenizeSearchQuery("  gia   h\u1ea1n 7 ng\u00e0y ")).toEqual(["gia", "han", "7", "ngay"]);
    expect(hasSearchTokens("   ")).toBe(false);
  });

  it("matches multi-word queries across nested values", () => {
    expect(
      matchesSearchQuery(
        "gia dinh hx136",
        { title: "Duolingo Gia \u0110\u00ecnh", meta: { code: "HX136" } },
        ["premium", "family"],
      ),
    ).toBe(true);
  });

  it("builds a flattened search index from mixed data", () => {
    expect(
      buildSearchIndex(
        "Netflix Premium",
        ["Gia H\u1ea1n", 30],
        { contact: { zalo: "0394497949" } },
      ),
    ).toContain("netflix premium gia han 30 0394497949");
  });

  it("returns false when at least one token is missing", () => {
    expect(matchesSearchQuery("canva vip", "Canva Pro", "Agency")).toBe(false);
  });

  it("filters rows with accent-insensitive matching", () => {
    const rows = [
      { id: "1", title: "Gia \u0110\u00ecnh Premium", code: "HX136" },
      { id: "2", title: "Netflix Basic", code: "NF001" },
    ];

    expect(
      filterRowsBySearchQuery(rows, "gia dinh hx136", (row) => [row.title, row.code]).map((row) => row.id),
    ).toEqual(["1"]);
  });

  it("paginates filtered rows consistently", () => {
    expect(paginateRows(["a", "b", "c"], 2, 2)).toEqual({
      data: ["c"],
      count: 3,
      page: 2,
      limit: 2,
      totalPages: 2,
    });
  });
});
