// Rewrites `versions.json` at the root of the gh-pages tree from what is
// actually deployed there.
//
// Every deployed copy carries a `meta.json` written by the build that produced
// it, and this script regenerates the manifest by scanning for them rather than
// by editing the previous manifest. Deleting a directory is then all it takes
// to retire an entry, and a half-finished run cannot leave the manifest
// describing a copy that is not there.
//
// Usage: node scripts/docs-manifest.mjs <site-dir>
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const site = process.argv[2];
if (!site) {
  console.error("Usage: node scripts/docs-manifest.mjs <site-dir>");
  process.exit(1);
}

/** Directories that can hold a copy: `next`, `v1.1`, and `b/<branch>`. */
function slugs(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    if (entry.name === "b") {
      for (const branch of readdirSync(join(dir, "b"), {
        withFileTypes: true,
      })) {
        if (branch.isDirectory()) found.push(`b/${branch.name}`);
      }
      continue;
    }
    if (entry.name === "assets") continue;
    found.push(entry.name);
  }
  return found;
}

function readMeta(path) {
  try {
    const meta = JSON.parse(readFileSync(path, "utf8"));
    return typeof meta?.slug === "string" ? meta : null;
  } catch {
    // A directory without readable metadata is not a copy this manifest can
    // describe, which is the same answer as it not being there.
    return null;
  }
}

/** Semver precedence, enough of it to order the lines against each other. */
function compareVersions(a, b) {
  const parse = (version) => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(
      version ?? "",
    );
    if (!match) return null;
    return {
      release: [Number(match[1]), Number(match[2]), Number(match[3])],
      pre: match[4] ? match[4].split(".") : [],
    };
  };

  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return 0;

  for (let i = 0; i < 3; i++) {
    if (left.release[i] !== right.release[i]) {
      return left.release[i] - right.release[i];
    }
  }
  // Same release: a prerelease ranks below the release it leads up to.
  if (left.pre.length === 0 || right.pre.length === 0) {
    return left.pre.length === 0 ? (right.pre.length > 0 ? 1 : 0) : -1;
  }
  for (let i = 0; i < Math.min(left.pre.length, right.pre.length); i++) {
    const one = left.pre[i];
    const other = right.pre[i];
    const numeric = /^\d+$/.test(one) && /^\d+$/.test(other);
    if (numeric && Number(one) !== Number(other)) {
      return Number(one) - Number(other);
    }
    if (!numeric && one !== other) return one < other ? -1 : 1;
  }
  return left.pre.length - right.pre.length;
}

const entries = [];
for (const slug of slugs(site)) {
  const meta = readMeta(join(site, slug, "meta.json"));
  if (!meta) continue;
  entries.push({
    path: slug,
    label: meta.label ?? slug,
    version: meta.version,
    kind: meta.kind ?? "preview",
  });
}

// The root is a mirror of one of the copies rather than a copy of its own, so
// it is not an entry: the entry it mirrors is marked instead, and the menu
// links that one to the root.
const rootMeta = readMeta(join(site, "meta.json"));
const mirrored = rootMeta
  ? entries.find((entry) => entry.path === rootMeta.slug)
  : undefined;
if (mirrored) mirrored.latest = true;

const RANK = { dev: 0, stable: 1, prerelease: 1, preview: 2 };

entries.sort((a, b) => {
  // What the root serves leads, then main, then the remaining lines newest
  // first, then the previews by name.
  if (a.latest !== b.latest) return a.latest ? -1 : 1;
  if (RANK[a.kind] !== RANK[b.kind]) return RANK[a.kind] - RANK[b.kind];
  if (a.kind === "preview") return a.label < b.label ? -1 : 1;
  return compareVersions(b.version, a.version);
});

const manifest = { entries };
writeFileSync(join(site, "versions.json"), `${JSON.stringify(manifest, null, 2)}\n`);

// Pages serves this tree as-is, and Jekyll would otherwise drop anything whose
// name starts with an underscore.
const nojekyll = join(site, ".nojekyll");
if (!existsSync(nojekyll)) writeFileSync(nojekyll, "");

console.log(`versions.json: ${entries.length} entries`);
for (const entry of entries) {
  console.log(`  ${entry.latest ? "*" : " "} ${entry.path} (${entry.label})`);
}
