import { Badge, Group } from "@mantine/core";
import { useEffect, useState } from "react";

const PACKAGE = "@jielga/tmdatagrid";
const REPO = "Jielga/TMDataGrid";
const CI_WORKFLOW = "ci.yml";

const NPM_PAGE = `https://www.npmjs.com/package/${PACKAGE}`;

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

type DistTags = { latest?: string; beta?: string };

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

type BuildStatus = { conclusion: string; url: string };

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

/** Green only for a clean run. Anything else is a state worth clicking into. */
function buildColor(conclusion: string): string {
  if (conclusion === "success") return "teal";
  if (conclusion === "failure" || conclusion === "timed_out") return "red";
  return "gray";
}

/**
 * Version and build state for the front page, read live rather than baked in at
 * build time: the site deploys from the same push that publishes, so a stamped
 * version would be right the moment it shipped and quietly wrong from the next
 * merge that skipped a release.
 *
 * While the package is in prerelease the `beta` tag is ahead of `latest`, and
 * both are worth showing — `latest` alone reads as abandoned, `beta` alone
 * hides what `npm install` actually gives you.
 */
export function ProjectStatus() {
  const tags = useJson(REGISTRY_URL, readDistTags, REGISTRY_ACCEPT);
  const build = useJson(CI_RUNS_URL, readBuildStatus);

  const showBeta = tags?.beta && tags.beta !== tags.latest;

  return (
    <Group gap="xs">
      {tags?.latest && (
        <Badge
          component="a"
          href={NPM_PAGE}
          variant="light"
          color="gray"
          style={{ cursor: "pointer" }}
        >
          npm {tags.latest}
        </Badge>
      )}
      {showBeta && (
        <Badge
          component="a"
          href={`${NPM_PAGE}/v/${tags.beta}`}
          variant="light"
          color="grape"
          style={{ cursor: "pointer" }}
        >
          beta {tags.beta}
        </Badge>
      )}
      {build && (
        <Badge
          component="a"
          href={build.url}
          variant="light"
          color={buildColor(build.conclusion)}
          style={{ cursor: "pointer" }}
        >
          build {build.conclusion.replace(/_/g, " ")}
        </Badge>
      )}
    </Group>
  );
}
