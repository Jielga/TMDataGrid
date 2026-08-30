import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findDemoFences } from "../docs/demoFence";
import { extractHeadings } from "../docs/headings";
import { DOCS_PAGES } from "../docs/docsPages";
import { renderWithMantine } from "../test/gridHarness";
import { listDemoFiles, loadDemo, loadSharedSource } from "./demoRegistry";

/** Every demo named by a ```demo fence on a docs page, with its page id. */
function docsFences(): Array<{
  page: string;
  file: string;
  extraSources: Array<string>;
}> {
  return DOCS_PAGES.flatMap((page) =>
    findDemoFences(page.source).map((demo) => ({
      page: page.id,
      file: demo.file,
      extraSources: demo.extraSources ?? [],
    })),
  );
}

/**
 * One test for every demo on the site, from one loop.
 *
 * This is what makes 30-odd example files affordable to keep: the compiler
 * catches an API that was renamed, and this catches one that still typechecks
 * but throws - a required option dropped, a helper that now returns null.
 * Neither cost grows when a demo is added.
 */

afterEach(cleanup);

const demoFiles = listDemoFiles();

describe("example demos", () => {
  const errors: Array<string> = [];

  beforeEach(() => {
    errors.length = 0;
    // React reports a duplicate key, a bad prop or an update outside `act`
    // through console.error and carries on rendering. On a page of examples
    // that is exactly the class of bug nobody notices, so it fails here.
    // `restoreMocks` in the vitest config puts console.error back afterwards.
    vi.spyOn(console, "error").mockImplementation((...args: Array<unknown>) => {
      errors.push(String(args[0]));
    });
  });

  it("finds demo files to test", () => {
    expect(demoFiles.length).toBeGreaterThan(0);
  });

  it.each(demoFiles)("%s mounts cleanly", (file) => {
    const { Component } = loadDemo(file);
    renderWithMantine(<Component />);

    // Every demo renders a grid, and every grid renders its column headers.
    expect(screen.getAllByRole("columnheader").length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  it.each(demoFiles)("%s survives a sort", async (file) => {
    const { Component } = loadDemo(file);
    renderWithMantine(<Component />);

    // Mounting is half a smoke test. What only a state change produces - a
    // store publish landing mid-render, a callback that throws the second
    // time it is called - needs one interaction, and a sort is the
    // interaction every grid has. `aria-sort` is on sortable headers only.
    const sortable = document.querySelector<HTMLElement>(
      '[data-dg-part="header"][aria-sort]',
    );
    if (sortable === null) return;
    await userEvent.setup().click(sortable);

    expect(errors).toEqual([]);
  });
});

describe("docs pages", () => {
  it("every demo file is shown on some page", () => {
    const referenced = new Set(docsFences().map((fence) => fence.file));
    // A demo nothing links to is a demo nobody sees.
    expect([...demoFiles].filter((file) => !referenced.has(file))).toEqual([]);
  });

  it("no demo is shown on two pages", () => {
    const files = docsFences().map((fence) => fence.file);
    expect(files.filter((file, i) => files.indexOf(file) !== i)).toEqual([]);
  });

  it("every demo fence resolves", () => {
    // Parsing throws on a malformed fence, so reaching the loop is half the
    // assertion; the other half is that the file it names exists.
    for (const { page, file, extraSources } of docsFences()) {
      expect(() => loadDemo(file), `${page}.md → ${file}`).not.toThrow();
      for (const source of extraSources) {
        expect(
          () => loadSharedSource(source),
          `${page}.md → ${source}`,
        ).not.toThrow();
      }
    }
  });

  it("page ids are unique - they are the route", () => {
    const ids = DOCS_PAGES.map((page) => page.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every /docs link points at a page that exists", () => {
    const ids = new Set(DOCS_PAGES.map((page) => page.id));
    const broken = DOCS_PAGES.flatMap((page) =>
      [...page.source.matchAll(/\]\(\/docs\/([a-z-]+)/g)]
        .map((match) => match[1])
        .filter((id) => !ids.has(id))
        .map((id) => `${page.id}.md → /docs/${id}`),
    );

    expect(broken).toEqual([]);
  });

  it("every in-page anchor resolves to a heading on that page", () => {
    const broken = DOCS_PAGES.flatMap((page) => {
      const slugs = new Set(
        extractHeadings(page.source).map((heading) => heading.slug),
      );
      return [...page.source.matchAll(/\]\(#([a-z0-9-]+)\)/g)]
        .map((match) => match[1])
        .filter((slug) => !slugs.has(slug))
        .map((slug) => `${page.id}.md → #${slug}`);
    });

    expect(broken).toEqual([]);
  });

  it("every cross-page anchor resolves to a heading on the target page", () => {
    const byId = new Map(DOCS_PAGES.map((page) => [page.id, page.source]));
    const broken = DOCS_PAGES.flatMap((page) =>
      [...page.source.matchAll(/\]\(\/docs\/([a-z-]+)#([a-z0-9-]+)\)/g)]
        .filter(([, id, slug]) => {
          const target = byId.get(id);
          if (target === undefined) return false; // the link test covers this
          return !extractHeadings(target).some((h) => h.slug === slug);
        })
        .map(([, id, slug]) => `${page.id}.md → /docs/${id}#${slug}`),
    );

    expect(broken).toEqual([]);
  });
});
