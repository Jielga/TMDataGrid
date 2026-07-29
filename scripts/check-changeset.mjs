// Fails the commit when the published library changed but no changeset is
// pending, so a release can't silently ship an unlisted change.
//
// Deliberately narrow. Only changes under src/tmdatagrid/ -- the code that ends
// up in the tarball -- require a changeset. Demo site, docs, CI and tooling
// commits do not, and neither does the "chore: version packages" commit, which
// consumes changesets rather than adding one and never touches the library.
//
// The check looks for any pending changeset, not one staged in this particular
// commit: a feature is usually several commits and one changeset covers them.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";

const LIBRARY_DIR = "src/tmdatagrid/";

const staged = execFileSync(
  "git",
  ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

const libraryChanges = staged.filter((file) => file.startsWith(LIBRARY_DIR));
if (libraryChanges.length === 0) process.exit(0);

const pending = existsSync(".changeset")
  ? readdirSync(".changeset").filter(
      (file) => file.endsWith(".md") && file !== "README.md",
    )
  : [];

if (pending.length > 0) process.exit(0);

console.error(`
✖ No changeset for a change to the published library.

  Staged under ${LIBRARY_DIR}
${libraryChanges.map((file) => `    ${file}`).join("\n")}

  Describe the change so it reaches the changelog and bumps the version:

    npm run changeset

  If this genuinely needs no release -- a comment, a test, an internal
  refactor with no observable effect -- skip the check:

    git commit --no-verify
`);

process.exit(1);
