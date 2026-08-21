// Decides which copies of the documentation a deploy run should produce.
//
// The decision is made against the state of the gh-pages tree rather than
// against git history, which makes a run idempotent: a line that failed to
// deploy is picked up by the next push, and a rerun of the same push writes
// the same directories.
//
// The trigger is the push to main rather than a tag or a release, because
// Changesets creates both with GITHUB_TOKEN and events raised by that token do
// not start workflow runs. The merge of a "chore: version packages" pull
// request is an ordinary push whose package.json version changed, and that is
// what a versioned snapshot hangs off.
//
// Usage: node scripts/docs-targets.mjs <site-dir>
// Reads GITHUB_EVENT_NAME, GITHUB_EVENT_PATH and the workflow_dispatch inputs
// from DOCS_INPUT_REF, DOCS_INPUT_SLUG and DOCS_INPUT_MIRROR_ROOT.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const site = process.argv[2];
if (!site) {
  console.error("Usage: node scripts/docs-targets.mjs <site-dir>");
  process.exit(1);
}

const PREVIEW_LABEL = "docs-preview";

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** package.json's version at a ref, or in the working tree when ref is empty. */
function versionAt(ref) {
  if (!ref) return readJson("package.json")?.version ?? null;
  try {
    const shown = execFileSync("git", ["show", `${ref}:package.json`], {
      encoding: "utf8",
    });
    return JSON.parse(shown).version ?? null;
  } catch {
    return null;
  }
}

function tagExists(tag) {
  try {
    execFileSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/** "2.0.0-beta.0" becomes "v2.0": one directory per minor line. */
function lineOf(version) {
  const match = /^(\d+)\.(\d+)\./.exec(version ?? "");
  return match ? `v${match[1]}.${match[2]}` : null;
}

function isPrerelease(version) {
  return /^\d+\.\d+\.\d+-/.test(version ?? "");
}

/** A branch name as a single path segment. */
function previewSlug(branch) {
  return `b/${branch.replaceAll(/[^A-Za-z0-9._-]+/g, "-")}`;
}

/** Enough semver precedence to answer "is this the newest stable". */
function compare(a, b) {
  const parse = (version) => {
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version ?? "");
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
  };
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return 0;
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

function metaAt(slug) {
  return readJson(join(site, slug, "meta.json"));
}

const event = process.env.GITHUB_EVENT_NAME ?? "";
const payload = process.env.GITHUB_EVENT_PATH
  ? (readJson(process.env.GITHUB_EVENT_PATH) ?? {})
  : {};

const targets = [];
const remove = [];

if (event === "workflow_dispatch") {
  const ref = process.env.DOCS_INPUT_REF ?? "";
  const slug = process.env.DOCS_INPUT_SLUG ?? "";
  if (!slug) {
    console.error("workflow_dispatch needs a slug input.");
    process.exit(1);
  }
  const version = versionAt(ref);
  targets.push({
    slug,
    ref,
    version,
    label: slug === "next" ? "next" : (version ?? slug),
    kind:
      slug === "next"
        ? "dev"
        : slug.startsWith("b/")
          ? "preview"
          : isPrerelease(version)
            ? "prerelease"
            : "stable",
    mirrorRoot: process.env.DOCS_INPUT_MIRROR_ROOT === "true",
  });
} else if (event === "pull_request") {
  const pull = payload.pull_request ?? {};
  const branch = pull.head?.ref ?? "";
  const slug = previewSlug(branch);
  const labelled = (pull.labels ?? []).some(
    (label) => label.name === PREVIEW_LABEL,
  );

  if (!branch) {
    console.error("No head branch on the pull request payload.");
    process.exit(1);
  }

  if (payload.action === "closed" || !labelled) {
    // Only when there is something to take down. A pull request that never had
    // the label closing is not a reason to republish the site.
    if (existsSync(join(site, slug))) remove.push(slug);
  } else {
    targets.push({
      slug,
      ref: "",
      version: versionAt(""),
      label: branch,
      kind: "preview",
      mirrorRoot: false,
    });
  }
} else {
  // A push to main. `next` always, the version line when the branch does not
  // already hold this exact version, and the root when this is the newest
  // stable there has been.
  const version = versionAt("");
  targets.push({
    slug: "next",
    ref: "",
    version,
    label: "next",
    kind: "dev",
    mirrorRoot: false,
  });

  const line = lineOf(version);
  if (line && metaAt(line)?.version !== version) {
    // Prefer the tag when it is there. On the merge that releases a version the
    // tag is still being pushed by the parallel release run, and HEAD is the
    // release commit anyway; later catch-up runs get the exact source instead
    // of whatever main has moved on to.
    const tag = `v${version}`;
    const rootMeta = readJson(join(site, "meta.json"));
    const rootVersion = rootMeta ? metaAt(rootMeta.slug)?.version : null;

    targets.push({
      slug: line,
      ref: tagExists(tag) ? tag : "",
      version,
      label: version,
      kind: isPrerelease(version) ? "prerelease" : "stable",
      mirrorRoot:
        !isPrerelease(version) &&
        (rootVersion === null || rootVersion === undefined
          ? true
          : compare(version, rootVersion) > 0),
    });
  }
}

const plan = { targets, remove, work: targets.length + remove.length > 0 };
console.error(JSON.stringify(plan, null, 2));
process.stdout.write(JSON.stringify(plan));
