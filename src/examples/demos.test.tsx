import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findDemoFences } from "../docs/demoFence";
import { DOCS_PAGES } from "../docs/docsPages";
import { renderWithMantine } from "../test/gridHarness";
import { loadDemo, listDemoFiles, loadSharedSource } from "./demoRegistry";
import { EXAMPLE_TOPICS } from "./examplePages";

/** Every demo named by a ```demo fence on a docs page, with its page id. */
function docsFences(): Array<{ page: string; file: string }> {
  return DOCS_PAGES.flatMap((page) =>
    findDemoFences(page.source).map((demo) => ({
      page: page.id,
      file: demo.file,
    })),
  );
}

/**
 * One test for every demo on the site, from one loop.
 *
 * This is what makes 30-odd example files affordable to keep: the compiler
 * catches an API that was renamed, and this catches one that still typechecks
 * but throws — a required option dropped, a helper that now returns null.
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
});

describe("example pages", () => {
  it("every demo the tree names exists", () => {
    for (const topic of EXAMPLE_TOPICS) {
      for (const demo of topic.demos) {
        expect(() => loadDemo(demo.file)).not.toThrow();
        for (const source of demo.extraSources ?? []) {
          expect(() => loadSharedSource(source)).not.toThrow();
        }
      }
    }
  });

  it("every demo file is reachable, from a topic or a docs page", () => {
    const referenced = new Set([
      ...EXAMPLE_TOPICS.flatMap((topic) => topic.demos.map((d) => d.file)),
      ...docsFences().map((fence) => fence.file),
    ]);
    // A demo nothing links to is a demo nobody sees.
    expect([...demoFiles].filter((file) => !referenced.has(file))).toEqual([]);
  });

  it("no demo is shown in two places", () => {
    // A demo on a docs page *and* an example topic means the migration left
    // half of a topic behind — two routes telling the same thing.
    const topicFiles = EXAMPLE_TOPICS.flatMap((topic) =>
      topic.demos.map((demo) => demo.file),
    );
    const fenceFiles = docsFences().map((fence) => fence.file);
    const all = [...topicFiles, ...fenceFiles];

    expect(all.filter((file, i) => all.indexOf(file) !== i)).toEqual([]);
  });

  it("every demo fence on a docs page resolves", () => {
    // Parsing throws on a malformed fence, so reaching the loop is half the
    // assertion; the other half is that the file it names exists.
    for (const { page, file } of docsFences()) {
      expect(() => loadDemo(file), `${page}.md → ${file}`).not.toThrow();
    }
  });

  it("topic ids are unique — they are the route", () => {
    const ids = EXAMPLE_TOPICS.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every topic points at a documentation page that exists", () => {
    const docIds = new Set(DOCS_PAGES.map((page) => page.id));
    const broken = EXAMPLE_TOPICS.filter(
      (topic) => topic.docs !== undefined && !docIds.has(topic.docs),
    ).map((topic) => `${topic.id} → ${topic.docs}`);

    expect(broken).toEqual([]);
  });

  it("every example link in the docs points at a topic that exists", () => {
    const topicIds = new Set(EXAMPLE_TOPICS.map((topic) => topic.id));
    // The docs link back to the examples by id. Renaming a topic without
    // renaming the link would leave a dead link on a page nobody rereads.
    const broken = DOCS_PAGES.flatMap((page) =>
      [...page.source.matchAll(/\]\(\/examples\/([a-z-]+)\)/g)]
        .map((match) => match[1])
        .filter((id) => !topicIds.has(id))
        .map((id) => `${page.id}.md → ${id}`),
    );

    expect(broken).toEqual([]);
  });
});
