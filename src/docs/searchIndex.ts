import { rankItem } from "@tanstack/match-sorter-utils";
import { DOCS_PAGES } from "./docsPages";
import { extractHeadings } from "./headings";

/**
 * The docs search index, built once from the markdown the site already ships.
 *
 * Three kinds of entry, because the two kinds of query want opposite
 * treatment. A reader who types `onCellClick` wants that exact symbol first; a
 * reader who types "cell sorting" wants topics. Ranking them in one list with
 * an exact-match override gives both without a mode switch.
 */

export type SearchKind = "page" | "section" | "symbol";

export type SearchEntry = {
  kind: SearchKind;
  /** What matching runs against. */
  title: string;
  /** The page's blurb, or the page a section or symbol lives on. */
  context: string;
  to: string;
  hash?: string;
};

/**
 * Names in a Reference table read `| \`onCellClick\` | Table prop | …`, so the
 * first backticked cell of a table row is a documented symbol. Cheap, and it
 * needs no build step: the page that documents a name is by construction the
 * page the name was found on.
 */
function symbolsIn(source: string): Array<string> {
  return [...source.matchAll(/^\| `([^`]+)`\s*\|/gm)].map((match) => match[1]);
}

function buildIndex(): Array<SearchEntry> {
  const entries: Array<SearchEntry> = [];

  for (const page of DOCS_PAGES) {
    // Getting started is served at "/" - the router redirects /docs/….
    const to = page.id === "getting-started" ? "/" : `/docs/${page.id}`;

    entries.push({
      kind: "page",
      title: page.label,
      context: page.description,
      to,
    });

    for (const heading of extractHeadings(page.source)) {
      entries.push({
        kind: "section",
        title: heading.text,
        context: page.label,
        to,
        hash: heading.slug,
      });
    }

    for (const symbol of new Set(symbolsIn(page.source))) {
      entries.push({
        kind: "symbol",
        title: symbol,
        context: page.label,
        to,
        hash: "reference",
      });
    }
  }

  return entries;
}

/** Built once: the markdown is static, so the index can be too. */
export const SEARCH_INDEX = buildIndex();

const MAX_RESULTS = 12;

/**
 * Words in a query, split on whitespace *and* camelCase humps.
 *
 * The humps matter: `onClickExample` is not a real name, but its parts say
 * plainly what was meant, and splitting lets `click` find `onCellClick`.
 * Whitespace matters for the opposite case - "cell sorting" is two topics, and
 * as one string it fuzzy-matches neither.
 */
function tokenize(query: string): Array<string> {
  return query
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .split(/[\s.]+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length >= 2);
}

/** Exact, then prefix, then contains. Above anything fuzzy can score. */
function literalScore(haystack: string, needle: string): number {
  if (haystack === needle) return 3000;
  if (haystack.startsWith(needle)) return 2000;
  if (haystack.includes(needle)) return 1000;
  return 0;
}

/**
 * Ranked results for a query.
 *
 * A literal hit on the whole query jumps the queue outright - typing a prop
 * name should never rank a paragraph that mentions it above the prop itself.
 * Below that, each word is scored separately and matching more of them wins,
 * which is what lets a two-word topic query work at all. Anything still
 * unmatched falls to match-sorter's fuzzy rank, the same matcher the grid's own
 * quick search uses.
 */
export function searchDocs(query: string): Array<SearchEntry> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const needle = trimmed.toLowerCase();
  const tokens = tokenize(trimmed);

  const scored = SEARCH_INDEX.flatMap((entry) => {
    const title = entry.title.toLowerCase();

    // The whole query, weighted heaviest - an exact name beats everything.
    let score = literalScore(title, needle) * 2;

    let matched = 0;
    for (const token of tokens) {
      const literal = literalScore(title, token);
      if (literal > 0) {
        score += literal;
        matched += 1;
        continue;
      }
      const ranked = rankItem(entry.title, token);
      if (ranked.passed) {
        score += ranked.rank * 10;
        matched += 1;
      }
    }

    if (score === 0) return [];

    // Matching every word of the query beats matching one of them, whatever
    // the individual words scored.
    if (tokens.length > 0) score *= matched / tokens.length;

    // At equal quality a page outranks a section outranks a symbol: the page
    // is the broader answer, and its sections are one scroll away.
    const kindBias =
      entry.kind === "page" ? 2 : entry.kind === "section" ? 1 : 0;

    return [{ entry, score: score + kindBias }];
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map((result) => result.entry);
}
