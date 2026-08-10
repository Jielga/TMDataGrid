import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithMantine } from "../test/gridHarness";
import { loadDemo, listDemoFiles, loadSharedSource } from "./demoRegistry";
import { EXAMPLE_TOPICS } from "./examplePages";

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
  it("finds demo files to test", () => {
    expect(demoFiles.length).toBeGreaterThan(0);
  });

  it.each(demoFiles)("%s mounts", (file) => {
    const { Component } = loadDemo(file);
    renderWithMantine(<Component />);
    // Every demo renders a grid, and every grid renders its column headers.
    expect(screen.getAllByRole("columnheader").length).toBeGreaterThan(0);
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

  it("every demo file is reachable from the tree", () => {
    const referenced = new Set(
      EXAMPLE_TOPICS.flatMap((topic) => topic.demos.map((demo) => demo.file)),
    );
    // A demo nothing links to is a demo nobody sees.
    expect([...demoFiles].filter((file) => !referenced.has(file))).toEqual([]);
  });

  it("topic ids are unique — they are the route", () => {
    const ids = EXAMPLE_TOPICS.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
