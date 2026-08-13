// Syncs `metadata.library_version` in every skills/*/SKILL.md to the version in
// package.json, then validates the result.
//
// Runs as the second half of `npm run version-packages`, immediately after
// `changeset version` bumps package.json. Intent compares each skill's
// library_version against the package version and reports drift, so without this
// step every release would leave every skill stale until someone noticed.
// Doing it here means the bump and the skill sync land in the same Version
// Packages PR and can be reviewed together.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

// `@tanstack/intent`'s own CLI, by path, rather than the `intent` shim in
// node_modules/.bin. Two installed packages declare a bin by that name —
// @tanstack/intent and @tanstack/devtools-event-client, the latter arriving
// transitively through @tanstack/react-form — and whichever wins the name is
// an install-order accident. When the wrong one won in CI it crashed on an
// import the other package does not export. A path cannot be ambiguous, and it
// needs no shell, so Windows and CI take the same route.
const cli = fileURLToPath(
  new URL("../node_modules/@tanstack/intent/dist/cli.mjs", import.meta.url),
);

if (!existsSync(cli)) {
  console.error(
    `Could not find the intent CLI at ${cli} — is @tanstack/intent installed?`,
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [cli, "validate", "--set-version", version],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(`Could not run intent: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
