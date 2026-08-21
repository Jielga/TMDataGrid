// Reads the state a deploy run decides against and prints the plan.
//
// The decision itself is in `docs-plan.mjs`; this is the shell around it - git,
// the gh-pages tree, and the workflow's event payload. Deciding against the
// tree rather than against git history makes a run idempotent: a line that
// failed to deploy is picked up by the next push, and a rerun of the same push
// writes the same directories.
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
import {
  lineOf,
  planDispatch,
  planPullRequest,
  planPush,
  PREVIEW_LABEL,
  previewSlug,
} from "./docs-plan.mjs";

const site = process.argv[2];
if (!site) {
  console.error("Usage: node scripts/docs-targets.mjs <site-dir>");
  process.exit(1);
}

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

/** The metadata a build wrote into its own directory. */
function metaAt(slug) {
  return slug ? readJson(join(site, slug, "meta.json")) : null;
}

const event = process.env.GITHUB_EVENT_NAME ?? "";
const payload = process.env.GITHUB_EVENT_PATH
  ? (readJson(process.env.GITHUB_EVENT_PATH) ?? {})
  : {};

let plan;

if (event === "workflow_dispatch") {
  const ref = process.env.DOCS_INPUT_REF ?? "";
  const slug = process.env.DOCS_INPUT_SLUG ?? "";
  if (!slug) {
    console.error("workflow_dispatch needs a slug input.");
    process.exit(1);
  }
  plan = planDispatch({
    slug,
    ref,
    version: versionAt(ref),
    mirrorRoot: process.env.DOCS_INPUT_MIRROR_ROOT === "true",
  });
} else if (event === "pull_request") {
  const pull = payload.pull_request ?? {};
  const branch = pull.head?.ref ?? "";
  if (!branch) {
    console.error("No head branch on the pull request payload.");
    process.exit(1);
  }
  plan = planPullRequest({
    branch,
    labelled: (pull.labels ?? []).some((label) => label.name === PREVIEW_LABEL),
    closed: payload.action === "closed",
    version: versionAt(""),
    hasCopy: existsSync(join(site, previewSlug(branch))),
  });
} else {
  const version = versionAt("");
  const line = lineOf(version);
  // The root carries the slug it mirrors rather than a copy of that build's
  // metadata, so what it serves is read through the copy it points at.
  const rootSlug = readJson(join(site, "meta.json"))?.slug ?? null;

  plan = planPush({
    version,
    lineVersion: metaAt(line)?.version,
    rootExists: existsSync(join(site, "index.html")),
    rootSlug,
    rootServesVersion: metaAt(rootSlug)?.version ?? null,
    hasTag: tagExists(`v${version}`),
  });
}

const out = {
  ...plan,
  work: plan.targets.length + plan.remove.length > 0,
};
console.error(JSON.stringify(out, null, 2));
process.stdout.write(JSON.stringify(out));
