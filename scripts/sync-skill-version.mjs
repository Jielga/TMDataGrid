// Syncs `metadata.library_version` in every skills/*/SKILL.md to the version in
// package.json, then validates the result.
//
// Runs as the second half of `npm run version`, immediately after
// `changeset version` bumps package.json. Intent compares each skill's
// library_version against the package version and reports drift, so without this
// step every release would leave all five skills stale until someone noticed.
// Doing it here means the bump and the skill sync land in the same Version
// Packages PR and can be reviewed together.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

// Call the local binary directly rather than through a shell, so the script
// behaves the same on Windows and in CI.
const isWindows = process.platform === "win32";
const binPath = fileURLToPath(
  new URL(`../node_modules/.bin/${isWindows ? "intent.cmd" : "intent"}`, import.meta.url),
);

const result = spawnSync(binPath, ["validate", "--set-version", version], {
  stdio: "inherit",
  // .cmd shims are not directly executable without a shell on Windows.
  shell: isWindows,
});

if (result.error) {
  console.error(`Could not run intent: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
