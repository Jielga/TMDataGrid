import { describe, expect, it } from "vitest";
import { searchDocs, SEARCH_INDEX } from "./searchIndex";

/**
 * The two query shapes the palette has to serve at once: an exact API name,
 * and a couple of words describing a topic. They want opposite ranking, so
 * both are pinned here.
 */

const titles = (query: string) =>
  searchDocs(query).map((entry) => entry.title);

describe("docs search", () => {
  it("indexes pages, sections and symbols", () => {
    const kinds = new Set(SEARCH_INDEX.map((entry) => entry.kind));
    expect([...kinds].sort()).toEqual(["page", "section", "symbol"]);
  });

  it("puts an exact symbol match first", () => {
    expect(titles("onCellClick")[0]).toBe("onCellClick");
    expect(titles("renderDetails")[0]).toBe("renderDetails");
    expect(titles("--dg-row-selected-bg")[0]).toBe("--dg-row-selected-bg");
  });

  it("finds a symbol from a near miss", () => {
    // The user's own example: not a real name, but the click handlers are
    // plainly what was meant.
    expect(titles("onClickExample")).toContain("onCellClick");
  });

  it("finds topics from a couple of words", () => {
    const results = titles("cell sorting");
    expect(results.some((title) => /sorting/i.test(title))).toBe(true);
  });

  it("finds a page by its name", () => {
    expect(titles("grouping")).toContain("Grouping");
  });

  it("ignores a query too short to mean anything", () => {
    expect(searchDocs("a")).toEqual([]);
    expect(searchDocs("  ")).toEqual([]);
  });

  it("every result points at a route", () => {
    for (const entry of SEARCH_INDEX) {
      expect(entry.to.startsWith("/")).toBe(true);
    }
  });
});
