import { describe, expect, test } from "vitest";
import { planDispatch, planPullRequest, planPush } from "./docs-plan.mjs";

/**
 * The deploy planner, which decides what a run publishes and - the part that
 * matters most - what the site root serves. A root nothing ever mirrors is a
 * 404 on the URL in `package.json`'s `homepage`, and that is what shipped
 * before these tests existed.
 */

/** A push to a branch at 2.0.0-beta.0 with the site root already seeded. */
const seeded = {
  version: "2.0.0-beta.0",
  lineVersion: "2.0.0-beta.0",
  rootExists: true,
  rootSlug: "v1.1",
  rootServesVersion: "1.1.1",
  hasTag: true,
};

const root = (plan) => plan.targets.find((target) => target.mirrorRoot) ?? null;
const slugs = (plan) => plan.targets.map((target) => target.slug);

describe("planPush", () => {
  test("always publishes the tip of main", () => {
    expect(slugs(planPush(seeded))).toContain("next");
  });

  test("leaves a current line and a current root alone", () => {
    const plan = planPush(seeded);
    expect(slugs(plan)).toEqual(["next"]);
    expect(root(plan)).toBeNull();
  });

  test("publishes the line when the branch moved past what is deployed", () => {
    const plan = planPush({ ...seeded, lineVersion: "2.0.0-beta.0", version: "2.0.0-beta.1" });
    expect(slugs(plan)).toEqual(["next", "v2.0"]);
  });

  // The regression: mirroring used to require a stable release, so a project
  // in a prerelease wave never seeded the root and the site had no entry point.
  test("seeds an empty root even when every release is a prerelease", () => {
    const plan = planPush({
      ...seeded,
      rootExists: false,
      rootSlug: null,
      rootServesVersion: null,
    });
    expect(root(plan)).toMatchObject({ slug: "v2.0", kind: "prerelease" });
  });

  test("seeds an empty root from main when there is no version line", () => {
    const plan = planPush({
      ...seeded,
      version: "not-a-version",
      rootExists: false,
      rootSlug: null,
      rootServesVersion: null,
    });
    expect(root(plan)).toMatchObject({ slug: "next" });
  });

  test("keeps the root in step with the line it already mirrors", () => {
    const plan = planPush({
      ...seeded,
      version: "2.0.0-beta.1",
      rootSlug: "v2.0",
      rootServesVersion: "2.0.0-beta.0",
    });
    expect(root(plan)).toMatchObject({ slug: "v2.0", version: "2.0.0-beta.1" });
  });

  // Comparing only major.minor.patch read these two as the same version, which
  // left the root serving a prerelease after the release it led up to shipped.
  test("hands the root to the release its prerelease led up to", () => {
    const plan = planPush({
      version: "2.0.0",
      lineVersion: "2.0.0-beta.0",
      rootExists: true,
      rootSlug: "v2.0",
      rootServesVersion: "2.0.0-beta.0",
      hasTag: true,
    });
    expect(root(plan)).toMatchObject({ slug: "v2.0", kind: "stable" });
  });

  test("takes the root for a stable release that outranks it", () => {
    const plan = planPush({ ...seeded, version: "2.0.0", lineVersion: undefined });
    expect(root(plan)).toMatchObject({ slug: "v2.0", kind: "stable" });
  });

  test("does not take the root for a prerelease of a newer line", () => {
    expect(root(planPush({ ...seeded, version: "3.0.0-beta.0", lineVersion: undefined }))).toBeNull();
  });

  test("does not take the root for a release the root already outranks", () => {
    const plan = planPush({
      version: "1.1.2",
      lineVersion: undefined,
      rootExists: true,
      rootSlug: "v2.0",
      rootServesVersion: "2.0.0-beta.0",
      hasTag: true,
    });
    expect(root(plan)).toBeNull();
  });

  test("builds the line from its tag when there is one, and from main when there is not", () => {
    const moved = { ...seeded, version: "2.0.0-beta.1" };
    expect(planPush(moved).targets[1].ref).toBe("v2.0.0-beta.1");
    expect(planPush({ ...moved, hasTag: false }).targets[1].ref).toBe("");
  });
});

describe("planPullRequest", () => {
  const pull = { branch: "feat/thing", version: "2.0.0-beta.0", labelled: true, closed: false, hasCopy: false };

  test("publishes a labelled branch under a slug of its name", () => {
    const plan = planPullRequest(pull);
    expect(plan.targets).toEqual([
      { slug: "b/feat-thing", ref: "", version: "2.0.0-beta.0", label: "feat/thing", kind: "preview", mirrorRoot: false },
    ]);
  });

  test("takes the preview down when the branch stops carrying the label", () => {
    expect(planPullRequest({ ...pull, labelled: false, hasCopy: true }).remove).toEqual(["b/feat-thing"]);
  });

  test("takes the preview down when the pull request closes", () => {
    expect(planPullRequest({ ...pull, closed: true, hasCopy: true }).remove).toEqual(["b/feat-thing"]);
  });

  test("does nothing for a pull request that never had a preview", () => {
    const plan = planPullRequest({ ...pull, labelled: false, hasCopy: false });
    expect(plan).toEqual({ targets: [], remove: [] });
  });
});

describe("planDispatch", () => {
  test("publishes a back version, and can hand it the root", () => {
    const plan = planDispatch({ slug: "v1.1", ref: "v1.1.1", version: "1.1.1", mirrorRoot: true });
    expect(plan.targets[0]).toEqual({
      slug: "v1.1", ref: "v1.1.1", version: "1.1.1", label: "1.1.1", kind: "stable", mirrorRoot: true,
    });
  });

  test("names the kind from the slug and the version", () => {
    const kind = (slug, version) => planDispatch({ slug, ref: "", version, mirrorRoot: false }).targets[0].kind;
    expect(kind("next", "2.0.0-beta.0")).toBe("dev");
    expect(kind("b/thing", "2.0.0-beta.0")).toBe("preview");
    expect(kind("v2.0", "2.0.0-beta.0")).toBe("prerelease");
    expect(kind("v1.1", "1.1.1")).toBe("stable");
  });
});
