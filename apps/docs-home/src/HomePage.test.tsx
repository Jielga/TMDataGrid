import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUNDLED_SITES } from "docs-shell/sites.ts";
import { HomePage } from "./HomePage";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
});

describe("HomePage", () => {
  it("links every registered site", () => {
    render(
      <MantineProvider env="test">
        <HomePage />
      </MantineProvider>,
    );

    for (const site of BUNDLED_SITES) {
      expect(screen.getByRole("link", { name: site.title })).toHaveAttribute(
        "href",
        `https://jielga.github.io/react/${site.slug}/`,
      );
      for (const name of site.packages) {
        expect(screen.getByRole("link", { name })).toHaveAttribute(
          "href",
          `https://www.npmjs.com/package/${name}`,
        );
      }
    }
  });
});
