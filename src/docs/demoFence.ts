import type { DemoBlockDemo } from "../examples/DemoBlock";

/**
 * A docs page puts a demo where the prose that explains it is, with a fenced
 * block naming the file:
 *
 * ````markdown
 * ```demo
 * file: rows/Grouping.tsx
 * hint: “Group by …” lives in every column menu.
 * ```
 * ````
 *
 * The single-line form (the whole body being just `rows/Grouping.tsx`) is the
 * common case and means the same thing.
 *
 * A fence rather than MDX because the markdown has to stay markdown: it is
 * what `intent.docs` publishes, what six `SKILL.md` files cite as `sources:`,
 * and what an agent reads as plain text. Anything reading the raw file sees
 * the demo's path and its hint, which is the honest degradation - the demo
 * itself is code in a file, exactly where the fence says it is.
 */

const KEYS = ["file", "hint", "height", "extraSources"] as const;

type Key = (typeof KEYS)[number];

const isKey = (value: string): value is Key =>
  (KEYS as ReadonlyArray<string>).includes(value);

/**
 * Throws rather than rendering a placeholder: a demo that silently vanished
 * from a page is the failure nobody notices, and `docs.test.tsx` parses every
 * fence on every page, so a typo cannot reach the site.
 */
export function parseDemoFence(body: string): DemoBlockDemo {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const fields = new Map<Key, string>();

  for (const line of lines) {
    const separator = line.indexOf(":");
    const key = separator === -1 ? "" : line.slice(0, separator).trim();

    // No `key:` prefix at all - the single-line form, naming the file.
    if (!isKey(key)) {
      if (separator !== -1 || fields.has("file")) {
        throw new Error(
          `Demo fence: expected "<key>: <value>" with key one of ${KEYS.join(", ")}, got "${line}".`,
        );
      }
      fields.set("file", line);
      continue;
    }

    if (fields.has(key)) {
      throw new Error(`Demo fence: "${key}" given twice.`);
    }

    // Split on the first colon only, so a hint may contain one.
    fields.set(key, line.slice(separator + 1).trim());
  }

  const file = fields.get("file");

  if (!file) {
    throw new Error(`Demo fence: no demo file named in "${body.trim()}".`);
  }

  const height = fields.get("height");

  if (height !== undefined && !/^\d+$/.test(height)) {
    throw new Error(`Demo fence: height must be a whole number, got "${height}".`);
  }

  const extraSources = fields.get("extraSources");

  return {
    file,
    hint: fields.get("hint"),
    height: height === undefined ? undefined : Number(height),
    extraSources:
      extraSources === undefined
        ? undefined
        : extraSources
            .split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
  };
}

/**
 * Every demo fence in a markdown source, in the order they appear.
 *
 * `\r?` rather than `\n`: a Windows checkout under `core.autocrlf` hands these
 * pages over with CRLF endings, and an LF-only pattern then finds no fences at
 * all - which surfaces as demos being orphaned rather than as anything naming
 * line endings.
 */
export function findDemoFences(source: string): Array<DemoBlockDemo> {
  return [...source.matchAll(/^```demo\r?\n([\s\S]*?)^```/gm)].map((match) =>
    parseDemoFence(match[1]),
  );
}
