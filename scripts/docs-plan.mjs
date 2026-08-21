// Which copies of the documentation a deploy run should produce.
//
// Pure: every fact about the world - the version on the branch, what the
// gh-pages tree already holds, which event fired - is passed in, and the
// answer is a plan. `docs-targets.mjs` is the shell that reads those facts and
// prints the result. Split that way because this is the logic that decides
// whether the site has an entry point at all, and it is worth a test rather
// than a deploy run.
import { compareVersions, isPrerelease, lineOf } from "./semver.mjs";

export { lineOf };

export const PREVIEW_LABEL = "docs-preview";

/** A branch name as a single path segment. */
export function previewSlug(branch) {
  return `b/${branch.replaceAll(/[^A-Za-z0-9._-]+/g, "-")}`;
}

function kindOf(slug, version) {
  if (slug === "next") return "dev";
  if (slug.startsWith("b/")) return "preview";
  return isPrerelease(version) ? "prerelease" : "stable";
}

/** A build asked for by hand, which is how a back version gets published. */
export function planDispatch({ slug, ref, version, mirrorRoot }) {
  return {
    targets: [
      {
        slug,
        ref,
        version,
        label: slug === "next" ? "next" : (version ?? slug),
        kind: kindOf(slug, version),
        mirrorRoot: mirrorRoot === true,
      },
    ],
    remove: [],
  };
}

/**
 * A pull request preview, published while the branch carries the label and
 * taken down when it stops - closed, merged, or the label removed.
 */
export function planPullRequest({ branch, labelled, closed, version, hasCopy }) {
  const slug = previewSlug(branch);

  if (closed || !labelled) {
    // Only when there is something to take down. A pull request that never had
    // the label closing is not a reason to republish the site.
    return { targets: [], remove: hasCopy ? [slug] : [] };
  }

  return {
    targets: [
      {
        slug,
        ref: "",
        version,
        label: branch,
        kind: "preview",
        mirrorRoot: false,
      },
    ],
    remove: [],
  };
}

/**
 * A push to main: `next` always, the version line when the branch does not
 * already hold this exact version, and the root when this build is what the
 * site's entry point should serve.
 *
 * The root is a mirror of one of the copies, and it takes a mirror in three
 * cases:
 *
 *   - there is nothing there, so anything beats a 404;
 *   - it already mirrors this line, so it moves when the line moves;
 *   - this is a stable release outranking what the root serves.
 *
 * The first of those is what was missing. Mirroring used to require a stable
 * release, and a project in a prerelease wave never produces one, so the root
 * stayed empty and the site's entry point - the URL in `package.json`'s
 * `homepage` - answered 404 for as long as the wave ran. An entry point showing
 * a prerelease is worse than one showing the last stable release and far better
 * than one showing nothing, so an empty root now takes whatever a run has.
 */
export function planPush({
  version,
  lineVersion,
  rootExists,
  rootSlug,
  rootServesVersion,
  hasTag,
}) {
  const next = {
    slug: "next",
    ref: "",
    version,
    label: "next",
    kind: "dev",
    mirrorRoot: false,
  };
  const targets = [next];
  const line = lineOf(version);

  const takesRoot =
    !rootExists ||
    (line !== null && rootSlug === line) ||
    (!isPrerelease(version) &&
      (rootServesVersion == null ||
        compareVersions(version, rootServesVersion) > 0));

  if (line && (lineVersion !== version || takesRoot)) {
    targets.push({
      slug: line,
      // Prefer the tag when it is there. On the merge that releases a version
      // the tag is still being pushed by the parallel release run, and HEAD is
      // the release commit anyway; later catch-up runs get the exact source
      // instead of whatever main has moved on to.
      ref: hasTag ? `v${version}` : "",
      version,
      label: version,
      kind: isPrerelease(version) ? "prerelease" : "stable",
      mirrorRoot: takesRoot,
    });
  } else if (takesRoot) {
    // Nothing but `next` is being built, so that is what the root mirrors.
    next.mirrorRoot = true;
  }

  return { targets, remove: [] };
}
