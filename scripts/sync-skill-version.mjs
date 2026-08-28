// Syncs `metadata.library_version` in every skills/*/SKILL.md to the version in
// package.json, then validates the result.
//
// Runs as the second half of `npm run version-packages`, immediately after
// `changeset version` bumps package.json. Intent compares each skill's
// library_version against the package version and reports drift, so without this
// step every release would leave every skill stale until someone noticed.
// Doing it here means the bump and the skill sync land in the same Version
// Packages PR and can be reviewed together.

import { readFileSync } from "node:fs";
import { runIntent } from "./intent.mjs";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

process.exit(runIntent(["validate", "--set-version", version]));
