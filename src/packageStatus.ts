import { useEffect, useState } from "react";

/**
 * Live package and build state, shared by the header badge and the front
 * page's fuller status strip.
 *
 * Read at runtime rather than baked in at build time: the site deploys from
 * the same push that publishes, so a stamped version would be right the moment
 * it shipped and quietly wrong from the next merge that skipped a release.
 */

export const PACKAGE = "@jielga/tmdatagrid";
export const REPO = "Jielga/TMDataGrid";
export const REPO_URL = `https://github.com/${REPO}`;
export const NPM_PAGE = `https://www.npmjs.com/package/${PACKAGE}`;

const CI_WORKFLOW = "ci.yml";

/**
 * The abbreviated registry document: dist-tags and dependency data only, a few
 * kB rather than the full document's every-version metadata and README.
 */
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE}`;
const REGISTRY_ACCEPT = "application/vnd.npm.install-v1+json";

/**
 * Newest *finished* run of the CI workflow on the default branch. Without
 * `status=completed` the newest run is the one the current push just started,
 * whose conclusion is null for a minute or two — so the badge would blink out
 * on every deploy, exactly when someone is most likely to be looking at it.
 */
const CI_RUNS_URL =
  `https://api.github.com/repos/${REPO}/actions/workflows/${CI_WORKFLOW}` +
  `/runs?branch=main&status=completed&per_page=1`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export type DistTags = { latest?: string; beta?: string };

function readDistTags(value: unknown): DistTags | null {
  if (!isRecord(value) || !isRecord(value["dist-tags"])) return null;
  const tags = value["dist-tags"];
  const latest = tags.latest;
  const beta = tags.beta;

  return {
    latest: typeof latest === "string" ? latest : undefined,
    beta: typeof beta === "string" ? beta : undefined,
  };
}

export type BuildStatus = { conclusion: string; url: string };

function readBuildStatus(value: unknown): BuildStatus | null {
  if (!isRecord(value) || !Array.isArray(value.workflow_runs)) return null;
  const [run] = value.workflow_runs;
  if (!isRecord(run)) return null;

  // `status=completed` should mean a conclusion is always present; a run that
  // somehow lacks one is not worth a badge either way.
  const { conclusion, html_url: url } = run;
  if (typeof conclusion !== "string" || typeof url !== "string") return null;

  return { conclusion, url };
}

/**
 * Reads one JSON endpoint, or gives up quietly.
 *
 * Every failure mode here is one the page can survive by showing one badge
 * fewer: offline, an ad blocker that eats registry requests, GitHub's 60/hour
 * unauthenticated rate limit. So nothing is retried and no error is surfaced —
 * "if available" is the whole contract.
 *
 * `parse` is called with `unknown` rather than trusted, because it is parsing a
 * response from a third party. It must be defined at module scope: it is an
 * effect dependency, and a new identity each render would refetch forever.
 */
function useJson<T>(
  url: string,
  parse: (value: unknown) => T | null,
  accept?: string,
): T | null {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(url, {
      signal: controller.signal,
      headers: accept ? { Accept: accept } : undefined,
    })
      .then((response): Promise<unknown> | null =>
        response.ok ? response.json() : null,
      )
      .then((value) => {
        if (value != null) setData(parse(value));
      })
      .catch(() => {
        // Includes the abort on unmount, which is not worth distinguishing.
      });

    return () => controller.abort();
  }, [url, parse, accept]);

  return data;
}

export function useDistTags(): DistTags | null {
  return useJson(REGISTRY_URL, readDistTags, REGISTRY_ACCEPT);
}

export function useBuildStatus(): BuildStatus | null {
  return useJson(CI_RUNS_URL, readBuildStatus);
}

/**
 * The version worth putting in the header: while the package is in prerelease
 * the `beta` tag runs ahead of `latest`, and that is the one `npm install
 * @jielga/tmdatagrid@beta` gives you.
 */
export function headlineVersion(tags: DistTags | null): string | undefined {
  if (!tags) return undefined;
  return tags.beta && tags.beta !== tags.latest ? tags.beta : tags.latest;
}

/** Green only for a clean run. Anything else is a state worth clicking into. */
export function buildColor(conclusion: string): string {
  if (conclusion === "success") return "teal";
  if (conclusion === "failure" || conclusion === "timed_out") return "red";
  return "gray";
}
