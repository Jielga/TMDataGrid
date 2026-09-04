import { describe, expect, it, vi } from "vitest";
import SOURCE from "../public/docs-spa-path.js?raw";

/**
 * `public/docs-spa-path.js` is what makes a deep link into a version directory
 * land in that version. It ships as plain JS outside the bundle, so nothing
 * else typechecks it or runs it: this is its only cover.
 *
 * The script reads `window.location`, `history` and `document.currentScript`
 * and nothing else, so the test hands it those three rather than fighting
 * jsdom over a location it refuses to let go of.
 */

const ROOT = "/TMDataGrid/";

function run({ slug, url }: { slug: string; url: string }) {
  const parsed = new URL(url, "https://example.test");
  const replace = vi.fn();
  const replaceState = vi.fn();

  const location = {
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
    replace,
  };
  const currentScript = {
    getAttribute: (name: string) =>
      name === "data-site-root" ? ROOT : name === "data-slug" ? slug : null,
  };

  new Function("window", "document", "history", SOURCE)(
    { location },
    { currentScript },
    { replaceState },
  );

  return {
    /** Where it sent the browser, or null when it left the URL alone. */
    sentTo: replace.mock.calls[0]?.[0] ?? null,
    /** The URL it settled on in place, or null when it did not. */
    settledOn: replaceState.mock.calls[0]?.[2] ?? null,
  };
}

describe("the deep-link handler", () => {
  // Pages answers a missing path with the site root's 404 whatever directory
  // it was under, so this arrives running the root's bundle.
  it("sends a version's deep link to that version", () => {
    expect(run({ slug: "root", url: "/TMDataGrid/next/docs/testing" }).sentTo)
      .toBe("/TMDataGrid/next/?/docs/testing");
  });

  it("sends a preview's deep link to that preview", () => {
    expect(run({ slug: "root", url: "/TMDataGrid/b/feat/docs/testing" }).sentTo)
      .toBe("/TMDataGrid/b/feat/?/docs/testing");
  });

  it("puts the parked path back before the router reads it", () => {
    expect(run({ slug: "next", url: "/TMDataGrid/next/?/docs/testing" }).settledOn)
      .toBe("/TMDataGrid/next/docs/testing");
  });

  it("carries a query and a hash across the round trip", () => {
    const out = run({
      slug: "root",
      url: "/TMDataGrid/v2.0/docs/testing?a=1&b=2#parts",
    });
    expect(out.sentTo).toBe("/TMDataGrid/v2.0/?/docs/testing&a=1~and~b=2#parts");

    expect(run({ slug: "v2.0", url: out.sentTo! }).settledOn).toBe(
      "/TMDataGrid/v2.0/docs/testing?a=1&b=2#parts",
    );
  });

  it("leaves the root's own deep link where it is", () => {
    const out = run({ slug: "root", url: "/TMDataGrid/docs/testing" });
    expect(out.sentTo).toBeNull();
    expect(out.settledOn).toBeNull();
  });

  // A copy's index is a real file, so it is served rather than missed.
  // Redirecting it again would be a loop.
  it("leaves a copy's own front page alone", () => {
    const out = run({ slug: "next", url: "/TMDataGrid/next/" });
    expect(out.sentTo).toBeNull();
    expect(out.settledOn).toBeNull();
  });

  it("says nothing about a path outside the site root", () => {
    expect(run({ slug: "root", url: "/somewhere/else" }).sentTo).toBeNull();
  });
});
