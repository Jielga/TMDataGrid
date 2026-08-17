import { useEffect, useState } from "react";

/**
 * Live package state, shared by the header badge and the front page's version
 * strip.
 *
 * Read at runtime rather than baked in at build time: the site deploys from
 * the same push that publishes, so a stamped version would be right the moment
 * it shipped and quietly wrong from the next merge that skipped a release.
 */

export const PACKAGE = "@jielga/tmdatagrid";
export const REPO = "Jielga/TMDataGrid";
export const REPO_URL = `https://github.com/${REPO}`;
export const NPM_PAGE = `https://www.npmjs.com/package/${PACKAGE}`;

/**
 * The abbreviated registry document: dist-tags and dependency data only, a few
 * kB rather than the full document's every-version metadata and README.
 */
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE}`;
const REGISTRY_ACCEPT = "application/vnd.npm.install-v1+json";

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

/**
 * Reads one JSON endpoint, or gives up quietly.
 *
 * Every failure mode here is one the page can survive by showing one badge
 * fewer: offline, or an ad blocker that eats registry requests. So nothing is
 * retried and no error is surfaced. "If available" is the whole contract.
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

type Parsed = { release: [number, number, number]; pre: Array<string> };

function parseVersion(version: string): Parsed | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(version);
  if (!match) return null;
  return {
    release: [Number(match[1]), Number(match[2]), Number(match[3])],
    pre: match[4] ? match[4].split(".") : [],
  };
}

/** Semver precedence for one dot-separated prerelease identifier. */
function compareIdentifier(a: string, b: string): number {
  const numericA = /^\d+$/.test(a);
  const numericB = /^\d+$/.test(b);
  if (numericA && numericB) return Number(a) - Number(b);
  // A numeric identifier always has lower precedence than an alphanumeric one.
  if (numericA !== numericB) return numericA ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Whether `version` has higher semver precedence than `other`.
 *
 * Unparseable input answers `false`: the badge it feeds is decoration, and
 * hiding it beats putting a guess in the header.
 */
export function isNewerVersion(version: string, other: string): boolean {
  const a = parseVersion(version);
  const b = parseVersion(other);
  if (!a || !b) return false;

  for (let i = 0; i < 3; i++) {
    if (a.release[i] !== b.release[i]) return a.release[i] > b.release[i];
  }

  // Same release: a prerelease ranks below the release it leads up to.
  if (a.pre.length === 0 || b.pre.length === 0) {
    return b.pre.length > 0 && a.pre.length === 0;
  }

  for (let i = 0; i < Math.min(a.pre.length, b.pre.length); i++) {
    const order = compareIdentifier(a.pre[i], b.pre[i]);
    if (order !== 0) return order > 0;
  }
  // All shared identifiers equal: the longer set wins.
  return a.pre.length > b.pre.length;
}

/**
 * Whether the `beta` tag is worth showing beside `latest` - which it is only
 * while it actually runs ahead.
 *
 * A prerelease wave leaves its `beta` tag behind on the registry once `latest`
 * overtakes it, and "differs from latest" then reads a months-old beta as the
 * current version. That is a badge that actively misinforms, so precedence
 * decides it rather than inequality.
 */
export function betaIsAhead(tags: DistTags | null): boolean {
  if (!tags?.beta) return false;
  if (!tags.latest) return true;
  return isNewerVersion(tags.beta, tags.latest);
}

/**
 * The version worth putting in the header: whichever of the two tags a reader
 * would actually be installing today.
 */
export function headlineVersion(tags: DistTags | null): string | undefined {
  if (!tags) return undefined;
  return betaIsAhead(tags) ? tags.beta : tags.latest;
}
