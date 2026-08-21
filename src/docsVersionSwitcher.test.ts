import { beforeEach, describe, expect, it, vi } from "vitest";
import SOURCE from "../public/docs-version-switcher.js?raw";

/**
 * `public/docs-version-switcher.js` is the version menu for copies built before
 * the header grew one, which is what keeps the site root reachable when the
 * latest stable release predates this feature. It ships as plain JS outside the
 * bundle, so nothing else typechecks it or renders it: this is its only cover.
 */

const MANIFEST = {
  entries: [
    { path: "v1.1", label: "1.1.1", kind: "stable", latest: true },
    { path: "next", label: "next", kind: "dev" },
    { path: "b/feature", label: "feature", kind: "preview" },
  ],
};

/** Runs the script as if the deploy had injected it into the page. */
async function run({
  slug,
  pathname,
  manifest = MANIFEST,
}: {
  slug: string;
  pathname: string;
  manifest?: unknown;
}) {
  window.history.replaceState({}, "", pathname);

  const script = document.createElement("script");
  script.setAttribute("data-site-root", "/TMDataGrid/");
  script.setAttribute("data-slug", slug);
  Object.defineProperty(document, "currentScript", {
    value: script,
    configurable: true,
  });

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => manifest })),
  );

  new Function(SOURCE)();
  // The script renders when its one fetch resolves, so let the queue drain.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("the standalone version switcher", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("offers every released copy and marks the one being read", async () => {
    await run({ slug: "root", pathname: "/TMDataGrid/docs/columns" });

    const select = document.querySelector("select");
    const options = [...(select?.options ?? [])];
    expect(options.map((option) => option.textContent)).toEqual([
      "1.1.1",
      "next",
    ]);
    expect(select?.value).toBe("/TMDataGrid/docs/columns");
  });

  it("carries the page across, and sends the mirrored entry to the root", async () => {
    await run({ slug: "root", pathname: "/TMDataGrid/docs/columns" });

    const values = [...(document.querySelector("select")?.options ?? [])].map(
      (option) => option.value,
    );
    expect(values).toEqual([
      "/TMDataGrid/docs/columns",
      "/TMDataGrid/next/docs/columns",
    ]);
  });

  it("reads the page out of a copy served from a subdirectory", async () => {
    await run({ slug: "next", pathname: "/TMDataGrid/next/docs/columns" });

    const values = [...(document.querySelector("select")?.options ?? [])].map(
      (option) => option.value,
    );
    expect(values).toEqual([
      "/TMDataGrid/docs/columns",
      "/TMDataGrid/next/docs/columns",
    ]);
  });

  it("stays out of the way when there is nothing to switch to", async () => {
    await run({
      slug: "root",
      pathname: "/TMDataGrid/",
      manifest: { entries: [MANIFEST.entries[0]] },
    });
    expect(document.querySelector("select")).toBeNull();
  });

  it("says nothing when there is no manifest", async () => {
    await run({ slug: "root", pathname: "/TMDataGrid/", manifest: null });
    expect(document.querySelector("select")).toBeNull();
  });
});
